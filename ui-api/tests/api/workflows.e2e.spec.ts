import { test } from '../../src/fixtures/api.fixture';

test.describe('Observed API end-to-end workflows', () => {
  test('@e2e @regression signup, login, checkout, and delete account workflow succeeds', async ({ authService, cartService, apiData, responseStore, validator }) => {
    const account = authService.createAccountModel();
    const smokeProduct = apiData.cart.smokeProduct;

    const signupStart = await authService.beginSignup(account);
    responseStore.set('e2e.signupStart', signupStart);

    const signupCreate = await authService.createAccount(account);
    responseStore.set('e2e.signupCreate', signupCreate);

    const accountCreated = await authService.fetchAccountCreatedPage();
    responseStore.set('e2e.accountCreated', accountCreated);

    const login = await authService.login({ email: account.email, password: account.password }, 0);
    responseStore.set('e2e.login', login);

    const home = await authService.fetchHome();
    responseStore.set('e2e.home', home);

    const addToCart = await cartService.addProduct({
      productId: smokeProduct.productId,
      quantity: smokeProduct.quantity,
    });
    responseStore.set('e2e.addToCart', addToCart);

    const cart = await cartService.getCart();
    responseStore.set('e2e.cart', cart);

    const checkout = await cartService.getCheckout();
    responseStore.set('e2e.checkout', checkout);

    const deleteAccount = await authService.deleteAccount();
    responseStore.set('e2e.deleteAccount', deleteAccount);

    validator.assertStatus(signupStart, 200);
    validator.assertBodyContains(signupStart, [apiData.accounts.expected.signupStartMarker]);
    validator.assertStatus(signupCreate, 302);
    validator.assertRedirectLocation(signupCreate, '/account_created');
    validator.assertBodyContains(accountCreated, [apiData.accounts.expected.accountCreatedMarker]);
    validator.assertStatus(login, 302);
    validator.assertRedirectLocation(login, '/');
    validator.assertBodyContains(home, [apiData.accounts.expected.loggedInMarker]);
    validator.assertStatus(cart, 200);
    validator.assertBodyContains(cart, apiData.cart.smokeProduct.cartMarkers);
    validator.assertStatus(checkout, 200);
    validator.assertBodyContains(checkout, apiData.cart.expected.checkoutMarkers);
    validator.assertBodyContains(deleteAccount, [apiData.accounts.expected.accountDeletedMarker]);
  });
});
