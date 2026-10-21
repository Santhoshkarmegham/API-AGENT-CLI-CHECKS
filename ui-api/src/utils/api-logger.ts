import { writeFile } from 'node:fs/promises';

export interface ApiLogEntry {
  timestamp: string;
  level: 'info' | 'error';
  event: string;
  details?: unknown;
}

export class ApiLogger {
  private readonly entries: ApiLogEntry[] = [];

  info(event: string, details?: unknown): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      event,
      details,
    });
  }

  error(event: string, details?: unknown): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      event,
      details,
    });
  }

  async flush(outputPath: string): Promise<void> {
    await writeFile(outputPath, JSON.stringify({ entries: this.entries }, null, 2), 'utf-8');
  }
}
