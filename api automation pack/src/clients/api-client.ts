import { APIRequestContext, APIResponse } from '@playwright/test';

import { TokenManager } from '../auth/token-manager';
import { ApiResponseValidator } from '../utils/api-response-validator';

type RequestOptions = {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
};

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly tokenManager?: TokenManager
  ) {}

  private async buildHeaders(options?: RequestOptions): Promise<Record<string, string>> {
    const authHeaders = options?.auth ? await this.tokenManager?.getAuthHeaders() ?? {} : {};

    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    };
  }

  async send(method: string, path: string, options?: RequestOptions): Promise<APIResponse> {
    const headers = await this.buildHeaders(options);

    return this.request.fetch(path, {
      method,
      params: options?.params,
      data: options?.data,
      headers,
    });
  }

  async get(path: string, params?: Record<string, string | number | boolean>): Promise<APIResponse> {
    return this.send('GET', path, { params });
  }

  async post(path: string, data: unknown, options?: Omit<RequestOptions, 'data' | 'params'>): Promise<APIResponse> {
    return this.send('POST', path, { ...options, data });
  }

  async put(path: string, data: unknown, options?: Omit<RequestOptions, 'data' | 'params'>): Promise<APIResponse> {
    return this.send('PUT', path, { ...options, data });
  }

  async patch(path: string, data: unknown, options?: Omit<RequestOptions, 'data' | 'params'>): Promise<APIResponse> {
    return this.send('PATCH', path, { ...options, data });
  }

  async delete(path: string, options?: Omit<RequestOptions, 'data' | 'params'>): Promise<APIResponse> {
    return this.send('DELETE', path, options);
  }

  async assertSuccessfulJson<T>(response: APIResponse, expectedStatus = 200): Promise<T> {
    return ApiResponseValidator.parseJson<T>(response, [expectedStatus]);
  }
}
