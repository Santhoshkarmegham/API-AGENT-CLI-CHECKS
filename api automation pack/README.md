# API Automation Pack

Playwright + TypeScript API automation framework focused on Products API automation.

## Features

- Playwright request-based API tests
- TypeScript support
- Reusable request and resource helpers
- Environment-based configuration
- Centralized auth, validation, and cleanup helpers
- External JSON test data
- Independent and chained Products workflows

## Project structure

```text
api automation pack/
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── config/
│   └── environments/
│       └── qa.json
├── src/
│   ├── auth/
│   │   └── token-manager.ts
│   ├── clients/
│   │   ├── api-client.ts
│   │   └── products-api.ts
│   ├── config/
│   │   └── env.ts
│   ├── data/
│   │   └── product-data.ts
│   └── utils/
│       ├── api-response-validator.ts
│       ├── cleanup-manager.ts
│       ├── product-assertions.ts
│       └── response-store.ts
├── test-data/
│   └── products/
│       ├── lifecycle-create.json
│       ├── lifecycle-patch.json
│       ├── lifecycle-put.json
│       └── list-products.json
└── tests/
    ├── products-lifecycle.e2e.spec.ts
    └── products.spec.ts
```

## Setup

```bash
npm install
```

## Run tests

```bash
npm test
```

## Run smoke tests

```bash
npm run test:smoke
```

## View report

```bash
npm run report
```

## Configure environment

Set the environment name or base URL before running tests:

```bash
TEST_ENV=qa npm test
# or
API_BASE_URL=https://your-api-host/v1/ npm test
```
