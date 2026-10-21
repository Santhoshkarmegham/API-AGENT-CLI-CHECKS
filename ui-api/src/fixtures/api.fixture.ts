import { test as base, expect } from '@playwright/test';

import { TokenManager } from '../auth/token-manager';
import { ApiClient } from '../clients/api-client';
import { RequestBuilder } from '../clients/request-builder';
import { loadEnvironmentConfig } from '../config/env';
import { apiTestData } from '../data/api-test-data';
import { CartApiService } from '../services/cart-api.service';
import { AuthApiService } from '../services/auth-api.service';
import { ResponseStore } from '../store/response-store';
import type { EnvironmentConfig, ResponseSnapshot } from '../types/common';
import { ApiLogger } from '../utils/api-logger';
import { ApiResponseValidator } from '../validators/api-response-validator';

type ApiFixtures = {
  envConfig: EnvironmentConfig;
  apiLogger: ApiLogger;
  responseStore: ResponseStore<ResponseSnapshot>;
  authService: AuthApiService;
  cartService: CartApiService;
  apiData: typeof apiTestData;
  validator: typeof ApiResponseValidator;
};

export const test = base.extend<ApiFixtures>({
  envConfig: async ({}, use) => {
    await use(loadEnvironmentConfig());
  },
  apiLogger: async ({}, use, testInfo) => {
    const logger = new ApiLogger();
    await use(logger);
    await logger.flush(testInfo.outputPath('api-log.json'));
  },
  responseStore: async ({}, use) => {
    const responseStore = new ResponseStore<ResponseSnapshot>();
    await use(responseStore);
    responseStore.clear();
  },
  authService: async ({ request, envConfig, apiLogger, responseStore }, use) => {
    const tokenManager = new TokenManager(request, envConfig, apiLogger);
    const requestBuilder = new RequestBuilder(envConfig);
    const apiClient = new ApiClient(request, requestBuilder, apiLogger);
    const authService = new AuthApiService(apiClient, tokenManager, responseStore);
    await use(authService);
  },
  cartService: async ({ request, envConfig, apiLogger, responseStore }, use) => {
    const requestBuilder = new RequestBuilder(envConfig);
    const apiClient = new ApiClient(request, requestBuilder, apiLogger);
    const cartService = new CartApiService(apiClient, responseStore);
    await use(cartService);
  },
  apiData: async ({}, use) => {
    await use(apiTestData);
  },
  validator: async ({}, use) => {
    await use(ApiResponseValidator);
  },
});

export { expect };
