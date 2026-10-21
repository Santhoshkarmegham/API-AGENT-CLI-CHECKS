import type { AddToCartRequest, CartWorkflowResponses, DeleteCartRequest } from '../types/cart.types';
import type { ResponseSnapshot } from '../types/common';
import { ApiResponseValidator } from '../validators/api-response-validator';
import { ApiClient } from '../clients/api-client';
import { ResponseStore } from '../store/response-store';

export class CartApiService {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly responseStore: ResponseStore<ResponseSnapshot>,
  ) {}

  async addProduct(request: AddToCartRequest): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get(`/add_to_cart/${request.productId}`, {
      params: request.quantity ? { quantity: request.quantity } : undefined,
      refererPath: `/product_details/${request.productId}`,
    });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set(`cart.add.${request.productId}`, snapshot);
    return snapshot;
  }

  async getCart(): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get('/view_cart', { refererPath: '/view_cart' });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('cart.view', snapshot);
    return snapshot;
  }

  async removeProduct(request: DeleteCartRequest): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get(`/delete_cart/${request.productId}`, {
      refererPath: '/view_cart',
    });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set(`cart.delete.${request.productId}`, snapshot);
    return snapshot;
  }

  async getCheckout(): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get('/checkout', { refererPath: '/view_cart' });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('cart.checkout', snapshot);
    return snapshot;
  }

  async runObservedCartWorkflow(productId: number, quantity: number): Promise<CartWorkflowResponses> {
    const addToCart = await this.addProduct({ productId, quantity });
    const cart = await this.getCart();
    const removeFromCart = await this.removeProduct({ productId });
    const cartAfterRemoval = await this.getCart();

    return {
      addToCart,
      cart,
      removeFromCart,
      cartAfterRemoval,
    };
  }
}
