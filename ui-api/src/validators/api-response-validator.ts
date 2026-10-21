import type { APIResponse } from '@playwright/test';

import type { ResponseSnapshot } from '../types/common';

export class ApiResponseValidator {
  static async capture(response: APIResponse, durationMs = 0): Promise<ResponseSnapshot> {
    const headers = response.headers();
    const body = await response.text();

    return {
      status: response.status(),
      statusText: response.statusText(),
      headers,
      contentType: this.normalizeContentType(headers['content-type']),
      body,
      durationMs,
      redirectLocation: headers.location ?? null,
    };
  }

  static assertStatus(response: ResponseSnapshot, expected: number | number[]): void {
    const expectedStatuses = Array.isArray(expected) ? expected : [expected];

    if (!expectedStatuses.includes(response.status)) {
      throw new Error(`Expected status ${expectedStatuses.join(', ')} but received ${response.status}`);
    }
  }

  static assertContentType(response: ResponseSnapshot, expected: string): void {
    if (response.contentType !== expected) {
      throw new Error(`Expected content type ${expected} but received ${response.contentType}`);
    }
  }

  static assertHeaderPresent(response: ResponseSnapshot, headerName: string): void {
    if (!response.headers[headerName.toLowerCase()]) {
      throw new Error(`Expected header ${headerName} to be present`);
    }
  }

  static assertRedirectLocation(response: ResponseSnapshot, expectedLocation: string): void {
    if (response.redirectLocation !== expectedLocation) {
      throw new Error(`Expected redirect location ${expectedLocation} but received ${response.redirectLocation}`);
    }
  }

  static assertBodyContains(response: ResponseSnapshot, markers: string[]): void {
    for (const marker of markers) {
      if (!response.body.includes(marker)) {
        throw new Error(`Expected response body to contain marker: ${marker}`);
      }
    }
  }

  static assertBodyNotContains(response: ResponseSnapshot, markers: string[]): void {
    for (const marker of markers) {
      if (response.body.includes(marker)) {
        throw new Error(`Expected response body not to contain marker: ${marker}`);
      }
    }
  }

  private static normalizeContentType(contentType: string | undefined): string {
    return (contentType ?? '').split(';')[0].trim().toLowerCase();
  }
}
