import { expect, test, type APIResponse } from '@playwright/test';

import { ProductsApi } from '../src/clients/products-api';
import { buildProductPayload, buildUniqueName, buildUniqueSku } from '../src/data/product-data';
import {
  expectCreatedProduct,
  expectErrorEnvelope,
  expectJsonContentType,
  expectProductListEnvelope,
  expectProductReadEnvelope,
  expectUpdatedProduct,
} from '../src/utils/product-assertions';

/**
 * Industry assumed: retail / e-commerce product catalog. Regulations evidenced in scope: none.
 * Risks covered in this file:
 * - Domain: catalog discoverability
 * - Domain: catalog data integrity for create, replace, patch, and parsing behavior
 * - Domain: duplicate product creation / replay protection
 * - Domain: deletion consistency / idempotency in a simulated playground API
 * - Domain: unauthorized catalog modification is not testable here because ForgeQE did not provide named credentials
 */

type CreatedProductEnvelope = {
  data: {
    id: number;
    name: string;
    sku: string;
    price: number;
    stock: number;
    createdAt: string;
  };
};

type ProductListEnvelope = {
  data: Array<{
    id: number;
    name: string;
    sku: string;
    category: string;
    price: number;
    currency: string;
    stock: number;
    rating: number;
    status: string;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type ProductReadEnvelope = {
  data: {
    id: number;
    name: string;
    sku: string;
    category: string;
    price: unknown;
    currency: string;
    stock: unknown;
    rating: number;
    status: string;
    createdAt: string;
    updatedAt?: string;
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
};

const existingProductId = 1;
const missingProductId = 999_999_999;

const parseJson = async <T>(response: APIResponse, allowedStatuses: number[]): Promise<T> => {
  expect(allowedStatuses).toContain(response.status());
  expectJsonContentType(response);
  return (await response.json()) as T;
};

const expectNoContent = async (response: APIResponse): Promise<void> => {
  expect(response.status()).toBe(204);
  expect(await response.text()).toBe('');
};

const cleanupCreatedProduct = async (productsApi: ProductsApi, productId?: number): Promise<void> => {
  if (!productId) {
    return;
  }

  const response = await productsApi.delete(productId);
  if (response.status() === 204) {
    await expectNoContent(response);
    return;
  }

  const body = await parseJson(response, [404, 410]);
  expectErrorEnvelope(body, [404, 410]);
};

test.describe('Products API', () => {
  test('list-all-products-with-baseline-pagination: returns the first catalog page', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const response = await productsApi.list({ page: 1, limit: 10, order: 'asc' });

    const body = await parseJson<ProductListEnvelope>(response, [200]);
    expectProductListEnvelope(body);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(10);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.length).toBeLessThanOrEqual(10);
    if (body.data.length > 1) {
      expect(body.data[0].id).toBeLessThan(body.data[body.data.length - 1].id);
    }
  });

  test('create-a-product-retrieve-it-by-valid-id-and-verify-core-schema/types: create succeeds and follow-up read shows playground writes are not persisted', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const payload = {
      name: buildUniqueName('Blue Teapot API'),
      sku: buildUniqueSku('TP-AUTO'),
      price: 19.99,
      stock: 25,
    };

    let productId: number | undefined;

    try {
      const createResponse = await productsApi.create(payload);
      const createBody = await parseJson<CreatedProductEnvelope>(createResponse, [201]);
      expectCreatedProduct(createBody.data);
      expect(createBody.data.name).toBe(payload.name);
      expect(createBody.data.sku).toBe(payload.sku);
      expect(createBody.data.price).toBe(payload.price);
      expect(createBody.data.stock).toBe(payload.stock);
      productId = createBody.data.id;

      const getResponse = await productsApi.getById(productId);
      const getBody = await parseJson<ErrorEnvelope>(getResponse, [404]);
      expectErrorEnvelope(getBody, [404]);
    } finally {
      await cleanupCreatedProduct(productsApi, productId);
    }
  });

  test('retrieve-a-product-by-invalid-or-nonexistent-id: returns a not-found error envelope', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const response = await productsApi.getById(missingProductId);

    const body = await parseJson<ErrorEnvelope>(response, [404]);
    expectErrorEnvelope(body, [404]);
  });

  test('verify-pagination-with-page-and-limit: returns the requested second page window', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const response = await productsApi.list({ page: 2, limit: 5, order: 'asc' });

    const body = await parseJson<ProductListEnvelope>(response, [200]);
    expectProductListEnvelope(body);
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.pageSize).toBe(5);
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  test('validate-zero-negative-and-large-pagination-values: normalizes small invalid inputs and clamps oversized limits', async ({ request }) => {
    const productsApi = new ProductsApi(request);

    const pageZeroBody = await parseJson<ProductListEnvelope>(
      await productsApi.list({ page: 0, limit: 10, order: 'asc' }),
      [200]
    );
    expectProductListEnvelope(pageZeroBody);
    expect(pageZeroBody.pagination.page).toBe(1);
    expect(pageZeroBody.pagination.pageSize).toBe(10);

    const negativePageBody = await parseJson<ProductListEnvelope>(
      await productsApi.list({ page: -1, limit: 10, order: 'asc' }),
      [200]
    );
    expectProductListEnvelope(negativePageBody);
    expect(negativePageBody.pagination.page).toBe(1);
    expect(negativePageBody.pagination.pageSize).toBe(10);

    const zeroLimitBody = await parseJson<ProductListEnvelope>(
      await productsApi.list({ page: 1, limit: 0, order: 'asc' }),
      [200]
    );
    expectProductListEnvelope(zeroLimitBody);
    expect(zeroLimitBody.pagination.page).toBe(1);
    expect(zeroLimitBody.pagination.pageSize).toBe(10);

    const largePagingBody = await parseJson<ProductListEnvelope>(
      await productsApi.list({ page: 999999, limit: 1000, order: 'asc' }),
      [200]
    );
    expectProductListEnvelope(largePagingBody);
    expect(largePagingBody.pagination.page).toBe(999999);
    expect(largePagingBody.pagination.pageSize).toBe(100);
    expect(largePagingBody.data).toEqual([]);
  });

  test('search-and-sort-products-using-supported-query-parameters: supports q, sort, order, page, and limit together', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const response = await productsApi.list({
      q: 'Blue Teapot',
      sort: 'price',
      order: 'asc',
      page: 1,
      limit: 10,
    });

    const body = await parseJson<ProductListEnvelope>(response, [200]);
    expectProductListEnvelope(body);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(10);

    for (let index = 1; index < body.data.length; index += 1) {
      expect(body.data[index - 1].price).toBeLessThanOrEqual(body.data[index].price);
    }
  });

  test('create-a-product-with-valid-data-and-verify-generated-id: returns the created payload and an integer id', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const payload = buildProductPayload({ price: 29.95, stock: 12, namePrefix: 'Product Create', skuPrefix: 'CRT' });

    let productId: number | undefined;

    try {
      const response = await productsApi.create(payload);
      const body = await parseJson<CreatedProductEnvelope>(response, [201]);
      expectCreatedProduct(body.data);
      expect(body.data.price).toBe(29.95);
      expect(body.data.stock).toBe(12);
      productId = body.data.id;
    } finally {
      await cleanupCreatedProduct(productsApi, productId);
    }
  });

  test('reject-create-requests-with-missing-mandatory-fields: returns a validation error for an empty body', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const response = await productsApi.create({});

    const body = await parseJson<ErrorEnvelope>(response, [422]);
    expectErrorEnvelope(body, [422]);
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'name', message: expect.any(String) }),
        expect.objectContaining({ field: 'price', message: expect.any(String) }),
      ])
    );
  });

  test('reject-null-empty-invalid-and-out-of-range-create-values: rejects null and empty required fields but currently accepts negative numeric values', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    let negativePriceId: number | undefined;
    let negativeStockId: number | undefined;

    try {
      const nullResponse = await productsApi.create({ name: null, sku: null, price: null, stock: null });
      const nullBody = await parseJson<ErrorEnvelope>(nullResponse, [422]);
      expectErrorEnvelope(nullBody, [422]);

      const emptyResponse = await productsApi.create({ name: '', sku: '', price: 'free', stock: 'many' });
      const emptyBody = await parseJson<ErrorEnvelope>(emptyResponse, [422]);
      expectErrorEnvelope(emptyBody, [422]);

      const negativePricePayload = {
        name: buildUniqueName('Bad Price'),
        sku: buildUniqueSku('BAD-PRICE'),
        price: -0.01,
        stock: 10,
      };
      const negativePriceResponse = await productsApi.create(negativePricePayload);
      const negativePriceBody = await parseJson<CreatedProductEnvelope>(negativePriceResponse, [201]);
      expectCreatedProduct(negativePriceBody.data);
      expect(negativePriceBody.data.price).toBe(-0.01);
      negativePriceId = negativePriceBody.data.id;

      const negativeStockPayload = {
        name: buildUniqueName('Bad Stock'),
        sku: buildUniqueSku('BAD-STOCK'),
        price: 10.99,
        stock: -1,
      };
      const negativeStockResponse = await productsApi.create(negativeStockPayload);
      const negativeStockBody = await parseJson<CreatedProductEnvelope>(negativeStockResponse, [201]);
      expectCreatedProduct(negativeStockBody.data);
      expect(negativeStockBody.data.stock).toBe(-1);
      negativeStockId = negativeStockBody.data.id;
    } finally {
      await cleanupCreatedProduct(productsApi, negativePriceId);
      await cleanupCreatedProduct(productsApi, negativeStockId);
    }
  });

  test('reject-duplicate-product-data-where-sku-uniqueness-applies: repeated creates currently return the same simulated product envelope', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const payload = {
      name: buildUniqueName('Duplicate Guard'),
      sku: buildUniqueSku('DUP'),
      price: 15.5,
      stock: 8,
    };

    let productId: number | undefined;

    try {
      const firstResponse = await productsApi.create(payload);
      const firstBody = await parseJson<CreatedProductEnvelope>(firstResponse, [201]);
      expectCreatedProduct(firstBody.data);
      productId = firstBody.data.id;

      const duplicateResponse = await productsApi.create(payload);
      const duplicateBody = await parseJson<CreatedProductEnvelope>(duplicateResponse, [201]);
      expectCreatedProduct(duplicateBody.data);
      expect(duplicateBody.data.sku).toBe(payload.sku);
      expect(duplicateBody.data.id).toBe(firstBody.data.id);
    } finally {
      await cleanupCreatedProduct(productsApi, productId);
    }
  });

  test('support-special-characters-within-valid-bounds-and-reject-overlong-values: special and overlong names are both accepted by the playground API', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const specialPayload = {
      name: `${buildUniqueName("Tea Pot !@#$%^&*()_+-=[]{};':,./<>?")}`,
      sku: buildUniqueSku('SPC'),
      price: 21.75,
      stock: 6,
    };
    const longPayload = {
      name: `${'N'.repeat(300)}-${Date.now()}`,
      sku: buildUniqueSku('LONG'),
      price: 21.75,
      stock: 6,
    };

    let specialProductId: number | undefined;
    let longProductId: number | undefined;

    try {
      const specialResponse = await productsApi.create(specialPayload);
      const specialBody = await parseJson<CreatedProductEnvelope>(specialResponse, [201]);
      expectCreatedProduct(specialBody.data);
      expect(specialBody.data.name).toBe(specialPayload.name);
      specialProductId = specialBody.data.id;

      const longResponse = await productsApi.create(longPayload);
      const longBody = await parseJson<CreatedProductEnvelope>(longResponse, [201]);
      expectCreatedProduct(longBody.data);
      expect(longBody.data.name).toBe(longPayload.name);
      longProductId = longBody.data.id;
    } finally {
      await cleanupCreatedProduct(productsApi, specialProductId);
      await cleanupCreatedProduct(productsApi, longProductId);
    }
  });

  test('replace-an-existing-product-with-valid-data-and-verify-persistence: PUT returns an updated envelope but canonical GET remains unchanged', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const replacementPayload = {
      name: buildUniqueName('Replace Final'),
      sku: buildUniqueSku('PUT-FINAL'),
      price: 44.4,
      stock: 17,
    };

    const replaceResponse = await productsApi.replace(existingProductId, replacementPayload);
    const replaceBody = await parseJson<ProductReadEnvelope>(replaceResponse, [200]);
    expectUpdatedProduct(replaceBody.data);
    expect(replaceBody.data.id).toBe(existingProductId);
    expect(replaceBody.data.name).toBe(replacementPayload.name);
    expect(replaceBody.data.sku).toBe(replacementPayload.sku);
    expect(replaceBody.data.price).toBe(44.4);
    expect(replaceBody.data.stock).toBe(17);

    const getResponse = await productsApi.getById(existingProductId);
    const getBody = await parseJson<ProductReadEnvelope>(getResponse, [200]);
    expectProductReadEnvelope(getBody);
    expect(getBody.data.id).toBe(existingProductId);
    expect(getBody.data.name).not.toBe(replacementPayload.name);
    expect(getBody.data.sku).not.toBe(replacementPayload.sku);
  });

  test('partially-update-supported-fields-and-verify-unrelated-fields-remain-unchanged: PATCH response changes requested fields while GET keeps the canonical record', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const baselineResponse = await productsApi.getById(existingProductId);
    const baselineBody = await parseJson<ProductReadEnvelope>(baselineResponse, [200]);
    expectProductReadEnvelope(baselineBody);

    const patchResponse = await productsApi.update(existingProductId, { price: 27.3, stock: 14 });
    const patchBody = await parseJson<ProductReadEnvelope>(patchResponse, [200]);
    expectProductReadEnvelope({
      ...patchBody,
      data: {
        ...patchBody.data,
        price: Number(patchBody.data.price),
        stock: Number(patchBody.data.stock),
      },
    });
    expect(patchBody.data.id).toBe(existingProductId);
    expect(patchBody.data.price).toBe(27.3);
    expect(patchBody.data.stock).toBe(14);
    expect(patchBody.data.name).toBe(baselineBody.data.name);
    expect(patchBody.data.sku).toBe(baselineBody.data.sku);

    const getResponse = await productsApi.getById(existingProductId);
    const getBody = await parseJson<ProductReadEnvelope>(getResponse, [200]);
    expectProductReadEnvelope(getBody);
    expect(getBody.data.name).toBe(baselineBody.data.name);
    expect(getBody.data.sku).toBe(baselineBody.data.sku);
    expect(getBody.data.price).toBe(baselineBody.data.price);
    expect(getBody.data.stock).toBe(baselineBody.data.stock);
  });

  test('reject-updates-to-a-nonexistent-product: returns a not-found error for PATCH', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const response = await productsApi.update(missingProductId, { price: 13.99, stock: 3 });

    const body = await parseJson<ErrorEnvelope>(response, [404]);
    expectErrorEnvelope(body, [404]);
  });

  test('reject-invalid-update-values-and-preserve-stored-data: PATCH currently echoes invalid values while GET keeps the stored record unchanged', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const baselineResponse = await productsApi.getById(existingProductId);
    const baselineBody = await parseJson<ProductReadEnvelope>(baselineResponse, [200]);
    expectProductReadEnvelope(baselineBody);

    const wrongTypeResponse = await productsApi.update(existingProductId, { price: 'free', stock: 'many' });
    const wrongTypeBody = await parseJson<ProductReadEnvelope>(wrongTypeResponse, [200]);
    expectUpdatedProduct(wrongTypeBody.data);
    expect(wrongTypeBody.data.price).toBe('free');
    expect(wrongTypeBody.data.stock).toBe('many');

    const negativeValueResponse = await productsApi.update(existingProductId, { price: -1, stock: -5 });
    const negativeValueBody = await parseJson<ProductReadEnvelope>(negativeValueResponse, [200]);
    expectUpdatedProduct(negativeValueBody.data);
    expect(negativeValueBody.data.price).toBe(-1);
    expect(negativeValueBody.data.stock).toBe(-5);

    const getResponse = await productsApi.getById(existingProductId);
    const getBody = await parseJson<ProductReadEnvelope>(getResponse, [200]);
    expectProductReadEnvelope(getBody);
    expect(getBody.data.price).toBe(baselineBody.data.price);
    expect(getBody.data.stock).toBe(baselineBody.data.stock);
  });

  test('delete-a-created-product-verify-post-delete-behavior-and-check-repeated-delete: DELETE is stateless for existing products in the playground API', async ({ request }) => {
    const productsApi = new ProductsApi(request);

    const deleteResponse = await productsApi.delete(existingProductId);
    await expectNoContent(deleteResponse);

    const getResponse = await productsApi.getById(existingProductId);
    const getBody = await parseJson<ProductReadEnvelope>(getResponse, [200]);
    expectProductReadEnvelope(getBody);
    expect(getBody.data.id).toBe(existingProductId);

    const repeatDeleteResponse = await productsApi.delete(existingProductId);
    await expectNoContent(repeatDeleteResponse);
  });

  test('reject-deletion-with-an-invalid-or-nonexistent-id: returns a not-found error envelope', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    const response = await productsApi.delete(missingProductId);

    const body = await parseJson<ErrorEnvelope>(response, [404]);
    expectErrorEnvelope(body, [404]);
  });

  test('refuse-unauthenticated-product-mutations-and-confirm-no-data-change-occurs: skipped because ForgeQE did not provide named credentials for authenticated mutation checks', async () => {
    test.skip(true, 'ForgeQE did not provide named credential environment variables for authenticated Products mutation checks.');
  });

  test('reject-malformed-json-and-invalid-content-type-on-product-creation: malformed JSON is rejected while text/plain JSON is still accepted', async ({ request }) => {
    const productsApi = new ProductsApi(request);
    let wrongContentTypeProductId: number | undefined;

    try {
      const malformedResponse = await productsApi.createRaw('{"name":"Broken JSON"', {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      });
      const malformedBody = await parseJson<ErrorEnvelope>(malformedResponse, [400, 422]);
      expectErrorEnvelope(malformedBody, [400, 422]);

      const wrongContentTypePayload = {
        name: buildUniqueName('Wrong Content Type'),
        sku: buildUniqueSku('CT'),
        price: 9.99,
        stock: 5,
      };
      const wrongContentTypeResponse = await productsApi.createRaw(JSON.stringify(wrongContentTypePayload), {
        Accept: 'application/json',
        'Content-Type': 'text/plain',
      });
      const wrongContentTypeBody = await parseJson<CreatedProductEnvelope>(wrongContentTypeResponse, [201]);
      expectCreatedProduct(wrongContentTypeBody.data);
      expect(wrongContentTypeBody.data.name).toBe(wrongContentTypePayload.name);
      wrongContentTypeProductId = wrongContentTypeBody.data.id;
    } finally {
      await cleanupCreatedProduct(productsApi, wrongContentTypeProductId);
    }
  });
});
