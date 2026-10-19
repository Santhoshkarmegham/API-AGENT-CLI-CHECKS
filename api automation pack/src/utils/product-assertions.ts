import { APIResponse, expect } from '@playwright/test';

type ApiMeta = {
  requestId: string;
  responseTimeMs: number;
  timestamp: string;
  apiVersion: string;
};

type ProductListEnvelope = {
  data: unknown[];
  pagination: unknown;
  meta: ApiMeta;
};

type ProductReadEnvelope = {
  data: unknown;
  meta: ApiMeta;
};

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    status: number;
    details?: Array<{ field?: string; message?: string }>;
  };
  meta: ApiMeta;
};

export function expectJsonContentType(response: APIResponse): void {
  expect(response.headers()['content-type'] ?? '').toContain('application/json');
}

export function expectApiMeta(value: unknown): void {
  expect(value).toEqual(
    expect.objectContaining({
      requestId: expect.any(String),
      responseTimeMs: expect.any(Number),
      timestamp: expect.any(String),
      apiVersion: expect.any(String),
    })
  );
}

export function expectPagination(value: unknown): void {
  expect(value).toEqual(
    expect.objectContaining({
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalItems: expect.any(Number),
      totalPages: expect.any(Number),
      hasNext: expect.any(Boolean),
      hasPrev: expect.any(Boolean),
    })
  );
}

export function expectCatalogProduct(value: unknown): void {
  expect(value).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
      name: expect.any(String),
      sku: expect.any(String),
      category: expect.any(String),
      price: expect.any(Number),
      currency: expect.any(String),
      stock: expect.any(Number),
      rating: expect.any(Number),
      status: expect.any(String),
      createdAt: expect.any(String),
    })
  );
}

export function expectCreatedProduct(value: unknown): void {
  expect(value).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
      name: expect.any(String),
      sku: expect.any(String),
      price: expect.any(Number),
      stock: expect.any(Number),
    })
  );
  expect(value).toEqual(expect.objectContaining({ createdAt: expect.any(String) }));
}

export function expectUpdatedProduct(value: unknown): void {
  expect(value).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
      name: expect.any(String),
      sku: expect.any(String),
      updatedAt: expect.any(String),
    })
  );
}

export function expectProductListEnvelope(value: unknown): asserts value is ProductListEnvelope {
  expect(value).toEqual(
    expect.objectContaining({
      data: expect.any(Array),
      pagination: expect.any(Object),
      meta: expect.any(Object),
    })
  );

  const body = value as ProductListEnvelope;
  expectPagination(body.pagination);
  expectApiMeta(body.meta);

  for (const product of body.data) {
    expectCatalogProduct(product);
  }
}

export function expectProductReadEnvelope(value: unknown): asserts value is ProductReadEnvelope {
  expect(value).toEqual(
    expect.objectContaining({
      data: expect.any(Object),
      meta: expect.any(Object),
    })
  );

  const body = value as ProductReadEnvelope;
  expectCatalogProduct(body.data);
  expectApiMeta(body.meta);
}

export function expectErrorEnvelope(
  value: unknown,
  expectedStatuses?: number[]
): asserts value is ErrorEnvelope {
  expect(value).toEqual(
    expect.objectContaining({
      error: expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
        status: expect.any(Number),
      }),
      meta: expect.any(Object),
    })
  );

  const body = value as ErrorEnvelope;
  if (expectedStatuses?.length) {
    expect(expectedStatuses).toContain(body.error.status);
  }
  expectApiMeta(body.meta);

  if (body.error.details) {
    expect(Array.isArray(body.error.details)).toBeTruthy();
    for (const detail of body.error.details) {
      expect(detail).toEqual(
        expect.objectContaining({
          message: expect.any(String),
        })
      );
    }
  }
}
