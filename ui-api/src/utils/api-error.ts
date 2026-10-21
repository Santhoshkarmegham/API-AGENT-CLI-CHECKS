import type { HttpMethod } from '../types/common';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly method: HttpMethod,
    public readonly path: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}
