import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface ObservedApiAccount {
  name: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  mobileNumber: string;
}

export function createObservedApiAccount(): ObservedApiAccount {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  return {
    name: `Observed API ${stamp}`,
    email: `observed.api.${stamp}@example.com`,
    password: `Obs!${stamp}`,
    firstName: 'Observed',
    lastName: `User${stamp.slice(-4)}`,
    company: 'ForgeQE Labs',
    address1: '100 Automation Street',
    address2: 'Suite 10',
    country: 'United States',
    state: 'California',
    city: 'San Francisco',
    zipcode: '94105',
    mobileNumber: `555${stamp.slice(-7)}`,
  };
}

export async function fetchCsrfToken(api: APIRequestContext, path: string): Promise<string> {
  const response = await api.get(path);
  const html = await response.text();
  const match = html.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i);

  if (!match) {
    throw new Error(`Could not extract csrfmiddlewaretoken from ${path}`);
  }

  return match[1];
}

export function toFormBody(fields: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(fields)) {
    params.set(key, value);
  }

  return params;
}

export async function postForm(
  api: APIRequestContext,
  path: string,
  fields: Record<string, string>,
  refererPath: string,
  maxRedirects?: number,
): Promise<APIResponse> {
  return api.post(path, {
    data: toFormBody(fields).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://automationexercise.com',
      Referer: `https://automationexercise.com${refererPath}`,
    },
    ...(maxRedirects !== undefined ? { maxRedirects } : {}),
  });
}

export function normalizeContentType(contentType: string | undefined): string {
  return (contentType ?? '').split(';')[0].trim().toLowerCase();
}

export async function expectHtmlContains(response: Awaited<ReturnType<APIRequestContext['get']>>, markers: string[]): Promise<void> {
  const body = await response.text();

  for (const marker of markers) {
    if (marker) {
      expectSubstring(body, marker);
    }
  }
}

export function extractPathParameter(samplePath: string): string {
  return samplePath.split('/').filter(Boolean).at(-1) ?? '';
}

function expectSubstring(body: string, marker: string): void {
  if (!body.includes(marker)) {
    throw new Error(`Expected response body to include marker: ${marker}`);
  }
}
