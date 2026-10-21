export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EnvironmentConfig {
  name: string;
  baseURL: string;
  uiBaseURL: string;
  requestTimeout: number;
  retries: number;
  workers: number;
  fullyParallel: boolean;
}

export interface RequestBuilderOptions {
  method: HttpMethod;
  path: string;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  json?: unknown;
  form?: Record<string, string>;
  refererPath?: string;
  maxRedirects?: number;
}

export interface ResponseSnapshot {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  contentType: string;
  body: string;
  durationMs: number;
  redirectLocation?: string | null;
}

export interface RequestLogDetails {
  method: HttpMethod;
  path: string;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  form?: Record<string, string>;
  json?: unknown;
}
