import { APIRequestContext, APIResponse } from '@playwright/test';

import { TokenManager } from '../auth/token-manager';
import { ApiClient } from './api-client';

export class ProductsApi {
  private readonly apiClient: ApiClient;
  private readonly resourcePath = './products';

  constructor(
    private readonly request: APIRequestContext,
    options?: { tokenManager?: TokenManager }
  ) {
    this.apiClient = new ApiClient(request, options?.tokenManager);
  }

  async list(params?: Record<string, string | number | boolean>): Promise<APIResponse> {
    return this.apiClient.get(this.resourcePath, params);
  }

  async create(data: unknown): Promise<APIResponse> {
    return this.apiClient.post(this.resourcePath, data);
  }

  async createRaw(body: string, headers?: Record<string, string>): Promise<APIResponse> {
    return this.apiClient.send('POST', this.resourcePath, {
      data: body,
      headers,
    });
  }

  async getById(id: number | string): Promise<APIResponse> {
    return this.apiClient.get(`${this.resourcePath}/${id}`);
  }

  async replace(id: number | string, data: unknown): Promise<APIResponse> {
    return this.apiClient.put(`${this.resourcePath}/${id}`, data);
  }

  async update(id: number | string, data: unknown): Promise<APIResponse> {
    return this.apiClient.patch(`${this.resourcePath}/${id}`, data);
  }

  async delete(id: number | string): Promise<APIResponse> {
    return this.apiClient.delete(`${this.resourcePath}/${id}`);
  }
}
