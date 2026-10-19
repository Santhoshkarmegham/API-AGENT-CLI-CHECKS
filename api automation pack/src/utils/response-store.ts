export class ResponseStore {
  private readonly store = new Map<string, unknown>();

  set<T>(key: string, value: T): T {
    this.store.set(key, value);
    return value;
  }

  get<T>(key: string): T {
    if (!this.store.has(key)) {
      throw new Error(`ResponseStore key not found: ${key}`);
    }

    return this.store.get(key) as T;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}
