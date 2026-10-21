import { expect, type Page } from '@playwright/test';

import type { TestAccount } from '../data/test-account';

export class AuthPage {
  constructor(private readonly page: Page) {}

  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.page.getByText('Login to your account')).toBeVisible();
    await expect(this.page.getByText('New User Signup!')).toBeVisible();
  }

  async attemptInvalidLogin(email: string, password: string): Promise<void> {
    await this.page.locator('[data-qa="login-email"]').fill(email);
    await this.page.locator('[data-qa="login-password"]').fill(password);
    await this.page.locator('[data-qa="login-button"]').click();
    await expect(this.page.getByText(/Your email or password is incorrect!/i)).toBeVisible();
  }

  async signUp(account: TestAccount): Promise<void> {
    await this.page.locator('[data-qa="signup-name"]').fill(account.name);
    await this.page.locator('[data-qa="signup-email"]').fill(account.email);
    await this.page.locator('[data-qa="signup-button"]').click();
    await expect(this.page.getByText(/Enter Account Information/i)).toBeVisible();

    await this.page.locator('#id_gender1').check();
    await this.page.locator('[data-qa="password"]').fill(account.password);
    await this.page.locator('[data-qa="days"]').selectOption(account.birthDate);
    await this.page.locator('[data-qa="months"]').selectOption(account.birthMonth);
    await this.page.locator('[data-qa="years"]').selectOption(account.birthYear);
    await this.page.locator('[data-qa="first_name"]').fill(account.firstName);
    await this.page.locator('[data-qa="last_name"]').fill(account.lastName);
    await this.page.locator('[data-qa="company"]').fill(account.company);
    await this.page.locator('[data-qa="address"]').fill(account.address1);
    await this.page.locator('[data-qa="address2"]').fill(account.address2);
    await this.page.locator('[data-qa="country"]').selectOption({ label: account.country });
    await this.page.locator('[data-qa="state"]').fill(account.state);
    await this.page.locator('[data-qa="city"]').fill(account.city);
    await this.page.locator('[data-qa="zipcode"]').fill(account.zipcode);
    await this.page.locator('[data-qa="mobile_number"]').fill(account.mobileNumber);
    await this.page.locator('[data-qa="create-account"]').click();
  }

  async assertAccountCreated(): Promise<void> {
    await expect(this.page.getByText(/Account Created!/i)).toBeVisible();
  }

  async continueAfterAccountCreation(): Promise<void> {
    await this.page.locator('[data-qa="continue-button"]').click();
  }

  async assertLoggedInAs(accountName: string): Promise<void> {
    await expect(this.page.getByText(new RegExp(`Logged in as\\s+${accountName}`, 'i'))).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.page.getByRole('link', { name: /Logout/i }).click();
    await this.assertLoaded();
  }

  async login(account: TestAccount): Promise<void> {
    await this.page.locator('[data-qa="login-email"]').fill(account.email);
    await this.page.locator('[data-qa="login-password"]').fill(account.password);
    await this.page.locator('[data-qa="login-button"]').click();
  }

  async deleteAccount(): Promise<void> {
    await this.page.getByRole('link', { name: /Delete Account/i }).click();
    await expect(this.page.getByText(/Account Deleted!/i)).toBeVisible();
    await this.page.locator('[data-qa="continue-button"]').click();
  }
}
