import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type PlaywrightSpec = {
  title?: string;
  specs?: Array<{ title: string; tests: Array<{ status: string; results: Array<{ status: string; duration: number }> }> }>;
  suites?: PlaywrightSpec[];
};

type CucumberFeature = {
  name: string;
  elements?: Array<{
    name: string;
    tags?: Array<{ name: string }>;
    steps?: Array<{ result?: { status?: string; duration?: number } }>;
  }>;
};

type ExecutionEntry = {
  framework: 'Non-BDD' | 'BDD';
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'unknown';
  durationMs: number;
  isE2E: boolean;
};

const safeReadJson = <T>(filePath: string, fallback: T): T => {
  if (!existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
};

const mapPlaywrightStatus = (status: string | undefined): ExecutionEntry['status'] => {
  if (['expected', 'passed'].includes(status || '')) {
    return 'passed';
  }

  if (status === 'skipped') {
    return 'skipped';
  }

  if (status) {
    return 'failed';
  }

  return 'unknown';
};

const dedupeEntries = (entries: ExecutionEntry[]): ExecutionEntry[] => {
  return Array.from(new Map(entries.map((entry) => [`${entry.framework}:${entry.title}`, entry])).values());
};

const buildSummary = (entries: ExecutionEntry[]) => ({
  total: entries.length,
  passed: entries.filter((entry) => entry.status === 'passed').length,
  failed: entries.filter((entry) => entry.status === 'failed').length,
  skipped: entries.filter((entry) => entry.status === 'skipped').length,
});

const flattenPlaywrightSuites = (suite: PlaywrightSpec, results: ExecutionEntry[]): void => {
  suite.specs?.forEach((spec) => {
    const test = spec.tests[0];
    const durationMs = (test?.results || []).reduce((total, result) => total + (result.duration || 0), 0);
    results.push({
      framework: 'Non-BDD',
      title: spec.title,
      status: mapPlaywrightStatus(test?.status || test?.results?.at(-1)?.status),
      durationMs,
      isE2E: Boolean(spec.title?.includes('[E2E]')),
    });
  });

  suite.suites?.forEach((child) => flattenPlaywrightSuites(child, results));
};

const summarizePlaywright = () => {
  const payload = safeReadJson<{ suites?: PlaywrightSpec[] }>(path.resolve(process.cwd(), 'test-results/results.json'), {});
  const tests: ExecutionEntry[] = [];
  payload.suites?.forEach((suite) => flattenPlaywrightSuites(suite, tests));
  const entries = dedupeEntries(tests);

  return {
    ...buildSummary(entries),
    e2e: buildSummary(entries.filter((entry) => entry.isE2E)),
    regression: buildSummary(entries.filter((entry) => !entry.isE2E)),
    tests: entries,
  };
};

const summarizeCucumber = () => {
  const payload = safeReadJson<CucumberFeature[]>(path.resolve(process.cwd(), 'bdd-results/cucumber-report.json'), []);
  const scenarios = payload.flatMap((feature) =>
    (feature.elements || []).map((scenario) => {
      const stepStatuses = (scenario.steps || []).map((step) => step.result?.status || 'unknown');
      const totalDurationNs = (scenario.steps || []).reduce((total, step) => total + (step.result?.duration || 0), 0);
      const status: ExecutionEntry['status'] = stepStatuses.some((value) => ['failed', 'ambiguous', 'undefined'].includes(value))
        ? 'failed'
        : stepStatuses.length > 0 && stepStatuses.every((value) => value === 'passed')
          ? 'passed'
          : stepStatuses.every((value) => value === 'skipped' || value === 'pending')
          ? 'skipped'
          : 'unknown';

      return {
        framework: 'BDD' as const,
        title: `${feature.name} / ${scenario.name}`,
        status,
        durationMs: Math.round(totalDurationNs / 1_000_000),
        isE2E: Boolean((scenario.tags || []).some((tag) => tag.name === '@e2e-new')),
      };
    })
  );
  const entries = dedupeEntries(scenarios);

  return {
    ...buildSummary(entries),
    e2e: buildSummary(entries.filter((entry) => entry.isE2E)),
    regression: buildSummary(entries.filter((entry) => !entry.isE2E)),
    scenarios: entries,
  };
};

const readRequestLogs = () => {
  const directory = path.resolve(process.cwd(), 'artifacts/request-logs');
  if (!existsSync(directory)) {
    return [] as Array<Record<string, unknown>>;
  }

  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.jsonl'))
    .flatMap((fileName) =>
      readFileSync(path.join(directory, fileName), 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
    );
};

const main = (): void => {
  const inventory = safeReadJson<Record<string, unknown>>(path.resolve(process.cwd(), 'artifacts/discovery/operation-inventory.json'), {});
  const nonBdd = summarizePlaywright();
  const bdd = summarizeCucumber();
  const requestLogs = readRequestLogs();
  const consolidatedEntries = dedupeEntries([...nonBdd.tests, ...bdd.scenarios]);
  const consolidatedE2E = consolidatedEntries.filter((entry) => entry.isE2E);
  const outputDir = path.resolve(process.cwd(), 'custom-report');
  mkdirSync(outputDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    endpoint: 'https://rickandmortyapi.com/graphql',
    discovery: inventory,
    nonBdd,
    bdd,
    consolidatedE2E: {
      ...buildSummary(consolidatedE2E),
      entries: consolidatedE2E,
    },
    requestLogs,
    comparison: {
      bothPassed: nonBdd.failed === 0 && bdd.failed === 0,
      nonBddExecuted: nonBdd.total,
      bddExecuted: bdd.total,
    },
    customReportingLimitations: [
      'The public GraphQL API returns HTTP 200 for both successful and error responses, so the report must inspect GraphQL errors and data together.',
      'Schema discovery required several shallow introspection calls because the endpoint enforces an introspection depth limit.',
      'Allure raw result files are generated, but merged Allure HTML is not produced automatically without the Allure CLI.',
    ],
  };

  writeFileSync(path.join(outputDir, 'graphql-execution-report.json'), JSON.stringify(report, null, 2), 'utf-8');
  writeFileSync(
    path.join(outputDir, 'graphql-execution-report.md'),
    [
      '# GraphQL execution report',
      '',
      `- Endpoint: ${report.endpoint}`,
      `- Generated at: ${report.generatedAt}`,
      `- Non-BDD: ${nonBdd.passed} passed / ${nonBdd.failed} failed / ${nonBdd.skipped} skipped (${nonBdd.total} total)` ,
      `- BDD: ${bdd.passed} passed / ${bdd.failed} failed / ${bdd.skipped} skipped (${bdd.total} total)`,
      `- New E2E Non-BDD: ${nonBdd.e2e.passed} passed / ${nonBdd.e2e.failed} failed / ${nonBdd.e2e.skipped} skipped (${nonBdd.e2e.total} total)`,
      `- New E2E BDD: ${bdd.e2e.passed} passed / ${bdd.e2e.failed} failed / ${bdd.e2e.skipped} skipped (${bdd.e2e.total} total)`,
      `- Existing regression Non-BDD: ${nonBdd.regression.passed} passed / ${nonBdd.regression.failed} failed / ${nonBdd.regression.skipped} skipped (${nonBdd.regression.total} total)`,
      `- Existing regression BDD: ${bdd.regression.passed} passed / ${bdd.regression.failed} failed / ${bdd.regression.skipped} skipped (${bdd.regression.total} total)`,
      '',
      '## Consolidated E2E entries',
      ...consolidatedE2E.map((entry) => `- [${entry.framework}] ${entry.title}: ${entry.status}, ${entry.durationMs}ms`),
      '',
      '## Request log sample',
      ...requestLogs.slice(0, 10).map((entry) => `- [${entry.runner}] ${entry.operationName}: HTTP ${entry.httpStatus}, ${entry.responseTimeMs}ms, errors=${Array.isArray(entry.graphqlErrors) ? entry.graphqlErrors.length : 0}`),
      '',
      '## Reporting limitations',
      ...report.customReportingLimitations.map((item) => `- ${item}`),
      '',
    ].join('\n'),
    'utf-8'
  );
};

main();
