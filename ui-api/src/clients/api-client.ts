import type { APIRequestContext, APIResponse } from '@playwright/test';

import type { HttpMethod, RequestBuilderOptions, RequestLogDetails } from '../types/common';
import { ApiRequestError } from '../utils/api-error';
import type { ApiLogger } from '../utils/api-logger';
import { RequestBuilder } from './request-builder';

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly requestBuilder: RequestBuilder,
    private readonly logger: ApiLogger,
  ) {}

  async send(method: HttpMethod, path: string, options: Omit<RequestBuilderOptions, 'method' | 'path'> = {}): Promise<APIResponse> {
    const built = this.requestBuilder.build({
      method,
      path,
      ...options,
    });
    const startedAt = Date.now();

    this.logger.info('api_request', this.createRequestLog(method, path, options));

    try {
      const response = await this.request.fetch(built.path, built.requestOptions);

      this.logger.info('api_response', {
        method,
        path,
        status: response.status(),
        durationMs: Date.now() - startedAt,
        headers: response.headers(),
      });

      return response;
    } catch (error) {
      this.logger.error('api_request_failed', {
        method,
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApiRequestError(`API request failed for ${method} ${path}`, method, path, error);
    }
  }

  async get(path: string, options: Omit<RequestBuilderOptions, 'method' | 'path'> = {}): Promise<APIResponse> {
    return this.send('GET', path, options);
  }

  async postForm(path: string, form: Record<string, string>, options: Omit<RequestBuilderOptions, 'method' | 'path' | 'form' | 'json'> = {}): Promise<APIResponse> {
    return this.send('POST', path, { ...options, form });
  }

  private createRequestLog(method: HttpMethod, path: string, options: Omit<RequestBuilderOptions, 'method' | 'path'>): RequestLogDetails {
    return {
      method,
      path,
      params: options.params,
      headers: options.headers,
      form: options.form,
      json: options.json,
    };
  }
}
