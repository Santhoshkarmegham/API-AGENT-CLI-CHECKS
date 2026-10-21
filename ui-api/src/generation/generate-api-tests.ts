import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type DiscoveryCandidate = {
  id: string;
  module: string;
  method: string;
  normalizedPath: string;
  variant: string;
  samplePath: string;
  sampleQuery: Record<string, string>;
  sampleRequestBody: {
    kind: string;
    fields: Record<string, string>;
  };
  uiActions: string[];
  resourceTypes: string[];
  observedStatusCodes: number[];
  observedContentTypes: string[];
  observedBodyMarkers: string[];
  requestCookieNames: string[];
  responseSetCookieNames: string[];
  authHeaderNames: string[];
  correlationHeaderNames: string[];
};

type DiscoveryReport = {
  generatedAt: string;
  candidates: DiscoveryCandidate[];
};

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '../..');
  const testResultsDir = path.join(projectRoot, 'test-results');
  const latestDiscoveryPath = await findLatestDiscoveryReport(testResultsDir);

  if (!latestDiscoveryPath) {
    throw new Error('No api-discovery.json file found under test-results. Run the UI discovery flow first.');
  }

  const discovery = JSON.parse(await readFile(latestDiscoveryPath, 'utf-8')) as DiscoveryReport;
  const generatedDir = path.join(projectRoot, 'tests', 'generated');
  const outputFile = path.join(generatedDir, 'observed-api.spec.ts');

  await mkdir(generatedDir, { recursive: true });
  await writeFile(outputFile, renderSpec(discovery), 'utf-8');

  process.stdout.write(`Generated ${path.relative(projectRoot, outputFile)} from ${path.relative(projectRoot, latestDiscoveryPath)}\n`);
}

async function findLatestDiscoveryReport(testResultsDir: string): Promise<string | null> {
  const entries = await readdir(testResultsDir, { withFileTypes: true });
  const candidateDirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(testResultsDir, entry.name));

  const reports = await Promise.all(
    candidateDirs.map(async directory => {
      const discoveryPath = path.join(directory, 'api-discovery.json');

      try {
        const stats = await readFile(discoveryPath, 'utf-8');
        return { discoveryPath, generatedAt: JSON.parse(stats).generatedAt as string };
      } catch {
        return null;
      }
    }),
  );

  const latest = reports
    .filter((report): report is { discoveryPath: string; generatedAt: string } => report !== null)
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0];

  return latest?.discoveryPath ?? null;
}

function renderSpec(discovery: DiscoveryReport): string {
  const byId = Object.fromEntries(discovery.candidates.map(candidate => [candidate.id, candidate]));
  const signupStart = discovery.candidates.find(candidate => candidate.normalizedPath === '/signup' && candidate.variant === 'signup');
  const signupCreate = discovery.candidates.find(candidate => candidate.normalizedPath === '/signup' && candidate.variant === 'create_account');
  const login = discovery.candidates.find(candidate => candidate.normalizedPath === '/login' && candidate.variant === 'default');
  const addToCart = discovery.candidates.find(candidate => candidate.normalizedPath === '/add_to_cart/{productId}');
  const deleteCart = discovery.candidates.find(candidate => candidate.normalizedPath === '/delete_cart/{productId}');
  const deleteAccount = discovery.candidates.find(candidate => candidate.normalizedPath === '/delete_account');

  const authWorkflowTest = signupStart && signupCreate && login && deleteAccount
    ? renderAuthWorkflowTest(signupStart, signupCreate, login, deleteAccount)
    : `test.skip('authentication workflow APIs were not fully observed in the UI run', async () => {\n  test.skip();\n});`;

  const invalidLoginTest = login
    ? renderInvalidLoginTest(login)
    : `test.skip('invalid login API scenario was not observed in the UI run', async () => {\n  test.skip();\n});`;

  const cartWorkflowTest = addToCart && deleteCart
    ? renderCartWorkflowTest(addToCart, deleteCart)
    : `test.skip('cart workflow APIs were not fully observed in the UI run', async () => {\n  test.skip();\n});`;

  return `import { test, expect, request } from '@playwright/test';
import { createObservedApiAccount, expectHtmlContains, extractPathParameter, fetchCsrfToken, normalizeContentType, postForm } from '../../src/api/observed-api-helpers';

const baseURL = 'https://automationexercise.com';

const discovery = ${JSON.stringify({ generatedAt: discovery.generatedAt, candidates: byId }, null, 2)} as const;

test.describe('Observed API workflows generated from real UI traffic', () => {
${indent(authWorkflowTest, 2)}

${indent(invalidLoginTest, 2)}

${indent(cartWorkflowTest, 2)}
});
`;
}

function renderAuthWorkflowTest(signupStart: DiscoveryCandidate, signupCreate: DiscoveryCandidate, login: DiscoveryCandidate, deleteAccount: DiscoveryCandidate): string {
  return `test('authentication :: signup, login, and delete account from observed traffic', async () => {
  const api = await request.newContext({ baseURL });
  const account = createObservedApiAccount();

  const signupStartCsrf = await fetchCsrfToken(api, '/login');
  const signupStartResponse = await postForm(
    api,
    '${signupStart.samplePath}',
    {
${indent(renderFormFields(signupStart.sampleRequestBody.fields, 'signupStartCsrf', 'account'), 6)}
    },
    '/login',
  );

  expect(signupStartResponse.status()).toBe(${firstStatus(signupStart)});
  expect(normalizeContentType(signupStartResponse.headers()['content-type'])).toBe('${firstContentType(signupStart)}');
  await expectHtmlContains(signupStartResponse, ${JSON.stringify(filterMarkers(signupStart.observedBodyMarkers, ['Enter Account Information']))});

  const signupCreateCsrf = await fetchCsrfToken(api, '/signup');
  const signupCreateResponse = await postForm(
    api,
    '${signupCreate.samplePath}',
    {
${indent(renderFormFields(signupCreate.sampleRequestBody.fields, 'signupCreateCsrf', 'account'), 6)}
    },
    '/signup',
    0,
  );

  expect(signupCreateResponse.status()).toBe(302);
  expect(normalizeContentType(signupCreateResponse.headers()['content-type'])).toBe('${firstContentType(signupCreate)}');
  expect(signupCreateResponse.headers()['location']).toBe('/account_created');

  const accountCreatedPage = await api.get('/account_created');
  expect(accountCreatedPage.ok()).toBeTruthy();
  await expectHtmlContains(accountCreatedPage, ${JSON.stringify(filterMarkers(signupCreate.observedBodyMarkers, ['Account Created!']))});

  const loginCsrf = await fetchCsrfToken(api, '/login');
  const loginResponse = await postForm(
    api,
    '${login.samplePath}',
    {
${indent(renderFormFields(login.sampleRequestBody.fields, 'loginCsrf', 'account'), 6)}
    },
    '/login',
    0,
  );

  expect(loginResponse.status()).toBe(302);
  expect(normalizeContentType(loginResponse.headers()['content-type'])).toBe('${firstContentType(login)}');
  expect(loginResponse.headers()['location']).toBe('/');

  const loggedInHomePage = await api.get('/');
  expect(loggedInHomePage.ok()).toBeTruthy();
  await expectHtmlContains(loggedInHomePage, ['Logged in as']);

  const deleteResponse = await api.get('${deleteAccount.samplePath}');
  expect(deleteResponse.status()).toBe(${firstStatus(deleteAccount)});
  expect(normalizeContentType(deleteResponse.headers()['content-type'])).toBe('${firstContentType(deleteAccount)}');
  await expectHtmlContains(deleteResponse, ${JSON.stringify(filterMarkers(deleteAccount.observedBodyMarkers, ['Account Deleted!']))});

  await api.dispose();
});`;
}

function renderInvalidLoginTest(login: DiscoveryCandidate): string {
  return `test('authentication :: invalid login returns the observed error response', async () => {
  const api = await request.newContext({ baseURL });
  const loginCsrf = await fetchCsrfToken(api, '/login');

  const response = await postForm(
    api,
    '${login.samplePath}',
    {
${indent(renderInvalidLoginFields(login.sampleRequestBody.fields, 'loginCsrf'), 6)}
    },
    '/login',
  );

  expect(response.status()).toBe(${firstStatus(login)});
  expect(normalizeContentType(response.headers()['content-type'])).toBe('${firstContentType(login)}');
  await expectHtmlContains(response, ${JSON.stringify(filterMarkers(login.observedBodyMarkers, ['Your email or password is incorrect!']))});

  await api.dispose();
});`;
}

function renderCartWorkflowTest(addToCart: DiscoveryCandidate, deleteCart: DiscoveryCandidate): string {
  const addedProductId = extractPathParameterFromSample(addToCart.samplePath);
  const deletedPath = deleteCart.samplePath.replace(/\d+$/, addedProductId);

  return `test('cart :: add and delete item through observed backend endpoints', async () => {
  const api = await request.newContext({ baseURL });

  const addResponse = await api.get('${withQuery(addToCart.samplePath, addToCart.sampleQuery)}');
  expect(addResponse.status()).toBe(${firstStatus(addToCart)});
  expect(normalizeContentType(addResponse.headers()['content-type'])).toBe('${firstContentType(addToCart)}');

  const cartResponse = await api.get('/view_cart');
  expect(cartResponse.ok()).toBeTruthy();
  await expectHtmlContains(cartResponse, ${JSON.stringify([`product-${addedProductId}`])});

  const deleteResponse = await api.get('${withQuery(deletedPath, deleteCart.sampleQuery)}');
  expect(deleteResponse.status()).toBe(${firstStatus(deleteCart)});
  expect(normalizeContentType(deleteResponse.headers()['content-type'])).toBe('${firstContentType(deleteCart)}');

  const cartAfterDeleteResponse = await api.get('/view_cart');
  expect(cartAfterDeleteResponse.ok()).toBeTruthy();
  const cartAfterDeleteBody = await cartAfterDeleteResponse.text();
  expect(cartAfterDeleteBody.includes('product-${addedProductId}')).toBeFalsy();

  await api.dispose();
});`;
}

function renderFormFields(fields: Record<string, string>, csrfVariable: string, accountVariable: string): string {
  return Object.entries(fields)
    .map(([key, value]) => `"${key}": ${mapFieldValue(key, value, csrfVariable, accountVariable)},`)
    .join('\n');
}

function renderInvalidLoginFields(fields: Record<string, string>, csrfVariable: string): string {
  return Object.entries(fields)
    .map(([key, value]) => {
      if (key === 'csrfmiddlewaretoken') {
        return `"${key}": ${csrfVariable},`;
      }

      if (key === 'email' || key === 'email_address') {
        return `"${key}": 'invalid.user@example.com',`;
      }

      if (key === 'password') {
        return `"${key}": 'incorrect-password',`;
      }

      return `"${key}": ${JSON.stringify(value)},`;
    })
    .join('\n');
}

function mapFieldValue(key: string, value: string, csrfVariable: string, accountVariable: string): string {
  if (key === 'csrfmiddlewaretoken') {
    return csrfVariable;
  }

  if (key === 'email' || key === 'email_address') {
    return `${accountVariable}.email`;
  }

  if (key === 'name') {
    return `${accountVariable}.name`;
  }

  if (key === 'password') {
    return `${accountVariable}.password`;
  }

  if (key === 'first_name') {
    return `${accountVariable}.firstName`;
  }

  if (key === 'last_name') {
    return `${accountVariable}.lastName`;
  }

  if (key === 'company') {
    return `${accountVariable}.company`;
  }

  if (key === 'address1') {
    return `${accountVariable}.address1`;
  }

  if (key === 'address2') {
    return `${accountVariable}.address2`;
  }

  if (key === 'country') {
    return `${accountVariable}.country`;
  }

  if (key === 'state') {
    return `${accountVariable}.state`;
  }

  if (key === 'city') {
    return `${accountVariable}.city`;
  }

  if (key === 'zipcode') {
    return `${accountVariable}.zipcode`;
  }

  if (key === 'mobile_number') {
    return `${accountVariable}.mobileNumber`;
  }

  return JSON.stringify(value);
}

function withQuery(samplePath: string, sampleQuery: Record<string, string>): string {
  const query = new URLSearchParams(sampleQuery).toString();
  return query ? `${samplePath}?${query}` : samplePath;
}

function extractPathParameterFromSample(samplePath: string): string {
  return samplePath.split('/').filter(Boolean).at(-1) ?? '';
}

function firstStatus(candidate: DiscoveryCandidate): number {
  return candidate.observedStatusCodes[0] ?? 200;
}

function firstContentType(candidate: DiscoveryCandidate): string {
  return candidate.observedContentTypes[0] ?? 'text/html';
}

function filterMarkers(markers: string[], defaults: string[]): string[] {
  const result = markers.filter(Boolean);
  return result.length > 0 ? result : defaults;
}

function indent(text: string, spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(line => (line ? `${prefix}${line}` : line))
    .join('\n');
}

void main();
