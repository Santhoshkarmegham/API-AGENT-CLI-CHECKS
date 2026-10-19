import { randomUUID } from 'node:crypto';

export type ProductPayload = {
  name: string;
  sku: string;
  price: number;
  stock: number;
};

export type ProductTemplate = Partial<ProductPayload> & {
  namePrefix?: string;
  skuPrefix?: string;
};

const shortUuid = () => randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

export const buildUniqueName = (prefix: string): string => `${prefix} ${Date.now()}-${shortUuid()}`;

export const buildUniqueSku = (prefix: string): string => `${prefix}-${shortUuid()}`;

export const buildProductPayload = (overrides?: ProductTemplate): ProductPayload => ({
  name: overrides?.name ?? buildUniqueName(overrides?.namePrefix ?? 'Product Create'),
  sku: overrides?.sku ?? buildUniqueSku(overrides?.skuPrefix ?? 'CRT'),
  price: overrides?.price ?? 29.95,
  stock: overrides?.stock ?? 12,
});

export const buildProductPatchPayload = (overrides?: Partial<Pick<ProductPayload, 'price' | 'stock'>>) => ({
  price: overrides?.price ?? 31.5,
  stock: overrides?.stock ?? 9,
});
