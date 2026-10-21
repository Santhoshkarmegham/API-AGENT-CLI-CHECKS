import type { ResponseSnapshot } from './common';

export interface AddToCartRequest {
  productId: number;
  quantity?: number;
}

export interface DeleteCartRequest {
  productId: number;
}

export interface CartItemExpectation {
  productId: number;
  markers: string[];
}

export interface CartWorkflowResponses {
  addToCart: ResponseSnapshot;
  cart: ResponseSnapshot;
  removeFromCart: ResponseSnapshot;
  cartAfterRemoval: ResponseSnapshot;
}
