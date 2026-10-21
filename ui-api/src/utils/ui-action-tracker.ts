export class UiActionTracker {
  private currentAction: string | null = null;

  set(action: string): void {
    this.currentAction = action;
  }

  get(): string | null {
    return this.currentAction;
  }

  clear(action?: string): void {
    if (!action || this.currentAction === action) {
      this.currentAction = null;
    }
  }
}
