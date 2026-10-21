import { writeFile } from 'node:fs/promises';

import { test as base, expect } from '@playwright/test';

import { NetworkCapture } from '../utils/network-capture';
import { UiActionTracker } from '../utils/ui-action-tracker';

type BrowserEventLog = {
  console: Array<{ type: string; text: string }>;
  pageErrors: string[];
  requestFailures: Array<{ url: string; method: string; errorText?: string }>;
};

export const test = base.extend<{ evidenceCollector: void; actionTracker: UiActionTracker }>({
  actionTracker: async ({}, use) => {
    await use(new UiActionTracker());
  },
  evidenceCollector: [
    async ({ page, actionTracker }, use, testInfo) => {
      const browserEvents: BrowserEventLog = {
        console: [],
        pageErrors: [],
        requestFailures: [],
      };

      const networkCapture = new NetworkCapture(page, testInfo, actionTracker);

      await page.route(/googlesyndication|doubleclick|googleadservices|adtrafficquality/i, route => {
        route.abort();
      });

      page.on('console', message => {
        if (message.type() === 'error' || message.type() === 'warning') {
          browserEvents.console.push({
            type: message.type(),
            text: message.text(),
          });
        }
      });

      page.on('pageerror', error => {
        browserEvents.pageErrors.push(error.message);
      });

      page.on('requestfailed', request => {
        browserEvents.requestFailures.push({
          url: request.url(),
          method: request.method(),
          errorText: request.failure()?.errorText,
        });
      });

      networkCapture.attach();

      await use();

      await networkCapture.flush();
      await writeFile(
        testInfo.outputPath('browser-events.json'),
        JSON.stringify(browserEvents, null, 2),
        'utf-8',
      );

      if (testInfo.status !== testInfo.expectedStatus) {
        await page.screenshot({
          path: testInfo.outputPath('failure-screenshot.png'),
          fullPage: true,
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
