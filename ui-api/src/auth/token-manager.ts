import type { APIRequestContext } from '@playwright/test';

import type { EnvironmentConfig } from '../types/common';
import type { ApiLogger } from '../utils/api-logger';

export class TokenManager {
  private readonly csrfCache = new Map<string, string>();

  constructor(
    private readonly request: APIRequestContext,
    private readonly environment: EnvironmentConfig,
    private readonly logger: ApiLogger,
  ) {}

  async getCsrfToken(path: string, forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.csrfCache.has(path)) {
      return this.csrfCache.get(path)!;
    }

    const response = await this.request.get(path, {
      headers: {
        Referer: `${this.environment.uiBaseURL}${path}`,
      },
    });
    const html = await response.text();
    const match = html.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i);

    if (!match) {
      throw new Error(`Could not extract csrfmiddlewaretoken from ${path}`);
    }

    this.csrfCache.set(path, match[1]);
    this.logger.info('csrf_token_resolved', { path });

    return match[1];
  }

  async getCookieNames(): Promise<string[]> {
    const storage = await this.request.storageState();

    return storage.cookies
      .filter(cookie => cookie.domain.includes('automationexercise.com'))
      .map(cookie => cookie.name)
      .sort();
  }

  async getSessionDependencies(): Promise<string[]> {
    const cookieNames = await this.getCookieNames();
    return cookieNames.map(cookieName => `cookie:${cookieName}`);
  }

  clearCsrf(path?: string): void {
    if (path) {
      this.csrfCache.delete(path);
      return;
    }

    this.csrfCache.clear();
  }
}
