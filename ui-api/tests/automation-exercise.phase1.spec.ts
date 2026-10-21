import { createTemporaryAccount } from '../src/data/test-account';
import { test, expect } from '../src/fixtures/test-fixture';
import { AuthPage } from '../src/pages/auth.page';
import { CartPage } from '../src/pages/cart.page';
import { HomePage } from '../src/pages/home.page';
import { ProductDetailsPage } from '../src/pages/product-details.page';
import { ProductsPage } from '../src/pages/products.page';

test.describe('Automation Exercise Phase 1 UI exploration', () => {
  test('executes homepage, product, cart, authentication, and checkout journeys', async ({ page, actionTracker }) => {
    const account = createTemporaryAccount();
    const homePage = new HomePage(page);
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const authPage = new AuthPage(page);

    const runTrackedStep = async (uiAction: string, action: () => Promise<void>): Promise<void> => {
      await test.step(uiAction, async () => {
        actionTracker.set(uiAction);

        try {
          await action();
        } finally {
          actionTracker.clear(uiAction);
        }
      });
    };

    await runTrackedStep('Load the homepage successfully', async () => {
      await homePage.goto();
      await homePage.assertLoaded();
    });

    await runTrackedStep('Browse the products catalogue', async () => {
      await homePage.goToProducts();
      await productsPage.assertLoaded();
    });

    await runTrackedStep('Search with a valid product name', async () => {
      await productsPage.searchFor('Top');
      await productsPage.expectSearchResults();
    });

    await runTrackedStep('Search with an invalid product name', async () => {
      await productsPage.searchFor(`no-match-${Date.now()}`);
      await productsPage.expectNoSearchResults();
    });

    await runTrackedStep('Open product details and validate the displayed information', async () => {
      await productsPage.reset();
      await productsPage.openProductDetailsByName('Blue Top');
      await productDetailsPage.assertLoaded('Blue Top');
    });

    await runTrackedStep('Add products to cart and update quantity where supported', async () => {
      await productDetailsPage.setQuantity(2);
      await productDetailsPage.addToCart();
      await productDetailsPage.continueShoppingFromCartModal();
      await page.getByRole('link', { name: /Products/i }).click();
      await productsPage.assertLoaded();
      await productsPage.addProductToCartById(2);
      await productsPage.viewCartFromCartModal();
      await cartPage.assertLoaded();
      await cartPage.expectProduct('Blue Top', 2);
      await cartPage.expectProduct('Men Tshirt', 1);
    });

    await runTrackedStep('Remove a product from the cart', async () => {
      await cartPage.removeProduct('Men Tshirt');
      await expect(page.locator('tr').filter({ hasText: 'Men Tshirt' })).toHaveCount(0);
    });

    await runTrackedStep('Validate checkout prompts login when unauthenticated', async () => {
      await cartPage.proceedToCheckout();
      await cartPage.assertCheckoutLoginPromptVisible();
      await cartPage.openLoginFromCheckoutPrompt();
      await authPage.assertLoaded();
    });

    await runTrackedStep('Execute invalid login scenario', async () => {
      await authPage.attemptInvalidLogin('invalid.user@example.com', 'incorrect-password');
    });

    await runTrackedStep('Register a temporary account and validate the logged-in state', async () => {
      await authPage.signUp(account);
      await authPage.assertAccountCreated();
      await authPage.continueAfterAccountCreation();
      await authPage.assertLoggedInAs(account.name);
    });

    await runTrackedStep('Log out and log back in with the generated account', async () => {
      await authPage.logout();
      await authPage.login(account);
      await authPage.assertLoggedInAs(account.name);
    });

    await runTrackedStep('Validate cart and checkout navigation for the authenticated shopper', async () => {
      await page.goto('/view_cart');
      await cartPage.assertLoaded();
      await cartPage.expectProduct('Blue Top', 2);
      await cartPage.proceedToCheckout();
      await cartPage.assertCheckoutLoaded();
    });

    await runTrackedStep('Delete the temporary account created by the test', async () => {
      await authPage.deleteAccount();
    });
  });
});
