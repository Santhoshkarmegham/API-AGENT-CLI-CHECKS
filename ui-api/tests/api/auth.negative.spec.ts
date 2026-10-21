import { test } from '../../src/fixtures/api.fixture';

test.describe('Authentication API negative suite', () => {
  test('@negative @regression invalid login returns the observed error page', async ({ authService, apiData, validator }) => {
    const response = await authService.login({
      email: apiData.accounts.invalidLogin.email,
      password: apiData.accounts.invalidLogin.password,
    });

    validator.assertStatus(response, 200);
    validator.assertContentType(response, 'text/html');
    validator.assertHeaderPresent(response, 'x-frame-options');
    validator.assertBodyContains(response, [apiData.accounts.invalidLogin.expectedErrorMarker]);
  });
});
