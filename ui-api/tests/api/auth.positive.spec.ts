import { test } from '../../src/fixtures/api.fixture';

test.describe('Authentication API positive suite', () => {
  test('@smoke @regression signup start returns the account information form', async ({ authService, apiData, validator }) => {
    const account = authService.createAccountModel();
    const signupStart = await authService.beginSignup(account);

    validator.assertStatus(signupStart, 200);
    validator.assertContentType(signupStart, 'text/html');
    validator.assertHeaderPresent(signupStart, 'x-frame-options');
    validator.assertBodyContains(signupStart, [apiData.accounts.expected.signupStartMarker]);
  });

  test('@regression create account redirects to the observed account created page', async ({ authService, apiData, validator }) => {
    const account = authService.createAccountModel();

    await authService.beginSignup(account);
    const createAccount = await authService.createAccount(account);
    const accountCreatedPage = await authService.fetchAccountCreatedPage();
    const deleteAccount = await authService.deleteAccount();

    validator.assertStatus(createAccount, 302);
    validator.assertContentType(createAccount, 'text/html');
    validator.assertRedirectLocation(createAccount, '/account_created');
    validator.assertBodyContains(accountCreatedPage, [apiData.accounts.expected.accountCreatedMarker]);
    validator.assertBodyContains(deleteAccount, [apiData.accounts.expected.accountDeletedMarker]);
  });
});
