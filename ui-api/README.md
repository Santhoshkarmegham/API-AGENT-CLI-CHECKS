# ui-api

Non-BDD Playwright + TypeScript automation for [automationexercise.com](https://automationexercise.com/).

## What is included

- Phase 1 UI journey automation in Chromium
- Dynamic Playwright locators with resilient synchronization
- Failure evidence capture: screenshots, traces, videos, browser errors, request failures
- Network traffic discovery output to support the next API automation phase
- Phase 4 maintainable API framework with centralized client, services, fixtures, validators, config, logging, and tagged suites

## Folder structure

- `src/pages`: reusable page objects
- `src/api`: shared API helpers
- `src/auth`: authentication and token management
- `src/clients`: centralized API client and request builder
- `src/config`: environment-specific configuration
- `src/services`: reusable API services grouped by module
- `src/store`: response store for chaining
- `src/types`: request and response contracts
- `src/validators`: common API response validator
- `src/utils`: account generation and network/browser evidence helpers
- `src/reporting`: execution summary and custom-report generators
- `src/fixtures`: shared Playwright fixtures for logging and evidence capture
- `test-data/api`: centralized JSON test data
- `tests`: executable UI journeys
- `deliverables`: generated inventory, discovery mapping, coverage, and execution summaries

## Run

```bash
npm install
npm run test
npm run test:smoke
npm run test:regression
npm run test:negative
npm run test:e2e
npm run allure
```

## API suite commands

```bash
npm run test:api
npm run test:smoke
npm run test:regression
npm run test:negative
npm run test:e2e
npm run allure
```

## Deliverables

- `deliverables/api-inventory.json`
- `deliverables/ui-to-api-discovery-mapping.json`
- `deliverables/coverage-matrix.md`
- `deliverables/test-execution-summary.md`
- `deliverables/custom-report.html`
- `allure-report/`
- `playwright-report/`

## Key outputs

- `playwright-report/`: HTML execution report
- `allure-report/`: Allure execution report
- `test-results/results.json`: JSON report
- `test-results/<test-name>/network-traffic.json`: captured request and response metadata
- `test-results/<test-name>/browser-events.json`: console errors, page errors, and failed requests
- `test-results/<test-name>/api-log.json`: centralized API request and response logs
- `deliverables/custom-report.html`: custom HTML coverage and execution summary
