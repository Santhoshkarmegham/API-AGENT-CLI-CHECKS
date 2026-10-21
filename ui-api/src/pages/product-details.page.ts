import { expect, type Page } from '@playwright/test';

export class ProductDetailsPage {
  constructor(private readonly page: Page) {}

  async assertLoaded(productName: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/product_details\//);
    await expect(this.page.getByRole('heading', { name: new RegExp(productName, 'i') })).toBeVisible();
    await expect(this.page.getByText(/Category:/i)).toBeVisible();
    await expect(this.page.getByText(/Availability:/i)).toBeVisible();
    await expect(this.page.getByText(/Condition:/i)).toBeVisible();
    await expect(this.page.getByText(/Brand:/i)).toBeVisible();
  }

  async setQuantity(quantity: number): Promise<void> {
    await this.page.locator('#quantity').fill(String(quantity));
  }

  async addToCart(): Promise<void> {
    await this.page.getByRole('button', { name: /Add to cart/i }).click();
    await expect(this.page.getByText('Your product has been added to cart.')).toBeVisible();
  }

  async continueShoppingFromCartModal(): Promise<void> {
    await this.page.getByRole('button', { name: /Continue Shopping/i }).click();
  }
}
