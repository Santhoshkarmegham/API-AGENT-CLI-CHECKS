import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type RunStatus = 'passed' | 'failed' | 'flaky';

type SuiteRecord = {
  suite: string;
  command: string;
  generatedAt: string;
  status: RunStatus;
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(__dirname, '../..');
  const resultsPath = path.join(projectRoot, 'test-results', 'results.json');
  const deliverablesDir = path.join(projectRoot, 'deliverables');
  const summaryPath = path.join(deliverablesDir, 'run-status.json');

  if (!args.suite || !args.command) {
    throw new Error('Usage: npm run record:suite -- --suite <name> --command "npm run ..."');
  }

  const results = JSON.parse(await readFile(resultsPath, 'utf-8')) as {
    stats: {
      expected: number;
      unexpected: number;
      flaky: number;
      skipped: number;
      duration: number;
      startTime: string;
    };
  };

  const nextRecord: SuiteRecord = {
    suite: args.suite,
    command: args.command,
    generatedAt: results.stats.startTime,
    status: determineStatus(results.stats),
    expected: results.stats.expected,
    unexpected: results.stats.unexpected,
    flaky: results.stats.flaky,
    skipped: results.stats.skipped,
    durationMs: Math.round(results.stats.duration),
  };

  await mkdir(deliverablesDir, { recursive: true });

  const existing = await readJsonIfPresent<StoredSummary>(summaryPath);
  const suites = (existing?.suites ?? []).filter(suite => suite.suite !== nextRecord.suite);
  suites.push(nextRecord);

  const nextSummary: StoredSummary = {
    updatedAt: new Date().toISOString(),
    suites: suites.sort((left, right) => left.suite.localeCompare(right.suite)),
  };

  await writeFile(summaryPath, JSON.stringify(nextSummary, null, 2), 'utf-8');
}

function determineStatus(stats: { unexpected: number; flaky: number }): RunStatus {
  if (stats.unexpected > 0) {
    return 'failed';
  }

  if (stats.flaky > 0) {
    return 'flaky';
  }

  return 'passed';
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]?.replace(/^--/, '');
    const value = args[index + 1];

    if (key && value) {
      parsed[key] = value;
    }
  }

  return parsed;
}

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

void main();
