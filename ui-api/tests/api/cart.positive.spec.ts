import { test } from '../../src/fixtures/api.fixture';

test.describe('Cart API positive suite', () => {
  test('@smoke @regression add and remove cart items through the observed endpoints', async ({ cartService, apiData, validator }) => {
    const smokeProduct = apiData.cart.smokeProduct;

    const addToCart = await cartService.addProduct({
      productId: smokeProduct.productId,
      quantity: smokeProduct.quantity,
    });
    const cart = await cartService.getCart();
    const removeFromCart = await cartService.removeProduct({ productId: smokeProduct.productId });
    const cartAfterRemoval = await cartService.getCart();

    validator.assertStatus(addToCart, 200);
    validator.assertContentType(addToCart, 'text/html');
    validator.assertStatus(cart, 200);
    validator.assertBodyContains(cart, smokeProduct.cartMarkers);
    validator.assertStatus(removeFromCart, 200);
    validator.assertContentType(removeFromCart, 'text/html');
    validator.assertStatus(cartAfterRemoval, 200);
    validator.assertBodyNotContains(cartAfterRemoval, smokeProduct.cartMarkers);
  });
});
