import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type DiscoveryCandidate = {
  id: string;
  module: string;
  method: string;
  normalizedPath: string;
  variant: string;
  samplePath: string;
  sampleQuery: Record<string, string>;
  sampleRequestBody: { fields: Record<string, string> };
  uiActions: string[];
  observedStatusCodes: number[];
  observedContentTypes: string[];
  authHeaderNames: string[];
  requestCookieNames: string[];
  correlationHeaderNames: string[];
};

type DiscoveryReport = {
  generatedAt: string;
  sourceTest: string;
  candidates: DiscoveryCandidate[];
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

  const discovery = await readLatestDiscovery(projectRoot);
  const summary = await readJsonIfPresent<StoredSummary>(path.join(deliverablesDir, 'run-status.json'));

  if (!discovery) {
    throw new Error('No api-discovery.json file found under test-results. Run the UI discovery flow first.');
  }

  const inventory = buildInventory(discovery);
  const mapping = buildUiToApiMapping(discovery.candidates);

  await writeFile(path.join(deliverablesDir, 'api-inventory.json'), JSON.stringify(inventory, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'ui-to-api-discovery-mapping.json'), JSON.stringify(mapping, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'coverage-matrix.json'), JSON.stringify(coverageRows, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'coverage-matrix.md'), renderCoverageMatrixMarkdown(coverageRows), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'test-execution-summary.json'), JSON.stringify(summary ?? { updatedAt: null, suites: [] }, null, 2), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'test-execution-summary.md'), renderExecutionSummaryMarkdown(summary?.suites ?? []), 'utf-8');
  await writeFile(path.join(deliverablesDir, 'custom-report.html'), renderCustomHtmlReport(inventory, mapping, coverageRows, summary?.suites ?? []), 'utf-8');
}

async function readLatestDiscovery(projectRoot: string): Promise<DiscoveryReport | null> {
  const testResultsDir = path.join(projectRoot, 'test-results');
  const entries = await readdir(testResultsDir, { withFileTypes: true }).catch(() => []);
  const reports = await Promise.all(
    entries
      .filter(entry => entry.isDirectory())
      .map(async entry => {
        const reportPath = path.join(testResultsDir, entry.name, 'api-discovery.json');

        try {
          const report = JSON.parse(await readFile(reportPath, 'utf-8')) as DiscoveryReport;
          return report;
        } catch {
          return null;
        }
      }),
  );

  return reports
    .filter((report): report is DiscoveryReport => report !== null)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0] ?? null;
}

function buildInventory(discovery: DiscoveryReport): Record<string, unknown> {
  const modules = discovery.candidates.reduce<Record<string, Array<Record<string, unknown>>>>((accumulator, candidate) => {
    accumulator[candidate.module] ??= [];
    accumulator[candidate.module].push({
      method: candidate.method,
      endpoint: candidate.normalizedPath,
      variant: candidate.variant,
      samplePath: candidate.samplePath,
      sampleQuery: candidate.sampleQuery,
      uiActions: candidate.uiActions,
      observedStatusCodes: candidate.observedStatusCodes,
      observedContentTypes: candidate.observedContentTypes,
      requestFields: Object.keys(candidate.sampleRequestBody.fields),
      authDependencies: candidate.authHeaderNames,
      cookieDependencies: candidate.requestCookieNames,
      correlationHeaderNames: candidate.correlationHeaderNames,
    });
    return accumulator;
  }, {});

  return {
    generatedAt: discovery.generatedAt,
    sourceTest: discovery.sourceTest,
    modules,
  };
}

function buildUiToApiMapping(candidates: DiscoveryCandidate[]): Record<string, unknown> {
  const mappings = new Map<string, Array<Record<string, string>>>();

  for (const candidate of candidates) {
    for (const uiAction of candidate.uiActions) {
      const current = mappings.get(uiAction) ?? [];
      current.push({
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

function renderCustomHtmlReport(
  inventory: Record<string, unknown>,
  mapping: Record<string, unknown>,
  coverageRowsData: CoverageRow[],
  suites: SuiteRecord[],
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ui-api custom report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    pre { background: #111827; color: #f9fafb; padding: 12px; overflow: auto; }
    .passed { color: #047857; font-weight: 700; }
    .failed { color: #b91c1c; font-weight: 700; }
    .flaky { color: #b45309; font-weight: 700; }
  </style>
</head>
<body>
  <h1>ui-api custom report</h1>
  <p>Generated ${new Date().toISOString()}</p>

  <h2>Execution summary</h2>
  <table>
    <thead>
      <tr><th>Suite</th><th>Command</th><th>Status</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Skipped</th><th>Duration (ms)</th></tr>
    </thead>
    <tbody>
      ${suites.map(suite => `<tr><td>${escapeHtml(suite.suite)}</td><td>${escapeHtml(suite.command)}</td><td class="${suite.status}">${suite.status}</td><td>${suite.expected}</td><td>${suite.unexpected}</td><td>${suite.flaky}</td><td>${suite.skipped}</td><td>${suite.durationMs}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>Coverage matrix</h2>
  <table>
    <thead>
      <tr><th>Suite</th><th>Tags</th><th>Focus</th><th>Validations</th></tr>
    </thead>
    <tbody>
      ${coverageRowsData.map(row => `<tr><td>${escapeHtml(row.suite)}</td><td>${escapeHtml(row.tags.join(', '))}</td><td>${escapeHtml(row.focus)}</td><td>${escapeHtml(row.validations.join(', '))}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>API inventory</h2>
  <pre>${escapeHtml(JSON.stringify(inventory, null, 2))}</pre>

  <h2>UI-to-API discovery mapping</h2>
  <pre>${escapeHtml(JSON.stringify(mapping, null, 2))}</pre>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

void main();
