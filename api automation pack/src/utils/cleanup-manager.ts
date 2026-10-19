export class CleanupManager {
  private readonly tasks: Array<() => Promise<void>> = [];

  add(task: () => Promise<void>): void {
    this.tasks.push(task);
  }

  async runAll(): Promise<void> {
    const failures: Error[] = [];

    for (const task of [...this.tasks].reverse()) {
      try {
        await task();
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.tasks.length = 0;

    if (failures.length > 0) {
      throw new Error(`Cleanup failed: ${failures.map((failure) => failure.message).join('; ')}`);
    }
  }
}
