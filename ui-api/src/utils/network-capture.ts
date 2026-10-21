import { writeFile } from 'node:fs/promises';

import type { Page, Request, Response, TestInfo } from '@playwright/test';

import type { UiActionTracker } from './ui-action-tracker';

type HeaderMap = Record<string, string>;

type SanitizedPayload = {
  kind: 'none' | 'json' | 'form' | 'text';
  raw: string | null;
  fields: Record<string, string>;
  redactedKeys: string[];
};

type ExchangeClassification = {
  kind: 'candidate' | 'excluded';
  module: string;
  reason: string;
  excludeReason?: string;
};

type ObservedExchange = {
  sequence: number;
  uiAction: string | null;
  method: string;
  url: string;
  pathname: string;
  normalizedPath: string;
  host: string;
  resourceType: string;
  startedAt: string;
  request: {
    headers: HeaderMap;
    queryParams: Record<string, string>;
    payload: SanitizedPayload;
    cookieNames: string[];
    authDependencies: string[];
    correlationIds: Record<string, string>;
  };
  response?: {
    status: number;
    statusText: string;
    headers: HeaderMap;
    contentType: string;
    bodyPreview: string | null;
    bodyMarkers: string[];
    durationMs: number;
    setCookieNames: string[];
    correlationIds: Record<string, string>;
  };
  failureText?: string;
  classification: ExchangeClassification;
};

type DiscoveryCandidate = {
  id: string;
  module: string;
  method: string;
  normalizedPath: string;
  variant: string;
  samplePath: string;
  sampleQuery: Record<string, string>;
  sampleRequestBody: SanitizedPayload;
  uiActions: string[];
  resourceTypes: string[];
  observedStatusCodes: number[];
  observedContentTypes: string[];
  observedBodyMarkers: string[];
  requestCookieNames: string[];
  responseSetCookieNames: string[];
  authHeaderNames: string[];
  correlationHeaderNames: string[];
};

const SENSITIVE_KEYS = ['authorization', 'cookie', 'set-cookie', 'token', 'password', 'csrf'];
const CORRELATION_HEADERS = ['x-request-id', 'x-correlation-id', 'traceparent', 'tracestate', 'request-id'];
const BODY_MARKERS = [
  'Enter Account Information',
  'Account Created!',
  'Account Deleted!',
  'Your email or password is incorrect!',
  'Logged in as',
  'Blue Top',
  'Men Tshirt',
  'Shopping Cart',
  'Checkout',
];

export class NetworkCapture {
  private readonly exchanges = new Map<Request, ObservedExchange>();
  private readonly exchangeList: ObservedExchange[] = [];
  private readonly pendingTasks = new Set<Promise<void>>();
  private sequence = 0;

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
    private readonly actionTracker: UiActionTracker,
  ) {}

  attach(): void {
    this.page.on('request', request => {
      this.track(this.captureRequest(request));
    });

    this.page.on('response', response => {
      this.track(this.captureResponse(response));
    });

    this.page.on('requestfailed', request => {
      this.track(this.captureFailure(request));
    });
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.pendingTasks]);

    const networkTraffic = {
      capturedAt: new Date().toISOString(),
      totalEntries: this.exchangeList.length,
      candidates: this.exchangeList.filter(exchange => exchange.classification.kind === 'candidate').length,
      exchanges: this.exchangeList,
    };

    const discoveryReport = {
      generatedAt: new Date().toISOString(),
      sourceTest: this.testInfo.title,
      candidates: this.buildDiscoveryCandidates(),
      excludedTraffic: this.exchangeList
        .filter(exchange => exchange.classification.kind === 'excluded')
        .map(exchange => ({
          method: exchange.method,
          url: exchange.url,
          resourceType: exchange.resourceType,
          reason: exchange.classification.excludeReason ?? exchange.classification.reason,
        })),
    };

    await writeFile(this.testInfo.outputPath('network-traffic.json'), JSON.stringify(networkTraffic, null, 2), 'utf-8');
    await writeFile(this.testInfo.outputPath('api-discovery.json'), JSON.stringify(discoveryReport, null, 2), 'utf-8');
  }

  private track(task: Promise<void>): void {
    this.pendingTasks.add(task);
    task.finally(() => {
      this.pendingTasks.delete(task);
    });
  }

  private async captureRequest(request: Request): Promise<void> {
    const requestHeaders = sanitizeHeaders(await request.allHeaders());
    const parsedUrl = new URL(request.url());
    const payload = sanitizePayload(request.postData());
    const cookieNames = extractCookieNames(await request.headerValue('cookie'));
    const authDependencies = extractAuthDependencies(requestHeaders, cookieNames, payload.fields);
    const correlationIds = extractCorrelationIds(requestHeaders);
    const normalizedPath = normalizePath(parsedUrl.pathname);

    const exchange: ObservedExchange = {
      sequence: ++this.sequence,
      uiAction: this.actionTracker.get(),
      method: request.method(),
      url: request.url(),
      pathname: parsedUrl.pathname,
      normalizedPath,
      host: parsedUrl.host,
      resourceType: request.resourceType(),
      startedAt: new Date().toISOString(),
      request: {
        headers: requestHeaders,
        queryParams: Object.fromEntries(parsedUrl.searchParams.entries()),
        payload,
        cookieNames,
        authDependencies,
        correlationIds,
      },
      classification: classifyExchange({
        host: parsedUrl.host,
        pathname: parsedUrl.pathname,
        method: request.method(),
        resourceType: request.resourceType(),
        payloadFields: payload.fields,
      }),
    };

    this.exchanges.set(request, exchange);
    this.exchangeList.push(exchange);
  }

  private async captureResponse(response: Response): Promise<void> {
    const request = response.request();
    const exchange = this.exchanges.get(request);

    if (!exchange) {
      return;
    }

    const headers = sanitizeHeaders(await response.allHeaders());
    const contentType = normalizeContentType(headers['content-type']);
    const bodyPreview = await safelyReadResponseBody(response, contentType);
    const finishedAt = new Date();

    exchange.response = {
      status: response.status(),
      statusText: response.statusText(),
      headers,
      contentType,
      bodyPreview,
      bodyMarkers: extractBodyMarkers(bodyPreview),
      durationMs: finishedAt.getTime() - new Date(exchange.startedAt).getTime(),
      setCookieNames: extractSetCookieNames(await response.headerValue('set-cookie')),
      correlationIds: extractCorrelationIds(headers),
    };
  }

  private async captureFailure(request: Request): Promise<void> {
    const exchange = this.exchanges.get(request);

    if (exchange) {
      exchange.failureText = request.failure()?.errorText;
    }
  }

  private buildDiscoveryCandidates(): DiscoveryCandidate[] {
    const aggregated = new Map<string, DiscoveryCandidate>();

    for (const exchange of this.exchangeList) {
      if (exchange.classification.kind !== 'candidate') {
        continue;
      }

      const variant = determineVariant(exchange);
      const id = slug(`${exchange.classification.module}-${exchange.method}-${exchange.normalizedPath}-${variant}`);
      const existing = aggregated.get(id);

      if (existing) {
        mergeCandidate(existing, exchange);
        continue;
      }

      aggregated.set(id, {
        id,
        module: exchange.classification.module,
        method: exchange.method,
        normalizedPath: exchange.normalizedPath,
        variant,
        samplePath: exchange.pathname,
        sampleQuery: exchange.request.queryParams,
        sampleRequestBody: exchange.request.payload,
        uiActions: unique([exchange.uiAction].filter((value): value is string => Boolean(value))),
        resourceTypes: unique([exchange.resourceType]),
        observedStatusCodes: unique([exchange.response?.status].filter((value): value is number => value !== undefined)),
        observedContentTypes: unique([exchange.response?.contentType].filter((value): value is string => Boolean(value))),
        observedBodyMarkers: unique(exchange.response?.bodyMarkers ?? []),
        requestCookieNames: unique(exchange.request.cookieNames),
        responseSetCookieNames: unique(exchange.response?.setCookieNames ?? []),
        authHeaderNames: unique(exchange.request.authDependencies),
        correlationHeaderNames: unique([
          ...Object.keys(exchange.request.correlationIds),
          ...Object.keys(exchange.response?.correlationIds ?? {}),
        ]),
      });
    }

    return [...aggregated.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

function sanitizeHeaders(headers: HeaderMap): HeaderMap {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        return [key, `[redacted:${key}]`];
      }

      return [key, truncate(value, 500)];
    }),
  );
}

function sanitizePayload(postData: string | null): SanitizedPayload {
  if (!postData) {
    return { kind: 'none', raw: null, fields: {}, redactedKeys: [] };
  }

  try {
    const parsedJson = JSON.parse(postData) as Record<string, unknown>;
    const fields = sanitizeFieldRecord(
      Object.fromEntries(Object.entries(parsedJson).map(([key, value]) => [key, String(value ?? '')])),
    );

    return {
      kind: 'json',
      raw: JSON.stringify(fields.fields),
      fields: fields.fields,
      redactedKeys: fields.redactedKeys,
    };
  } catch {
    // Continue to form parsing.
  }

  const form = new URLSearchParams(postData);
  const formEntries = Object.fromEntries(form.entries());

  if (Object.keys(formEntries).length > 0) {
    const fields = sanitizeFieldRecord(formEntries);

    return {
      kind: 'form',
      raw: truncate(postData, 1000),
      fields: fields.fields,
      redactedKeys: fields.redactedKeys,
    };
  }

  return {
    kind: 'text',
    raw: truncate(postData, 1000),
    fields: {},
    redactedKeys: [],
  };
}

function sanitizeFieldRecord(record: Record<string, string>): { fields: Record<string, string>; redactedKeys: string[] } {
  const redactedKeys: string[] = [];
  const fields = Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        redactedKeys.push(key);

        if (key.toLowerCase().includes('email')) {
          return [key, '<generated-email>'];
        }

        if (key.toLowerCase().includes('password')) {
          return [key, '<generated-password>'];
        }

        if (key.toLowerCase().includes('csrf')) {
          return [key, '<csrf-token>'];
        }

        return [key, `<redacted:${key}>`];
      }

      if (key.toLowerCase().includes('email')) {
        return [key, '<generated-email>'];
      }

      if (key === 'name') {
        return [key, '<generated-name>'];
      }

      return [key, truncate(value, 200)];
    }),
  );

  return { fields, redactedKeys };
}

function classifyExchange(input: {
  host: string;
  pathname: string;
  method: string;
  resourceType: string;
  payloadFields: Record<string, string>;
}): ExchangeClassification {
  if (input.host !== 'automationexercise.com') {
    return {
      kind: 'excluded',
      module: 'third-party',
      reason: 'Third-party request',
      excludeReason: 'third-party request',
    };
  }

  if (isStaticAsset(input.pathname, input.resourceType)) {
    return {
      kind: 'excluded',
      module: 'static',
      reason: 'Static asset',
      excludeReason: 'static asset',
    };
  }

  const module = determineModule(input.pathname, input.payloadFields);
  const isBusinessAction =
    input.resourceType === 'xhr' ||
    input.method !== 'GET' ||
    /\/(add_to_cart|delete_cart|delete_account|logout)/.test(input.pathname);

  if (!isBusinessAction) {
    return {
      kind: 'excluded',
      module,
      reason: 'HTML navigation used for rendering pages',
      excludeReason: 'html navigation or supporting page render',
    };
  }

  return {
    kind: 'candidate',
    module,
    reason: input.resourceType === 'xhr' ? 'Observed first-party xhr request' : 'Observed first-party business workflow request',
  };
}

function determineModule(pathname: string, payloadFields: Record<string, string>): string {
  if (/\/(add_to_cart|delete_cart|view_cart|checkout)/.test(pathname)) {
    return 'cart';
  }

  if (/\/(login|signup|logout|delete_account|account_created)/.test(pathname) || payloadFields.form_type) {
    return 'authentication';
  }

  return 'catalog';
}

function normalizePath(pathname: string): string {
  if (/^\/add_to_cart\/\d+$/.test(pathname)) {
    return '/add_to_cart/{productId}';
  }

  if (/^\/delete_cart\/\d+$/.test(pathname)) {
    return '/delete_cart/{productId}';
  }

  if (/^\/product_details\/\d+$/.test(pathname)) {
    return '/product_details/{productId}';
  }

  return pathname;
}

function determineVariant(exchange: ObservedExchange): string {
  if (exchange.request.payload.fields.form_type) {
    return exchange.request.payload.fields.form_type;
  }

  return 'default';
}

function mergeCandidate(candidate: DiscoveryCandidate, exchange: ObservedExchange): void {
  candidate.uiActions = unique([...candidate.uiActions, ...[exchange.uiAction].filter((value): value is string => Boolean(value))]);
  candidate.resourceTypes = unique([...candidate.resourceTypes, exchange.resourceType]);
  candidate.observedStatusCodes = unique([...candidate.observedStatusCodes, ...[exchange.response?.status].filter((value): value is number => value !== undefined)]);
  candidate.observedContentTypes = unique([...candidate.observedContentTypes, ...[exchange.response?.contentType].filter((value): value is string => Boolean(value))]);
  candidate.observedBodyMarkers = unique([...candidate.observedBodyMarkers, ...(exchange.response?.bodyMarkers ?? [])]);
  candidate.requestCookieNames = unique([...candidate.requestCookieNames, ...exchange.request.cookieNames]);
  candidate.responseSetCookieNames = unique([...candidate.responseSetCookieNames, ...(exchange.response?.setCookieNames ?? [])]);
  candidate.authHeaderNames = unique([...candidate.authHeaderNames, ...exchange.request.authDependencies]);
  candidate.correlationHeaderNames = unique([
    ...candidate.correlationHeaderNames,
    ...Object.keys(exchange.request.correlationIds),
    ...Object.keys(exchange.response?.correlationIds ?? {}),
  ]);
}

async function safelyReadResponseBody(response: Response, contentType: string): Promise<string | null> {
  if (!/json|text|html|xml|javascript/.test(contentType)) {
    return null;
  }

  try {
    const rawBody = await response.text();
    return sanitizeResponseBody(rawBody);
  } catch {
    return null;
  }
}

function sanitizeResponseBody(body: string): string {
  return truncate(
    body
      .replace(/(password|csrfmiddlewaretoken|token|authorization)=([^&\s]+)/gi, '$1=[redacted]')
      .replace(/(set-cookie:)([^\n]+)/gi, '$1 [redacted]'),
    4000,
  );
}

function extractBodyMarkers(bodyPreview: string | null): string[] {
  if (!bodyPreview) {
    return [];
  }

  return BODY_MARKERS.filter(marker => bodyPreview.includes(marker));
}

function normalizeContentType(contentType: string | undefined): string {
  return (contentType ?? '').split(';')[0].trim().toLowerCase();
}

function extractCookieNames(cookieHeader: string | null): string[] {
  if (!cookieHeader) {
    return [];
  }

  return unique(
    cookieHeader
      .split(';')
      .map(cookie => cookie.split('=')[0]?.trim())
      .filter((cookieName): cookieName is string => Boolean(cookieName)),
  );
}

function extractSetCookieNames(setCookieHeader: string | null): string[] {
  if (!setCookieHeader) {
    return [];
  }

  return unique(
    setCookieHeader
      .split(',')
      .map(cookie => cookie.trim().split('=')[0])
      .filter((cookieName): cookieName is string => Boolean(cookieName)),
  );
}

function extractAuthDependencies(headers: HeaderMap, cookieNames: string[], payloadFields: Record<string, string>): string[] {
  const dependencies = new Set<string>();

  if (headers.authorization && headers.authorization !== '[redacted:authorization]') {
    dependencies.add('authorization');
  }

  if (cookieNames.length > 0) {
    for (const cookieName of cookieNames) {
      dependencies.add(`cookie:${cookieName}`);
    }
  }

  if (payloadFields.csrfmiddlewaretoken) {
    dependencies.add('csrfmiddlewaretoken');
  }

  return [...dependencies].sort();
}

function extractCorrelationIds(headers: HeaderMap): Record<string, string> {
  return Object.fromEntries(
    CORRELATION_HEADERS.flatMap(headerName => {
      const value = headers[headerName];
      return value ? [[headerName, value]] : [];
    }),
  );
}

function isStaticAsset(pathname: string, resourceType: string): boolean {
  return (
    resourceType === 'image' ||
    resourceType === 'stylesheet' ||
    resourceType === 'font' ||
    resourceType === 'script' ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/get_product_picture/') ||
    pathname.startsWith('/cdn-cgi/')
  );
}

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(fragment => lowerKey.includes(fragment));
}

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}
