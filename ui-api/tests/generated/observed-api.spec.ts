import { test, expect, request } from '@playwright/test';
import { createObservedApiAccount, expectHtmlContains, extractPathParameter, fetchCsrfToken, normalizeContentType, postForm } from '../../src/api/observed-api-helpers';

const baseURL = 'https://automationexercise.com';

const discovery = {
  "generatedAt": "2026-10-21T18:42:47.317Z",
  "candidates": {
    "authentication-get-delete-account-default": {
      "id": "authentication-get-delete-account-default",
      "module": "authentication",
      "method": "GET",
      "normalizedPath": "/delete_account",
      "variant": "default",
      "samplePath": "/delete_account",
      "sampleQuery": {},
      "sampleRequestBody": {
        "kind": "none",
        "raw": null,
        "fields": {},
        "redactedKeys": []
      },
      "uiActions": [
        "Delete the temporary account created by the test"
      ],
      "resourceTypes": [
        "document"
      ],
      "observedStatusCodes": [
        200
      ],
      "observedContentTypes": [
        "text/html"
      ],
      "observedBodyMarkers": [
        "Account Deleted!"
      ],
      "requestCookieNames": [
        "csrftoken",
        "sessionid"
      ],
      "responseSetCookieNames": [
        "csrftoken",
        "20 Oct 2027 18:42:46 GMT; Max-Age",
        "sessionid"
      ],
      "authHeaderNames": [
        "cookie:csrftoken",
        "cookie:sessionid"
      ],
      "correlationHeaderNames": []
    },
    "authentication-get-logout-default": {
      "id": "authentication-get-logout-default",
      "module": "authentication",
      "method": "GET",
      "normalizedPath": "/logout",
      "variant": "default",
      "samplePath": "/logout",
      "sampleQuery": {},
      "sampleRequestBody": {
        "kind": "none",
        "raw": null,
        "fields": {},
        "redactedKeys": []
      },
      "uiActions": [
        "Log out and log back in with the generated account"
      ],
      "resourceTypes": [
        "document"
      ],
      "observedStatusCodes": [
        302
      ],
      "observedContentTypes": [
        "text/html"
      ],
      "observedBodyMarkers": [],
      "requestCookieNames": [
        "csrftoken",
        "sessionid"
      ],
      "responseSetCookieNames": [
        "sessionid",
        "04 Nov 2026 18:42:43 GMT; HttpOnly; Max-Age"
      ],
      "authHeaderNames": [
        "cookie:csrftoken",
        "cookie:sessionid"
      ],
      "correlationHeaderNames": []
    },
    "authentication-post-login-default": {
      "id": "authentication-post-login-default",
      "module": "authentication",
      "method": "POST",
      "normalizedPath": "/login",
      "variant": "default",
      "samplePath": "/login",
      "sampleQuery": {},
      "sampleRequestBody": {
        "kind": "form",
        "raw": "csrfmiddlewaretoken=N2Xmfq5tLUyfEeSZpVGGzs7Pd520sLYwh6FMFbmrajddFbbXt9U8YRD3FTsSEzeL&email=invalid.user%40example.com&password=incorrect-password",
        "fields": {
          "csrfmiddlewaretoken": "<csrf-token>",
          "email": "<generated-email>",
          "password": "<generated-password>"
        },
        "redactedKeys": [
          "csrfmiddlewaretoken",
          "password"
        ]
      },
      "uiActions": [
        "Execute invalid login scenario",
        "Log out and log back in with the generated account"
      ],
      "resourceTypes": [
        "document"
      ],
      "observedStatusCodes": [
        200,
        302
      ],
      "observedContentTypes": [
        "text/html"
      ],
      "observedBodyMarkers": [
        "Your email or password is incorrect!"
      ],
      "requestCookieNames": [
        "csrftoken",
        "sessionid"
      ],
      "responseSetCookieNames": [
        "csrftoken",
        "20 Oct 2027 18:42:40 GMT; Max-Age",
        "sessionid",
        "04 Nov 2026 18:42:44 GMT; HttpOnly; Max-Age"
      ],
      "authHeaderNames": [
        "cookie:csrftoken",
        "cookie:sessionid",
        "csrfmiddlewaretoken"
      ],
      "correlationHeaderNames": []
    },
    "authentication-post-signup-create-account": {
      "id": "authentication-post-signup-create-account",
      "module": "authentication",
      "method": "POST",
      "normalizedPath": "/signup",
      "variant": "create_account",
      "samplePath": "/signup",
      "sampleQuery": {},
      "sampleRequestBody": {
        "kind": "form",
        "raw": "csrfmiddlewaretoken=o5F2nFgOti8scxe5usF3RjKJj0IWgu35S9nsNqxMSHNqdux3yGTvgIgXLO8Osijk&title=Mr&name=AI+Agent+20261021184231&email_address=ai.agent.20261021184231%40example.com&password=Ae%2120261021184231&days=10&months=5&years=1995&first_name=AI&last_name=Agent4231&company=ForgeQE+Labs&address1=100+Automation+Street&address2=Suite+10&country=United+States&state=California&city=San+Francisco&zipcode=94105&mobile_number=5551184231&form_type=create_account",
        "fields": {
          "csrfmiddlewaretoken": "<csrf-token>",
          "title": "Mr",
          "name": "<generated-name>",
          "email_address": "<generated-email>",
          "password": "<generated-password>",
          "days": "10",
          "months": "5",
          "years": "1995",
          "first_name": "AI",
          "last_name": "Agent4231",
          "company": "ForgeQE Labs",
          "address1": "100 Automation Street",
          "address2": "Suite 10",
          "country": "United States",
          "state": "California",
          "city": "San Francisco",
          "zipcode": "94105",
          "mobile_number": "5551184231",
          "form_type": "create_account"
        },
        "redactedKeys": [
          "csrfmiddlewaretoken",
          "password"
        ]
      },
      "uiActions": [
        "Register a temporary account and validate the logged-in state"
      ],
      "resourceTypes": [
        "document"
      ],
      "observedStatusCodes": [
        302
      ],
      "observedContentTypes": [
        "text/html"
      ],
      "observedBodyMarkers": [],
      "requestCookieNames": [
        "csrftoken",
        "sessionid"
      ],
      "responseSetCookieNames": [
        "sessionid",
        "04 Nov 2026 18:42:42 GMT; HttpOnly; Max-Age"
      ],
      "authHeaderNames": [
        "cookie:csrftoken",
        "cookie:sessionid",
        "csrfmiddlewaretoken"
      ],
      "correlationHeaderNames": []
    },
    "authentication-post-signup-signup": {
      "id": "authentication-post-signup-signup",
      "module": "authentication",
      "method": "POST",
      "normalizedPath": "/signup",
      "variant": "signup",
      "samplePath": "/signup",
      "sampleQuery": {},
      "sampleRequestBody": {
        "kind": "form",
        "raw": "csrfmiddlewaretoken=YmKkAchHKQoKbQM9EQiC92DYfThri8jKsqsK0XyF9f3IcN57I4w4yr9cHHHjuWzZ&name=AI+Agent+20261021184231&email=ai.agent.20261021184231%40example.com&form_type=signup",
        "fields": {
          "csrfmiddlewaretoken": "<csrf-token>",
          "name": "<generated-name>",
          "email": "<generated-email>",
          "form_type": "signup"
        },
        "redactedKeys": [
          "csrfmiddlewaretoken"
        ]
      },
      "uiActions": [
        "Register a temporary account and validate the logged-in state"
      ],
      "resourceTypes": [
        "document"
      ],
      "observedStatusCodes": [
        200
      ],
      "observedContentTypes": [
        "text/html"
      ],
      "observedBodyMarkers": [
        "Enter Account Information"
      ],
      "requestCookieNames": [
        "csrftoken",
        "sessionid"
      ],
      "responseSetCookieNames": [
        "csrftoken",
        "20 Oct 2027 18:42:41 GMT; Max-Age"
      ],
      "authHeaderNames": [
        "cookie:csrftoken",
        "cookie:sessionid",
        "csrfmiddlewaretoken"
      ],
      "correlationHeaderNames": []
    },
    "cart-get-add-to-cart-productid-default": {
      "id": "cart-get-add-to-cart-productid-default",
      "module": "cart",
      "method": "GET",
      "normalizedPath": "/add_to_cart/{productId}",
      "variant": "default",
      "samplePath": "/add_to_cart/1",
      "sampleQuery": {
        "quantity": "2"
      },
      "sampleRequestBody": {
        "kind": "none",
        "raw": null,
        "fields": {},
        "redactedKeys": []
      },
      "uiActions": [
        "Add products to cart and update quantity where supported"
      ],
      "resourceTypes": [
        "xhr"
      ],
      "observedStatusCodes": [
        200
      ],
      "observedContentTypes": [
        "text/html"
      ],
      "observedBodyMarkers": [],
      "requestCookieNames": [
        "csrftoken",
        "sessionid"
      ],
      "responseSetCookieNames": [
        "sessionid",
        "04 Nov 2026 18:42:37 GMT; HttpOnly; Max-Age",
        "04 Nov 2026 18:42:38 GMT; HttpOnly; Max-Age"
      ],
      "authHeaderNames": [
        "cookie:csrftoken",
        "cookie:sessionid"
      ],
      "correlationHeaderNames": []
    },
    "cart-get-delete-cart-productid-default": {
      "id": "cart-get-delete-cart-productid-default",
      "module": "cart",
      "method": "GET",
      "normalizedPath": "/delete_cart/{productId}",
      "variant": "default",
      "samplePath": "/delete_cart/2",
      "sampleQuery": {},
      "sampleRequestBody": {
        "kind": "none",
        "raw": null,
        "fields": {},
        "redactedKeys": []
      },
      "uiActions": [
        "Remove a product from the cart"
      ],
      "resourceTypes": [
        "xhr"
      ],
      "observedStatusCodes": [
        200
      ],
      "observedContentTypes": [
        "text/html"
      ],
      "observedBodyMarkers": [],
      "requestCookieNames": [
        "csrftoken",
        "sessionid"
      ],
      "responseSetCookieNames": [
        "sessionid",
        "04 Nov 2026 18:42:39 GMT; HttpOnly; Max-Age"
      ],
      "authHeaderNames": [
        "cookie:csrftoken",
        "cookie:sessionid"
      ],
      "correlationHeaderNames": []
    }
  }
} as const;

test.describe('Observed API workflows generated from real UI traffic', () => {
  test('authentication :: signup, login, and delete account from observed traffic', async () => {
    const api = await request.newContext({ baseURL });
    const account = createObservedApiAccount();

    const signupStartCsrf = await fetchCsrfToken(api, '/login');
    const signupStartResponse = await postForm(
      api,
      '/signup',
      {
        "csrfmiddlewaretoken": signupStartCsrf,
        "name": account.name,
        "email": account.email,
        "form_type": "signup",
      },
      '/login',
    );

    expect(signupStartResponse.status()).toBe(200);
    expect(normalizeContentType(signupStartResponse.headers()['content-type'])).toBe('text/html');
    await expectHtmlContains(signupStartResponse, ["Enter Account Information"]);

    const signupCreateCsrf = await fetchCsrfToken(api, '/signup');
    const signupCreateResponse = await postForm(
      api,
      '/signup',
      {
        "csrfmiddlewaretoken": signupCreateCsrf,
        "title": "Mr",
        "name": account.name,
        "email_address": account.email,
        "password": account.password,
        "days": "10",
        "months": "5",
        "years": "1995",
        "first_name": account.firstName,
        "last_name": account.lastName,
        "company": account.company,
        "address1": account.address1,
        "address2": account.address2,
        "country": account.country,
        "state": account.state,
        "city": account.city,
        "zipcode": account.zipcode,
        "mobile_number": account.mobileNumber,
        "form_type": "create_account",
      },
      '/signup',
      0,
    );

    expect(signupCreateResponse.status()).toBe(302);
    expect(normalizeContentType(signupCreateResponse.headers()['content-type'])).toBe('text/html');
    expect(signupCreateResponse.headers()['location']).toBe('/account_created');

    const accountCreatedPage = await api.get('/account_created');
    expect(accountCreatedPage.ok()).toBeTruthy();
    await expectHtmlContains(accountCreatedPage, ["Account Created!"]);

    const loginCsrf = await fetchCsrfToken(api, '/login');
    const loginResponse = await postForm(
      api,
      '/login',
      {
        "csrfmiddlewaretoken": loginCsrf,
        "email": account.email,
        "password": account.password,
      },
      '/login',
      0,
    );

    expect(loginResponse.status()).toBe(302);
    expect(normalizeContentType(loginResponse.headers()['content-type'])).toBe('text/html');
    expect(loginResponse.headers()['location']).toBe('/');

    const loggedInHomePage = await api.get('/');
    expect(loggedInHomePage.ok()).toBeTruthy();
    await expectHtmlContains(loggedInHomePage, ['Logged in as']);

    const deleteResponse = await api.get('/delete_account');
    expect(deleteResponse.status()).toBe(200);
    expect(normalizeContentType(deleteResponse.headers()['content-type'])).toBe('text/html');
    await expectHtmlContains(deleteResponse, ["Account Deleted!"]);

    await api.dispose();
  });

  test('authentication :: invalid login returns the observed error response', async () => {
    const api = await request.newContext({ baseURL });
    const loginCsrf = await fetchCsrfToken(api, '/login');

    const response = await postForm(
      api,
      '/login',
      {
        "csrfmiddlewaretoken": loginCsrf,
        "email": 'invalid.user@example.com',
        "password": 'incorrect-password',
      },
      '/login',
    );

    expect(response.status()).toBe(200);
    expect(normalizeContentType(response.headers()['content-type'])).toBe('text/html');
    await expectHtmlContains(response, ["Your email or password is incorrect!"]);

    await api.dispose();
  });

  test('cart :: add and delete item through observed backend endpoints', async () => {
    const api = await request.newContext({ baseURL });

    const addResponse = await api.get('/add_to_cart/1?quantity=2');
    expect(addResponse.status()).toBe(200);
    expect(normalizeContentType(addResponse.headers()['content-type'])).toBe('text/html');

    const cartResponse = await api.get('/view_cart');
    expect(cartResponse.ok()).toBeTruthy();
    await expectHtmlContains(cartResponse, ["product-1"]);

    const deleteResponse = await api.get('/delete_cart/1');
    expect(deleteResponse.status()).toBe(200);
    expect(normalizeContentType(deleteResponse.headers()['content-type'])).toBe('text/html');

    const cartAfterDeleteResponse = await api.get('/view_cart');
    expect(cartAfterDeleteResponse.ok()).toBeTruthy();
    const cartAfterDeleteBody = await cartAfterDeleteResponse.text();
    expect(cartAfterDeleteBody.includes('product-1')).toBeFalsy();

    await api.dispose();
  });
});
