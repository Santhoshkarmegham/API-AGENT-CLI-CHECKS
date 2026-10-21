import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Status = 'passed' | 'failed' | 'flaky' | 'skipped' | 'blocked' | 'not_generated';

type SanitizedPayload = {
  kind: 'none' | 'json' | 'form' | 'text';
  raw: string | null;
  fields: Record<string, string>;
  redactedKeys: string[];
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

type DiscoveryReport = {
  generatedAt: string;
  sourceTest: string;
  candidates: DiscoveryCandidate[];
  excludedTraffic: Array<{
    method: string;
    url: string;
    resourceType: string;
    reason: string;
  }>;
};

type SuiteRecord = {
  suite: string;
  command: string;
  generatedAt: string;
  status: 'passed' | 'failed' | 'flaky';
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  durationMs: number;
};

type StoredSummary = {
  updatedAt: string;
  suites: SuiteRecord[];
};

type CoverageRow = {
  suite: string;
  tags: string[];
  focus: string;
  validations: string[];
};

type NetworkExchange = {
  sequence: number;
  uiAction: string | null;
  method: string;
  url: string;
  pathname: string;
  normalizedPath: string;
  resourceType: string;
  request: {
    queryParams: Record<string, string>;
    payload: SanitizedPayload;
  };
  response?: {
    status: number;
    contentType: string;
    bodyPreview: string | null;
    bodyMarkers: string[];
    durationMs: number;
  };
  classification: {
    kind: 'candidate' | 'excluded';
    reason: string;
    excludeReason?: string;
  };
};

type NetworkTrafficReport = {
  capturedAt: string;
  totalEntries: number;
  candidates: number;
  exchanges: NetworkExchange[];
};

type PlaywrightResult = {
  status: string;
  duration?: number;
  errors?: Array<{ message?: string; value?: string }>;
  attachments?: Array<{
    name: string;
    path?: string;
    contentType?: string;
  }>;
};

type PlaywrightTest = {
  status?: string;
  results?: PlaywrightResult[];
};

type PlaywrightSpec = {
  title: string;
  tags?: string[];
  tests?: PlaywrightTest[];
  file: string;
  line?: number;
};

type PlaywrightSuiteNode = {
  title: string;
  file?: string;
  suites?: PlaywrightSuiteNode[];
  specs?: PlaywrightSpec[];
};

type PlaywrightResults = {
  config: {
    metadata?: {
      environment?: string;
      baseURL?: string;
    };
  };
  suites: PlaywrightSuiteNode[];
};

type FlattenedSpec = {
  title: string;
  file: string;
  tags: string[];
  status: Status;
  durationMs: number;
  errors: string[];
  attachments: Array<{
    name: string;
    path?: string;
    contentType?: string;
  }>;
};

type ExecutionCounts = {
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
};

type ExcludedSummary = {
  reason: string;
  count: number;
  sampleRequests: string[];
};

type EndpointCoverageRow = {
  candidateId: string;
  method: string;
  normalizedPath: string;
  variant: string;
  generatedTestCases: string[];
  executionResult: Status;
};

type TraceabilityRow = {
  uiAction: string;
  capturedNetworkRequest: string;
  discoveredApi: string;
  generatedTestCase: string;
  executionResult: Status;
};

type EvidenceRow = {
  uiAction: string;
  request: string;
  discoveredApi: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  redactedKeys: string[];
  responseMarkers: string[];
  requestPreview: string;
  responsePreview: string;
};

type ResponseTimeRow = {
  method: string;
  endpoint: string;
  variant: string;
  calls: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
};

type CapabilityAssessment = {
  capability: string;
  status: 'ready' | 'partial' | 'not_exercised';
  evidence: string;
};

type ReportSummary = {
  generatedAt: string;
  environment: string | null;
  baseURL: string | null;
  totals: {
    uiScenariosExecuted: number;
    networkRequestsCaptured: number;
    uniqueApisDiscovered: number;
    uniqueDiscoveredEndpoints: number;
    apisConvertedToAutomatedTests: number;
    excludedApis: number;
    generatedApiScenarios: number;
  };
  execution: {
    passed: number;
    failed: number;
    skipped: number;
    blocked: number;
    fullSuiteDurationMs: number | null;
    aggregateRecordedDurationMs: number;
  };
  coverage: {
    functional: { total: number; passed: number };
    negative: { total: number; passed: number };
    endpointCoverage: { coveredCandidates: number; totalCandidates: number; coveredEndpoints: number; totalEndpoints: number };
  };
  distributions: {
    statusCodes: Array<{ statusCode: number; count: number }>;
  };
  excludedSummary: ExcludedSummary[];
  traceabilityMatrix: TraceabilityRow[];
  endpointCoverageRows: EndpointCoverageRow[];
  evidenceRows: EvidenceRow[];
  responseTimes: ResponseTimeRow[];
  failureDetails: Array<{ testCase: string; status: Status; errors: string[]; attachments: string[] }>;
  capabilityAssessment: CapabilityAssessment[];
};

const coverageRows: CoverageRow[] = [
  {
    suite: 'Authentication positive suite',
    tags: ['@smoke', '@regression'],
    focus: 'Signup start and account creation happy paths',
    validations: ['status', 'content-type', 'headers', 'redirect location', 'response body'],
  },
  {
    suite: 'Authentication negative suite',
    tags: ['@negative', '@regression'],
    focus: 'Observed invalid login behavior',
    validations: ['status', 'content-type', 'headers', 'error response body'],
  },
  {
    suite: 'Cart positive suite',
    tags: ['@smoke', '@regression'],
    focus: 'Observed add-to-cart and delete-cart workflow',
    validations: ['status', 'content-type', 'cart markers', 'state removal'],
  },
  {
    suite: 'Observed API end-to-end workflows',
    tags: ['@e2e', '@regression'],
    focus: 'Signup, login, cart, checkout, delete-account chaining',
    validations: ['redirects', 'dynamic identifiers', 'session continuity', 'response body'],
  },
  {
    suite: 'Generated observed API scripts',
    tags: ['@regression'],
    focus: 'Replay of real UI-observed endpoints',
    validations: ['observed behavior parity', 'supported assumptions only', 'workflow reuse'],
  },
];

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '../..');
  const deliverablesDir = path.join(projectRoot, 'deliverables');
  await mkdir(deliverablesDir, { recursive: true });

  const latestArtifacts = await readLatestArtifacts(projectRoot);
  const summary = await readJsonIfPresent<StoredSummary>(path.join(deliverablesDir, 'run-status.json'));
  const results = await readJsonIfPresent<PlaywrightResults>(path.join(projectRoot, 'test-results', 'results.json'));

  if (!latestArtifacts.discovery || !latestArtifacts.networkTraffic || !results) {
    throw new Error('Missing reporting inputs. Ensure results.json, network-traffic.json, and api-discovery.json exist under test-results.');
  }

  const flattenedSpecs = flattenSpecs(results.suites);
  const inventory = buildInventory(latestArtifacts.discovery);
  const mapping = buildUiToApiMapping(latestArtifacts.discovery.candidates);
  const reportSummary = buildReportSummary({
    discovery: latestArtifacts.discovery,
    networkTraffic: latestArtifacts.networkTraffic,
    results,
    flattenedSpecs,
    summary,
  });

  await writeFile(path.join(deliverablesDir, 'api-inventory.json'), JSON.stringify(inventory, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'ui-to-api-discovery-mapping.json'), JSON.stringify(mapping, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'coverage-matrix.json'), JSON.stringify(coverageRows, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'coverage-matrix.md'), renderCoverageMatrixMarkdown(coverageRows), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'test-execution-summary.json'), JSON.stringify(summary ?? { updatedAt: null, suites: [] }, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'test-execution-summary.md'), renderExecutionSummaryMarkdown(summary?.suites ?? []), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'traceability-matrix.json'), JSON.stringify(reportSummary.traceabilityMatrix, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'traceability-matrix.md'), renderTraceabilityMatrixMarkdown(reportSummary.traceabilityMatrix), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'phase6-report-summary.json'), JSON.stringify(reportSummary, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'custom-report.html'), renderCustomHtmlReport(reportSummary, coverageRows, summary?.suites ?? []), 'utf-8');
}

async function readLatestArtifacts(projectRoot: string): Promise<{
  discovery: DiscoveryReport | null;
  networkTraffic: NetworkTrafficReport | null;
}> {
  const testResultsDir = path.join(projectRoot, 'test-results');
  const entries = await readdir(testResultsDir, { withFileTypes: true }).catch(() => []);
  const candidates = await Promise.all(
    entries
      .filter(entry => entry.isDirectory())
      .map(async entry => {
        const directory = path.join(testResultsDir, entry.name);
        const discovery = await readJsonIfPresent<DiscoveryReport>(path.join(directory, 'api-discovery.json'));
        const networkTraffic = await readJsonIfPresent<NetworkTrafficReport>(path.join(directory, 'network-traffic.json'));

        if (!discovery || !networkTraffic) {
          return null;
        }

        return {
          discovery,
          networkTraffic,
          generatedAt: discovery.generatedAt,
        };
      }),
  );

  const latest = candidates
    .filter((value): value is { discovery: DiscoveryReport; networkTraffic: NetworkTrafficReport; generatedAt: string } => value !== null)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];

  return {
    discovery: latest?.discovery ?? null,
    networkTraffic: latest?.networkTraffic ?? null,
  };
}

function flattenSpecs(nodes: PlaywrightSuiteNode[]): FlattenedSpec[] {
  const flattened: FlattenedSpec[] = [];

  const visit = (node: PlaywrightSuiteNode): void => {
    for (const spec of node.specs ?? []) {
      const latestResult = spec.tests?.flatMap(test => test.results ?? []).at(-1);
      const status = normalizePlaywrightStatus(latestResult?.status ?? spec.tests?.at(-1)?.status ?? 'unknown');
      flattened.push({
        title: spec.title,
        file: spec.file,
        tags: spec.tags ?? [],
        status,
        durationMs: latestResult?.duration ?? 0,
        errors: (latestResult?.errors ?? []).map(error => error.message ?? error.value ?? 'Unknown error'),
        attachments: latestResult?.attachments ?? [],
      });
    }

    for (const child of node.suites ?? []) {
      visit(child);
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return flattened;
}

function normalizePlaywrightStatus(status: string): Status {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'timedOut':
    case 'interrupted':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default:
      return 'blocked';
  }
}

function buildInventory(discovery: DiscoveryReport): Record<string, unknown> {
  const modules = discovery.candidates.reduce<Record<string, Array<Record<string, unknown>>>>((accumulator, candidate) => {
    accumulator[candidate.module] ??= [];
    accumulator[candidate.module].push({
      id: candidate.id,
      method: candidate.method,
      endpoint: candidate.normalizedPath,
      variant: candidate.variant,
      samplePath: candidate.samplePath,
      sampleQuery: candidate.sampleQuery,
      uiActions: candidate.uiActions,
      observedStatusCodes: candidate.observedStatusCodes,
      observedContentTypes: candidate.observedContentTypes,
      requestFields: Object.keys(candidate.sampleRequestBody.fields),
      redactedKeys: candidate.sampleRequestBody.redactedKeys,
      authDependencies: candidate.authHeaderNames,
      cookieDependencies: candidate.requestCookieNames,
      correlationHeaderNames: candidate.correlationHeaderNames,
    });
    return accumulator;
  }, {});

  return {
    generatedAt: discovery.generatedAt,
    sourceTest: discovery.sourceTest,
    totals: {
      discoveredCandidates: discovery.candidates.length,
      uniqueEndpoints: new Set(discovery.candidates.map(candidate => `${candidate.method} ${candidate.normalizedPath}`)).size,
      excludedRequests: discovery.excludedTraffic.length,
    },
    modules,
  };
}

function buildUiToApiMapping(candidates: DiscoveryCandidate[]): Record<string, unknown> {
  const mappings = new Map<string, Array<Record<string, string>>>();

  for (const candidate of candidates) {
    for (const uiAction of candidate.uiActions) {
      const current = mappings.get(uiAction) ?? [];
      current.push({
        candidateId: candidate.id,
        module: candidate.module,
        method: candidate.method,
        endpoint: candidate.normalizedPath,
        variant: candidate.variant,
      });
      mappings.set(uiAction, current);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mappings: Object.fromEntries([...mappings.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
  };
}

function buildReportSummary(input: {
  discovery: DiscoveryReport;
  networkTraffic: NetworkTrafficReport;
  results: PlaywrightResults;
  flattenedSpecs: FlattenedSpec[];
  summary: StoredSummary | null;
}): ReportSummary {
  const { discovery, networkTraffic, results, flattenedSpecs, summary } = input;
  const generatedSpecs = flattenedSpecs.filter(spec => spec.file.startsWith('generated/'));
  const uiSpecs = flattenedSpecs.filter(spec => !spec.file.startsWith('api/') && !spec.file.startsWith('generated/'));
  const executionCounts = buildExecutionCounts(flattenedSpecs);
  const excludedSummary = buildExcludedSummary(discovery.excludedTraffic);
  const endpointCoverageRows = buildEndpointCoverageRows(discovery.candidates, generatedSpecs);
  const traceabilityMatrix = buildTraceabilityMatrix(discovery.candidates, generatedSpecs);
  const evidenceRows = buildEvidenceRows(networkTraffic.exchanges);
  const responseTimes = buildResponseTimes(discovery.candidates, networkTraffic.exchanges);
  const functionalSpecs = flattenedSpecs.filter(spec => !isNegativeSpec(spec));
  const negativeSpecs = flattenedSpecs.filter(spec => isNegativeSpec(spec));
  const coveredCandidates = endpointCoverageRows.filter(row => row.generatedTestCases.length > 0);
  const uniqueDiscoveredEndpoints = new Set(discovery.candidates.map(candidate => `${candidate.method} ${candidate.normalizedPath}`));
  const coveredEndpoints = new Set(coveredCandidates.map(candidate => `${candidate.method} ${candidate.normalizedPath}`));
  const fullSuiteDurationMs = summary?.suites.find(suite => suite.suite === 'full')?.durationMs ?? null;
  const aggregateRecordedDurationMs = (summary?.suites ?? []).reduce((total, suite) => total + suite.durationMs, 0);

  return {
    generatedAt: new Date().toISOString(),
    environment: results.config.metadata?.environment ?? null,
    baseURL: results.config.metadata?.baseURL ?? null,
    totals: {
      uiScenariosExecuted: uiSpecs.length,
      networkRequestsCaptured: networkTraffic.totalEntries,
      uniqueApisDiscovered: discovery.candidates.length,
      uniqueDiscoveredEndpoints: uniqueDiscoveredEndpoints.size,
      apisConvertedToAutomatedTests: coveredCandidates.length,
      excludedApis: discovery.excludedTraffic.length,
      generatedApiScenarios: generatedSpecs.length,
    },
    execution: {
      passed: executionCounts.passed,
      failed: executionCounts.failed,
      skipped: executionCounts.skipped,
      blocked: executionCounts.blocked,
      fullSuiteDurationMs,
      aggregateRecordedDurationMs,
    },
    coverage: {
      functional: {
        total: functionalSpecs.length,
        passed: functionalSpecs.filter(spec => spec.status === 'passed').length,
      },
      negative: {
        total: negativeSpecs.length,
        passed: negativeSpecs.filter(spec => spec.status === 'passed').length,
      },
      endpointCoverage: {
        coveredCandidates: coveredCandidates.length,
        totalCandidates: discovery.candidates.length,
        coveredEndpoints: coveredEndpoints.size,
        totalEndpoints: uniqueDiscoveredEndpoints.size,
      },
    },
    distributions: {
      statusCodes: buildStatusCodeDistribution(networkTraffic.exchanges),
    },
    excludedSummary,
    traceabilityMatrix,
    endpointCoverageRows,
    evidenceRows,
    responseTimes,
    failureDetails: flattenedSpecs
      .filter(spec => spec.status !== 'passed')
      .map(spec => ({
        testCase: spec.title,
        status: spec.status,
        errors: spec.errors,
        attachments: spec.attachments.map(attachment => attachment.path ?? attachment.name),
      })),
    capabilityAssessment: buildCapabilityAssessment({
      uiScenariosExecuted: uiSpecs.length,
      networkTraffic,
      discovery,
      endpointCoverageRows,
      negativeSpecs,
      executionCounts,
    }),
  };
}

function buildExecutionCounts(specs: FlattenedSpec[]): ExecutionCounts {
  return specs.reduce<ExecutionCounts>((counts, spec) => {
    const bucket: keyof ExecutionCounts =
      spec.status === 'passed' ? 'passed'
        : spec.status === 'failed' ? 'failed'
          : spec.status === 'skipped' ? 'skipped'
            : 'blocked';
    counts[bucket] += 1;
    return counts;
  }, {
    passed: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
  });
}

function isNegativeSpec(spec: FlattenedSpec): boolean {
  const title = spec.title.toLowerCase();
  return spec.tags.includes('negative') || title.includes('negative') || title.includes('invalid') || title.includes('error');
}

function buildExcludedSummary(excludedTraffic: DiscoveryReport['excludedTraffic']): ExcludedSummary[] {
  const grouped = new Map<string, ExcludedSummary>();

  for (const entry of excludedTraffic) {
    const current = grouped.get(entry.reason) ?? {
      reason: entry.reason,
      count: 0,
      sampleRequests: [],
    };
    current.count += 1;

    if (current.sampleRequests.length < 5) {
      current.sampleRequests.push(`${entry.method} ${entry.url}`);
    }

    grouped.set(entry.reason, current);
  }

  return [...grouped.values()].sort((left, right) => right.count - left.count);
}

function buildEndpointCoverageRows(candidates: DiscoveryCandidate[], generatedSpecs: FlattenedSpec[]): EndpointCoverageRow[] {
  return candidates.map(candidate => {
    const generatedTestCases = matchGeneratedSpecs(candidate, generatedSpecs);
    return {
      candidateId: candidate.id,
      method: candidate.method,
      normalizedPath: candidate.normalizedPath,
      variant: candidate.variant,
      generatedTestCases,
      executionResult: summarizeExecutionResult(generatedTestCases, generatedSpecs),
    };
  });
}

function buildTraceabilityMatrix(candidates: DiscoveryCandidate[], generatedSpecs: FlattenedSpec[]): TraceabilityRow[] {
  return candidates.flatMap(candidate => {
    const generatedTestCases = matchGeneratedSpecs(candidate, generatedSpecs);
    const executionResult = summarizeExecutionResult(generatedTestCases, generatedSpecs);

    return candidate.uiActions.map(uiAction => ({
      uiAction,
      capturedNetworkRequest: formatRequest(candidate.method, candidate.samplePath, candidate.sampleQuery),
      discoveredApi: `${candidate.method} ${candidate.normalizedPath} (${candidate.variant})`,
      generatedTestCase: generatedTestCases.length > 0 ? generatedTestCases.join(' | ') : 'Not generated',
      executionResult,
    }));
  });
}

function buildEvidenceRows(exchanges: NetworkExchange[]): EvidenceRow[] {
  return exchanges
    .filter(exchange => exchange.classification.kind === 'candidate')
    .map(exchange => ({
      uiAction: exchange.uiAction ?? 'Untracked UI action',
      request: formatRequest(exchange.method, exchange.pathname, exchange.request.queryParams),
      discoveredApi: `${exchange.method} ${exchange.normalizedPath}`,
      statusCode: exchange.response?.status ?? null,
      responseTimeMs: exchange.response?.durationMs ?? null,
      redactedKeys: exchange.request.payload.redactedKeys,
      responseMarkers: exchange.response?.bodyMarkers ?? [],
      requestPreview: exchange.request.payload.raw ?? 'No request body',
      responsePreview: exchange.response?.bodyPreview ?? 'No text response body',
    }));
}

function buildResponseTimes(candidates: DiscoveryCandidate[], exchanges: NetworkExchange[]): ResponseTimeRow[] {
  return candidates.map(candidate => {
    const matching = exchanges.filter(exchange => {
      if (exchange.classification.kind !== 'candidate') {
        return false;
      }

      return exchange.method === candidate.method && exchange.normalizedPath === candidate.normalizedPath && determineVariant(exchange.request.payload.fields) === candidate.variant;
    });

    const durations = matching
      .map(exchange => exchange.response?.durationMs)
      .filter((duration): duration is number => typeof duration === 'number');

    return {
      method: candidate.method,
      endpoint: candidate.normalizedPath,
      variant: candidate.variant,
      calls: durations.length,
      avgMs: average(durations),
      minMs: durations.length > 0 ? Math.min(...durations) : 0,
      maxMs: durations.length > 0 ? Math.max(...durations) : 0,
    };
  });
}

function buildStatusCodeDistribution(exchanges: NetworkExchange[]): Array<{ statusCode: number; count: number }> {
  const counts = new Map<number, number>();

  for (const exchange of exchanges) {
    if (exchange.classification.kind !== 'candidate' || exchange.response?.status === undefined) {
      continue;
    }

    counts.set(exchange.response.status, (counts.get(exchange.response.status) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([statusCode, count]) => ({ statusCode, count }))
    .sort((left, right) => left.statusCode - right.statusCode);
}

function buildCapabilityAssessment(input: {
  uiScenariosExecuted: number;
  networkTraffic: NetworkTrafficReport;
  discovery: DiscoveryReport;
  endpointCoverageRows: EndpointCoverageRow[];
  negativeSpecs: FlattenedSpec[];
  executionCounts: ExecutionCounts;
}): CapabilityAssessment[] {
  const covered = input.endpointCoverageRows.filter(row => row.generatedTestCases.length > 0).length;

  return [
    {
      capability: 'UI execution and discovery',
      status: input.uiScenariosExecuted > 0 ? 'ready' : 'not_exercised',
      evidence: `${input.uiScenariosExecuted} UI scenario executed and ${input.networkTraffic.totalEntries} requests captured.`,
    },
    {
      capability: 'Sensitive-data redaction',
      status: input.discovery.candidates.some(candidate => candidate.sampleRequestBody.redactedKeys.length > 0) ? 'ready' : 'partial',
      evidence: 'Request payloads and response bodies in captured evidence remain redacted for csrf, password, cookie, and token values.',
    },
    {
      capability: 'API discovery to generated test conversion',
      status: covered === input.discovery.candidates.length ? 'ready' : 'partial',
      evidence: `${covered} of ${input.discovery.candidates.length} discovered candidate APIs map to generated automated coverage.`,
    },
    {
      capability: 'Negative-path validation',
      status: input.negativeSpecs.length > 0 ? 'ready' : 'partial',
      evidence: `${input.negativeSpecs.length} negative scenarios executed in the current run.`,
    },
    {
      capability: 'Failure and blocked-test evidence',
      status: input.executionCounts.failed > 0 || input.executionCounts.blocked > 0 ? 'ready' : 'not_exercised',
      evidence: input.executionCounts.failed > 0 || input.executionCounts.blocked > 0
        ? 'Failure or blocked evidence was captured in this run.'
        : 'Failure screenshots and blocked-test evidence are configured, but this run completed without failed or blocked tests.',
    },
  ];
}

function matchGeneratedSpecs(candidate: DiscoveryCandidate, generatedSpecs: FlattenedSpec[]): string[] {
  return generatedSpecs
    .filter(spec => generatedSpecMatchesCandidate(spec.title, candidate))
    .map(spec => spec.title);
}

function generatedSpecMatchesCandidate(title: string, candidate: DiscoveryCandidate): boolean {
  const normalizedTitle = title.toLowerCase();

  if (candidate.normalizedPath === '/logout') {
    return false;
  }

  if (candidate.normalizedPath === '/signup' || candidate.normalizedPath === '/delete_account') {
    return normalizedTitle.includes('signup, login, and delete account');
  }

  if (candidate.normalizedPath === '/login') {
    return normalizedTitle.includes('invalid login') || normalizedTitle.includes('signup, login, and delete account');
  }

  if (candidate.normalizedPath === '/add_to_cart/{productId}' || candidate.normalizedPath === '/delete_cart/{productId}') {
    return normalizedTitle.includes('cart :: add and delete item');
  }

  return false;
}

function summarizeExecutionResult(testTitles: string[], generatedSpecs: FlattenedSpec[]): Status {
  if (testTitles.length === 0) {
    return 'not_generated';
  }

  const matched = generatedSpecs.filter(spec => testTitles.includes(spec.title));

  if (matched.some(spec => spec.status === 'failed')) {
    return 'failed';
  }

  if (matched.some(spec => spec.status === 'blocked')) {
    return 'blocked';
  }

  if (matched.some(spec => spec.status === 'skipped')) {
    return 'skipped';
  }

  return 'passed';
}

function determineVariant(payloadFields: Record<string, string>): string {
  return payloadFields.form_type ?? 'default';
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function formatRequest(method: string, pathName: string, query: Record<string, string>): string {
  const queryString = new URLSearchParams(query).toString();
  return `${method} ${pathName}${queryString ? `?${queryString}` : ''}`;
}

function renderCoverageMatrixMarkdown(rows: CoverageRow[]): string {
  return [
    '# Coverage matrix',
    '',
    '| Suite | Tags | Focus | Validations |',
    '| --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.suite} | ${row.tags.join(', ')} | ${row.focus} | ${row.validations.join(', ')} |`),
  ].join('\n');
}

function renderExecutionSummaryMarkdown(suites: SuiteRecord[]): string {
  return [
    '# Test execution summary',
    '',
    '| Suite | Command | Status | Passed | Failed | Flaky | Skipped | Duration (ms) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...suites.map(suite => `| ${suite.suite} | ${suite.command} | ${suite.status} | ${suite.expected} | ${suite.unexpected} | ${suite.flaky} | ${suite.skipped} | ${suite.durationMs} |`),
  ].join('\n');
}

function renderTraceabilityMatrixMarkdown(rows: TraceabilityRow[]): string {
  return [
    '# Traceability matrix',
    '',
    '| UI Action | Captured Network Request | Discovered API | Generated Test Case | Execution Result |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${escapeMarkdown(row.uiAction)} | ${escapeMarkdown(row.capturedNetworkRequest)} | ${escapeMarkdown(row.discoveredApi)} | ${escapeMarkdown(row.generatedTestCase)} | ${row.executionResult} |`),
  ].join('\n');
}

function renderCustomHtmlReport(report: ReportSummary, coverageRowsData: CoverageRow[], suites: SuiteRecord[]): string {
  const endpointCoveragePercent = percentage(report.coverage.endpointCoverage.coveredCandidates, report.coverage.endpointCoverage.totalCandidates);
  const uniqueEndpointCoveragePercent = percentage(report.coverage.endpointCoverage.coveredEndpoints, report.coverage.endpointCoverage.totalEndpoints);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ui-api Phase 6 execution report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --panel: #ffffff;
      --border: #d1d5db;
      --text: #111827;
      --muted: #4b5563;
      --accent: #2563eb;
      --good: #047857;
      --bad: #b91c1c;
      --warn: #b45309;
    }
    body { font-family: Arial, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 24px; }
    h1, h2, h3 { margin-bottom: 8px; }
    p, li { color: var(--muted); }
    .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
    .metric { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; }
    .metric h3 { margin: 0 0 6px 0; font-size: 14px; color: var(--accent); }
    .metric strong { font-size: 28px; color: var(--text); }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid var(--border); padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .passed, .ready { color: var(--good); font-weight: 700; }
    .failed { color: var(--bad); font-weight: 700; }
    .partial, .blocked, .not_generated { color: var(--warn); font-weight: 700; }
    .skipped, .not_exercised { color: var(--muted); font-weight: 700; }
    code, pre { font-family: Menlo, Monaco, monospace; }
    pre { background: #111827; color: #f9fafb; padding: 12px; overflow: auto; border-radius: 10px; white-space: pre-wrap; }
    .small { font-size: 12px; }
    .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; background: #e5e7eb; margin-right: 6px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="panel">
    <h1>Phase 6 reporting summary</h1>
    <p>Generated ${escapeHtml(report.generatedAt)} for ${escapeHtml(report.environment ?? 'unknown environment')} against ${escapeHtml(report.baseURL ?? 'unknown base URL')}.</p>
  </div>

  <div class="panel">
    <h2>Top-level metrics</h2>
    <div class="grid">
      <div class="metric"><h3>Total UI scenarios executed</h3><strong>${report.totals.uiScenariosExecuted}</strong></div>
      <div class="metric"><h3>Total network requests captured</h3><strong>${report.totals.networkRequestsCaptured}</strong></div>
      <div class="metric"><h3>Total unique APIs discovered</h3><strong>${report.totals.uniqueApisDiscovered}</strong></div>
      <div class="metric"><h3>Unique discovered endpoints</h3><strong>${report.totals.uniqueDiscoveredEndpoints}</strong></div>
      <div class="metric"><h3>APIs converted to automated tests</h3><strong>${report.totals.apisConvertedToAutomatedTests}</strong></div>
      <div class="metric"><h3>Excluded requests</h3><strong>${report.totals.excludedApis}</strong></div>
      <div class="metric"><h3>Generated API scenarios</h3><strong>${report.totals.generatedApiScenarios}</strong></div>
      <div class="metric"><h3>Full execution duration</h3><strong>${formatDuration(report.execution.fullSuiteDurationMs)}</strong></div>
    </div>
  </div>

  <div class="panel">
    <h2>Execution status</h2>
    <div class="grid">
      <div class="metric"><h3>Passed tests</h3><strong>${report.execution.passed}</strong></div>
      <div class="metric"><h3>Failed tests</h3><strong>${report.execution.failed}</strong></div>
      <div class="metric"><h3>Skipped tests</h3><strong>${report.execution.skipped}</strong></div>
      <div class="metric"><h3>Blocked tests</h3><strong>${report.execution.blocked}</strong></div>
      <div class="metric"><h3>Aggregate recorded duration</h3><strong>${formatDuration(report.execution.aggregateRecordedDurationMs)}</strong></div>
    </div>
    <table>
      <thead>
        <tr><th>Suite</th><th>Command</th><th>Status</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Skipped</th><th>Duration (ms)</th></tr>
      </thead>
      <tbody>
        ${suites.map(suite => `<tr><td>${escapeHtml(suite.suite)}</td><td>${escapeHtml(suite.command)}</td><td class="${suite.status}">${suite.status}</td><td>${suite.expected}</td><td>${suite.unexpected}</td><td>${suite.flaky}</td><td>${suite.skipped}</td><td>${suite.durationMs}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>Coverage</h2>
    <p>Functional coverage: <strong>${report.coverage.functional.passed}/${report.coverage.functional.total}</strong>. Negative coverage: <strong>${report.coverage.negative.passed}/${report.coverage.negative.total}</strong>.</p>
    <p>Candidate endpoint coverage: <strong>${report.coverage.endpointCoverage.coveredCandidates}/${report.coverage.endpointCoverage.totalCandidates}</strong> (${endpointCoveragePercent}%). Unique endpoint coverage: <strong>${report.coverage.endpointCoverage.coveredEndpoints}/${report.coverage.endpointCoverage.totalEndpoints}</strong> (${uniqueEndpointCoveragePercent}%).</p>
    <table>
      <thead>
        <tr><th>Candidate ID</th><th>Method</th><th>Endpoint</th><th>Variant</th><th>Generated test cases</th><th>Execution result</th></tr>
      </thead>
      <tbody>
        ${report.endpointCoverageRows.map(row => `<tr><td>${escapeHtml(row.candidateId)}</td><td>${escapeHtml(row.method)}</td><td>${escapeHtml(row.normalizedPath)}</td><td>${escapeHtml(row.variant)}</td><td>${row.generatedTestCases.length > 0 ? escapeHtml(row.generatedTestCases.join(' | ')) : 'Not generated'}</td><td class="${row.executionResult}">${row.executionResult}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>Status-code distribution</h2>
    <table>
      <thead>
        <tr><th>Status code</th><th>Count</th></tr>
      </thead>
      <tbody>
        ${report.distributions.statusCodes.map(row => `<tr><td>${row.statusCode}</td><td>${row.count}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>Excluded requests with reasons</h2>
    <table>
      <thead>
        <tr><th>Reason</th><th>Count</th><th>Sample requests</th></tr>
      </thead>
      <tbody>
        ${report.excludedSummary.map(row => `<tr><td>${escapeHtml(row.reason)}</td><td>${row.count}</td><td>${escapeHtml(row.sampleRequests.join(' | '))}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>API response times</h2>
    <table>
      <thead>
        <tr><th>Method</th><th>Endpoint</th><th>Variant</th><th>Calls</th><th>Avg (ms)</th><th>Min (ms)</th><th>Max (ms)</th></tr>
      </thead>
      <tbody>
        ${report.responseTimes.map(row => `<tr><td>${escapeHtml(row.method)}</td><td>${escapeHtml(row.endpoint)}</td><td>${escapeHtml(row.variant)}</td><td>${row.calls}</td><td>${row.avgMs}</td><td>${row.minMs}</td><td>${row.maxMs}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>Request and response evidence</h2>
    <p>Evidence previews remain sanitized. Sensitive fields such as password, csrf, token, authorization, cookie, and set-cookie are redacted before reporting.</p>
    <table>
      <thead>
        <tr><th>UI action</th><th>Request</th><th>Status</th><th>Response time (ms)</th><th>Redacted keys</th><th>Response markers</th><th>Request preview</th><th>Response preview</th></tr>
      </thead>
      <tbody>
        ${report.evidenceRows.map(row => `<tr><td>${escapeHtml(row.uiAction)}</td><td>${escapeHtml(row.request)}</td><td>${row.statusCode ?? 'n/a'}</td><td>${row.responseTimeMs ?? 'n/a'}</td><td>${escapeHtml(row.redactedKeys.join(', ') || 'none')}</td><td>${escapeHtml(row.responseMarkers.join(', ') || 'none')}</td><td><code>${escapeHtml(row.requestPreview)}</code></td><td><code>${escapeHtml(row.responsePreview)}</code></td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>Traceability matrix</h2>
    <table>
      <thead>
        <tr><th>UI Action</th><th>Captured Network Request</th><th>Discovered API</th><th>Generated Test Case</th><th>Execution Result</th></tr>
      </thead>
      <tbody>
        ${report.traceabilityMatrix.map(row => `<tr><td>${escapeHtml(row.uiAction)}</td><td>${escapeHtml(row.capturedNetworkRequest)}</td><td>${escapeHtml(row.discoveredApi)}</td><td>${escapeHtml(row.generatedTestCase)}</td><td class="${row.executionResult}">${row.executionResult}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>Screenshots and failure details</h2>
    ${report.failureDetails.length === 0
      ? '<p>No failed or blocked tests were recorded in the current execution, so no failure screenshots were required.</p>'
      : `<table><thead><tr><th>Test case</th><th>Status</th><th>Errors</th><th>Attachments</th></tr></thead><tbody>${report.failureDetails.map(detail => `<tr><td>${escapeHtml(detail.testCase)}</td><td class="${detail.status}">${detail.status}</td><td>${escapeHtml(detail.errors.join(' | ') || 'none')}</td><td>${escapeHtml(detail.attachments.join(' | ') || 'none')}</td></tr>`).join('')}</tbody></table>`}
    <p class="small">Related evidence files are available under <code>test-results/</code>, including <code>network-traffic.json</code>, <code>api-discovery.json</code>, <code>browser-events.json</code>, and <code>api-log.json</code>.</p>
  </div>

  <div class="panel">
    <h2>Coverage matrix reference</h2>
    <table>
      <thead>
        <tr><th>Suite</th><th>Tags</th><th>Focus</th><th>Validations</th></tr>
      </thead>
      <tbody>
        ${coverageRowsData.map(row => `<tr><td>${escapeHtml(row.suite)}</td><td>${escapeHtml(row.tags.join(', '))}</td><td>${escapeHtml(row.focus)}</td><td>${escapeHtml(row.validations.join(', '))}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="panel">
    <h2>Final agent capability assessment</h2>
    <table>
      <thead>
        <tr><th>Capability</th><th>Status</th><th>Evidence</th></tr>
      </thead>
      <tbody>
        ${report.capabilityAssessment.map(item => `<tr><td>${escapeHtml(item.capability)}</td><td class="${item.status}">${item.status}</td><td>${escapeHtml(item.evidence)}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

function percentage(value: number, total: number): string {
  if (total === 0) {
    return '0.0';
  }

  return ((value / total) * 100).toFixed(1);
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return 'n/a';
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('|', '\\|');
}

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

void main();
