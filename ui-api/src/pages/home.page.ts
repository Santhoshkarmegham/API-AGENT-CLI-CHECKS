import { expect, type Page } from '@playwright/test';

export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.dismissConsentBannerIfPresent();
  }

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveTitle(/Automation Exercise/i);
    await expect(this.page.getByRole('link', { name: /Home/i })).toBeVisible();
    await expect(
      this.page.getByRole('heading', { name: /Full-Fledged practice website/i }).first(),
    ).toBeVisible();
  }

  async goToProducts(): Promise<void> {
    await this.page.getByRole('link', { name: /Products/i }).click();
  }

  async goToLogin(): Promise<void> {
    await this.page.getByRole('link', { name: /Signup \/ Login/i }).click();
  }

  private async dismissConsentBannerIfPresent(): Promise<void> {
    const acceptAllButton = this.page.getByRole('button', { name: /Accept all/i }).first();
    const consentButton = this.page.getByRole('button', { name: /^Consent$/i }).first();

    if (await acceptAllButton.isVisible().catch(() => false)) {
      await acceptAllButton.click();
      return;
    }

    if (await consentButton.isVisible().catch(() => false)) {
      await consentButton.click();
    }
  }
}
