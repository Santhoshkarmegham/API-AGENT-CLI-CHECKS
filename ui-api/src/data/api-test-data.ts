import accounts from '../../test-data/api/accounts.json';
import cart from '../../test-data/api/cart.json';

export const apiTestData = {
  accounts,
  cart,
} as const;

export type ApiTestData = typeof apiTestData;
