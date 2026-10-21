import type { EnvironmentConfig, RequestBuilderOptions } from '../types/common';

export class RequestBuilder {
  constructor(private readonly environment: EnvironmentConfig) {}

  build(options: RequestBuilderOptions): {
    path: string;
    requestOptions: Record<string, unknown>;
  } {
    const headers: Record<string, string> = {
      Accept: '*/*',
      Origin: this.environment.uiBaseURL,
      Referer: `${this.environment.uiBaseURL}${options.refererPath ?? options.path}`,
      ...options.headers,
    };

    const requestOptions: Record<string, unknown> = {
      method: options.method,
      headers,
      timeout: this.environment.requestTimeout,
    };

    if (options.params) {
      requestOptions.params = options.params;
    }

    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      requestOptions.data = new URLSearchParams(options.form).toString();
    }

    if (options.json) {
      headers['Content-Type'] = 'application/json';
      requestOptions.data = options.json;
    }

    if (options.maxRedirects !== undefined) {
      requestOptions.maxRedirects = options.maxRedirects;
    }

    return {
      path: options.path,
      requestOptions,
    };
  }
}
