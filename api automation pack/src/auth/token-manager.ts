import { APIRequestContext, expect } from '@playwright/test';

import type { AuthConfig } from '../config/env';

const readByPath = (value: unknown, pathExpression: string): unknown =>
  pathExpression.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, value);

export class TokenManager {
  private cachedToken?: string;

  constructor(
    private readonly request: APIRequestContext,
    private readonly authConfig: AuthConfig
  ) {}

  async getAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
    if (!this.authConfig.enabled) {
      return {};
    }

    if (!forceRefresh && this.cachedToken) {
      return { Authorization: `Bearer ${this.cachedToken}` };
    }

    const token = await this.resolveToken(forceRefresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  clear(): void {
    this.cachedToken = undefined;
  }

  private async resolveToken(forceRefresh: boolean): Promise<string | undefined> {
    const tokenFromEnv = this.authConfig.tokenEnv ? process.env[this.authConfig.tokenEnv] : undefined;
    if (tokenFromEnv) {
      this.cachedToken = tokenFromEnv;
      return tokenFromEnv;
    }

    if (!forceRefresh && this.cachedToken) {
      return this.cachedToken;
    }

    const username = this.authConfig.usernameEnv ? process.env[this.authConfig.usernameEnv] : undefined;
    const password = this.authConfig.passwordEnv ? process.env[this.authConfig.passwordEnv] : undefined;

    if (!username || !password || !this.authConfig.loginPath) {
      return undefined;
    }

    const response = await this.request.post(this.authConfig.loginPath, {
      data: { username, password },
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as unknown;
    const token = readByPath(body, this.authConfig.tokenJsonPath || 'token');
    expect(typeof token).toBe('string');
    this.cachedToken = token as string;
    return this.cachedToken;
  }
}
