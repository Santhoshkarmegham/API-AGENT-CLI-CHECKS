import { APIResponse, expect } from '@playwright/test';

export class ApiResponseValidator {
  static expectStatus(response: APIResponse, allowedStatuses: number[]): void {
    expect(allowedStatuses).toContain(response.status());
  }

  static expectJson(response: APIResponse): void {
    expect(response.headers()['content-type'] ?? '').toContain('application/json');
  }

  static async parseJson<T>(response: APIResponse, allowedStatuses: number[]): Promise<T> {
    this.expectStatus(response, allowedStatuses);
    this.expectJson(response);
    return (await response.json()) as T;
  }

  static async expectNoContent(response: APIResponse, expectedStatus = 204): Promise<void> {
    expect(response.status()).toBe(expectedStatus);
    expect(await response.text()).toBe('');
  }
}
