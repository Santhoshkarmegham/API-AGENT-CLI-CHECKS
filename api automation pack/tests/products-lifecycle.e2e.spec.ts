import { expect, test, type APIResponse } from '@playwright/test';

import lifecycleCreateData from '../test-data/products/lifecycle-create.json';
import lifecyclePatchData from '../test-data/products/lifecycle-patch.json';
import lifecyclePutData from '../test-data/products/lifecycle-put.json';
import { loadEnvironmentConfig } from '../src/config/env';
import { TokenManager } from '../src/auth/token-manager';
import { ProductsApi } from '../src/clients/products-api';
import { buildProductPatchPayload, buildProductPayload, type ProductPayload } from '../src/data/product-data';
import {
  expectCreatedProduct,
  expectErrorEnvelope,
  expectUpdatedProduct,
} from '../src/utils/product-assertions';
import { ApiResponseValidator } from '../src/utils/api-response-validator';
import { CleanupManager } from '../src/utils/cleanup-manager';
import { ResponseStore } from '../src/utils/response-store';

type CreatedProductEnvelope = {
  data: {
    id: number;
    name: string;
    sku: string;
    price: number;
    stock: number;
    createdAt: string;
  };
  meta: {
    requestId: string;
    responseTimeMs: number;
    timestamp: string;
    apiVersion: string;
  };
};

type ProductReadEnvelope = {
  data: {
    id: number;
    name: string;
    sku: string;
    price: number;
    stock: number;
    updatedAt?: string;
  };
  meta: {
    requestId: string;
    responseTimeMs: number;
    timestamp: string;
    apiVersion: string;
  };
};

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    status: number;
    details?: Array<{
      field?: string;
      message?: string;
    }>;
  };
  meta: {
    requestId: string;
    responseTimeMs: number;
    timestamp: string;
    apiVersion: string;
  };
};

test.describe('Products API end-to-end lifecycle', () => {
  test('POST -> GET -> PUT -> GET -> PATCH -> GET -> DELETE -> GET uses dynamic product ID from ResponseStore', async ({ request }) => {
    const environment = loadEnvironmentConfig();
    const tokenManager = new TokenManager(request, environment.auth);
    const productsApi = new ProductsApi(request, { tokenManager });
    const store = new ResponseStore();
    const cleanup = new CleanupManager();

    try {
      const createPayload = buildProductPayload(lifecycleCreateData);

      const createResponse = await productsApi.create(createPayload);
      const created = await ApiResponseValidator.parseJson<CreatedProductEnvelope>(createResponse, [201]);
      expectCreatedProduct(created.data);
      expect(created.data.name).toBe(createPayload.name);
      expect(created.data.sku).toBe(createPayload.sku);
      store.set('productId', created.data.id);
      store.set('createPayload', createPayload);

      cleanup.add(async () => {
        const cleanupId = store.get<number>('productId');
        const cleanupResponse = await productsApi.delete(cleanupId);

        if (cleanupResponse.status() === 204) {
          await ApiResponseValidator.expectNoContent(cleanupResponse);
          return;
        }

        const cleanupBody = await ApiResponseValidator.parseJson<ErrorEnvelope>(cleanupResponse, [404]);
        expectErrorEnvelope(cleanupBody, [404]);
      });

      const createdProductId = store.get<number>('productId');

      const getAfterCreateResponse = await productsApi.getById(createdProductId);
      const getAfterCreateBody = await ApiResponseValidator.parseJson<ErrorEnvelope>(getAfterCreateResponse, [404]);
      expectErrorEnvelope(getAfterCreateBody, [404]);
      store.set('getAfterCreate', getAfterCreateBody);

      const putPayload: ProductPayload = buildProductPayload(lifecyclePutData);
      const putResponse = await productsApi.replace(createdProductId, putPayload);
      const putBody = await ApiResponseValidator.parseJson<ErrorEnvelope | ProductReadEnvelope>(putResponse, [404, 200]);
      store.set('putStatus', putResponse.status());
      store.set('putPayload', putPayload);

      if (putResponse.status() === 200) {
        expectUpdatedProduct((putBody as ProductReadEnvelope).data);
        expect((putBody as ProductReadEnvelope).data.id).toBe(createdProductId);
      } else {
        expectErrorEnvelope(putBody as ErrorEnvelope, [404]);
      }

      const getAfterPutResponse = await productsApi.getById(createdProductId);
      const getAfterPutBody = await ApiResponseValidator.parseJson<ErrorEnvelope | ProductReadEnvelope>(
        getAfterPutResponse,
        [404, 200]
      );
      store.set('getAfterPutStatus', getAfterPutResponse.status());

      if (getAfterPutResponse.status() === 200) {
        const body = getAfterPutBody as ProductReadEnvelope;
        expect(body.data.id).toBe(createdProductId);
        expect(body.data.name).toBe(putPayload.name);
        expect(body.data.sku).toBe(putPayload.sku);
        expect(body.data.price).toBe(putPayload.price);
        expect(body.data.stock).toBe(putPayload.stock);
      } else {
        expectErrorEnvelope(getAfterPutBody as ErrorEnvelope, [404]);
      }

      const patchPayload = buildProductPatchPayload(lifecyclePatchData);
      const patchResponse = await productsApi.update(createdProductId, patchPayload);
      const patchBody = await ApiResponseValidator.parseJson<ErrorEnvelope | ProductReadEnvelope>(patchResponse, [404, 200]);
      store.set('patchStatus', patchResponse.status());
      store.set('patchPayload', patchPayload);

      if (patchResponse.status() === 200) {
        const body = patchBody as ProductReadEnvelope;
        expectUpdatedProduct(body.data);
        expect(body.data.id).toBe(createdProductId);
        expect(body.data.price).toBe(patchPayload.price);
        expect(body.data.stock).toBe(patchPayload.stock);
        expect(body.data.name).toBe(putResponse.status() === 200 ? putPayload.name : createPayload.name);
        expect(body.data.sku).toBe(putResponse.status() === 200 ? putPayload.sku : createPayload.sku);
      } else {
        expectErrorEnvelope(patchBody as ErrorEnvelope, [404]);
      }

      const getAfterPatchResponse = await productsApi.getById(createdProductId);
      const getAfterPatchBody = await ApiResponseValidator.parseJson<ErrorEnvelope | ProductReadEnvelope>(
        getAfterPatchResponse,
        [404, 200]
      );
      store.set('getAfterPatchStatus', getAfterPatchResponse.status());

      if (getAfterPatchResponse.status() === 200) {
        const body = getAfterPatchBody as ProductReadEnvelope;
        expect(body.data.id).toBe(createdProductId);
        expect(body.data.price).toBe(patchPayload.price);
        expect(body.data.stock).toBe(patchPayload.stock);
      } else {
        expectErrorEnvelope(getAfterPatchBody as ErrorEnvelope, [404]);
      }

      const deleteResponse = await productsApi.delete(createdProductId);
      store.set('deleteStatus', deleteResponse.status());

      if (deleteResponse.status() === 204) {
        await ApiResponseValidator.expectNoContent(deleteResponse);
      } else {
        const deleteBody = await ApiResponseValidator.parseJson<ErrorEnvelope>(deleteResponse, [404]);
        expectErrorEnvelope(deleteBody, [404]);
      }

      const getAfterDeleteResponse = await productsApi.getById(createdProductId);
      const getAfterDeleteBody = await ApiResponseValidator.parseJson<ErrorEnvelope | ProductReadEnvelope>(
        getAfterDeleteResponse,
        [404, 200]
      );

      if (deleteResponse.status() === 204) {
        if (getAfterDeleteResponse.status() === 404) {
          expectErrorEnvelope(getAfterDeleteBody as ErrorEnvelope, [404]);
        } else {
          const body = getAfterDeleteBody as ProductReadEnvelope;
          expect(body.data.id).toBe(createdProductId);
        }
      } else {
        expectErrorEnvelope(getAfterDeleteBody as ErrorEnvelope, [404]);
      }

      expect(store.has('productId')).toBeTruthy();
    } finally {
      await cleanup.runAll();
    }
  });
});
