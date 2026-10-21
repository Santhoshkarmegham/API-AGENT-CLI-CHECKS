import dev from './environments/dev.json';
import test from './environments/test.json';

import type { EnvironmentConfig } from '../types/common';

const environments: Record<string, EnvironmentConfig> = {
  dev,
  test,
};

export function loadEnvironmentConfig(): EnvironmentConfig {
  const envName = process.env.TEST_ENV ?? 'test';
  const selected = environments[envName];

  if (!selected) {
    throw new Error(`Unsupported TEST_ENV: ${envName}`);
  }

  return {
    ...selected,
    baseURL: process.env.BASE_URL ?? selected.baseURL,
    uiBaseURL: process.env.UI_BASE_URL ?? selected.uiBaseURL,
  };
}
