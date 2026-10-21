import { expect, type Locator, type Page } from '@playwright/test';

export class ProductsPage {
  private readonly searchInput: Locator;
  private readonly searchButton: Locator;
  private readonly productCards: Locator;

  constructor(private readonly page: Page) {
    this.searchInput = page.locator('#search_product');
    this.searchButton = page.locator('#submit_search');
    this.productCards = page.locator('.features_items .product-image-wrapper');
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/products/);
    await expect(this.page.getByRole('heading', { name: /All Products/i })).toBeVisible();
    await expect(this.productCards.first()).toBeVisible();
  }

  async searchFor(term: string): Promise<void> {
    await this.searchInput.fill(term);

    await Promise.all([
      this.page.waitForLoadState('domcontentloaded'),
      this.searchButton.evaluate((button: HTMLElement) => {
        button.click();
      }),
    ]);

    await expect(this.searchInput).toHaveValue(term);
  }

  async expectSearchResults(): Promise<void> {
    await expect(this.productCards.first()).toBeVisible();
    expect(await this.productCards.count()).toBeGreaterThan(0);
  }

  async expectNoSearchResults(): Promise<void> {
    await expect(this.productCards).toHaveCount(0);
  }

  async reset(): Promise<void> {
    await this.page.goto('/products');
    await this.assertLoaded();
  }

  async openProductDetailsByName(productName: string): Promise<void> {
    const productCard = this.getProductCardByName(productName);
    await expect(productCard).toBeVisible();
    const productDetailsLink = productCard.getByRole('link', { name: /View Product/i });
    const href = await productDetailsLink.getAttribute('href');

    if (!href) {
      throw new Error(`Could not resolve product details link for ${productName}`);
    }

    await this.page.goto(href);
  }

  async addProductToCartById(productId: number): Promise<void> {
    const productCard = this.productCards.filter({
      has: this.page.locator(`a[href="/product_details/${productId}"]`),
    }).first();

    await productCard.hover();
    await productCard
      .locator(`a[data-product-id="${productId}"]`)
      .filter({ hasText: 'Add to cart' })
      .first()
      .click();
    await expect(this.page.getByText('Your product has been added to cart.')).toBeVisible();
  }

  async continueShoppingFromCartModal(): Promise<void> {
    await this.page.getByRole('button', { name: /Continue Shopping/i }).click();
    await expect(this.page.getByRole('heading', { name: /All Products/i })).toBeVisible();
  }

  async viewCartFromCartModal(): Promise<void> {
    await this.page.getByRole('link', { name: /View Cart/i }).click();
  }

  private getProductCardByName(productName: string): Locator {
    return this.productCards.filter({
      has: this.page.locator('.productinfo p', { hasText: productName }),
    }).first();
  }
}
