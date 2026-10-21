export class ResponseStore<TValue = unknown> {
  private readonly store = new Map<string, TValue>();

  set(key: string, value: TValue): void {
    this.store.set(key, value);
  }

  get(key: string): TValue | undefined {
    return this.store.get(key);
  }

  require(key: string): TValue {
    const value = this.store.get(key);

    if (value === undefined) {
      throw new Error(`ResponseStore key not found: ${key}`);
    }

    return value;
  }

  clear(): void {
    this.store.clear();
  }
}
