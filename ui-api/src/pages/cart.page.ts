import { expect, type Locator, type Page } from '@playwright/test';

export class CartPage {
  constructor(private readonly page: Page) {}

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/view_cart/);
    await expect(this.page.getByText(/Shopping Cart/i)).toBeVisible();
  }

  async expectProduct(productName: string, quantity: number): Promise<void> {
    const row = this.getRow(productName);
    await expect(row).toBeVisible();
    await expect(row.locator('.cart_quantity button')).toHaveText(String(quantity));
  }

  async removeProduct(productName: string): Promise<void> {
    const deleteButton = this.getRow(productName).locator('.cart_quantity_delete');
    const productId = await deleteButton.getAttribute('data-product-id');

    if (!productId) {
      throw new Error(`Could not resolve cart product id for ${productName}`);
    }

    await deleteButton.scrollIntoViewIfNeeded();
    await Promise.all([
      this.page.waitForResponse(response => response.url().includes(`/delete_cart/${productId}`) && response.status() === 200),
      deleteButton.dispatchEvent('click'),
    ]);
    await expect(this.page.locator('tr').filter({ hasText: productName })).toHaveCount(0);
  }

  async proceedToCheckout(): Promise<void> {
    await this.page.locator('a.check_out').click();
  }

  async assertCheckoutLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/checkout/);
    await expect(this.page.getByText(/Address Details/i)).toBeVisible();
    await expect(this.page.getByText(/Review Your Order/i)).toBeVisible();
  }

  async openLoginFromCheckoutPrompt(): Promise<void> {
    await this.page.getByRole('link', { name: /Register \/ Login/i }).click();
  }

  async assertCheckoutLoginPromptVisible(): Promise<void> {
    await expect(this.page.getByText(/Register \/ Login account to proceed on checkout/i)).toBeVisible();
  }

  private getRow(productName: string): Locator {
    return this.page.locator('tr').filter({ hasText: productName }).first();
  }
}
