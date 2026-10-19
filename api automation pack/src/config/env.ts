import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type AuthConfig = {
  enabled: boolean;
  tokenEnv?: string;
  loginPath?: string;
  usernameEnv?: string;
  passwordEnv?: string;
  tokenJsonPath?: string;
};

export type EnvironmentConfig = {
  envName: string;
  baseURL: string;
  auth: AuthConfig;
};

const ensureTrailingSlash = (value: string): string => (value.endsWith('/') ? value : `${value}/`);

const readEnvironmentFile = (envName: string): Partial<EnvironmentConfig> => {
  const envFile = path.resolve(__dirname, '../../config/environments', `${envName}.json`);
  if (!existsSync(envFile)) {
    return {};
  }

  return JSON.parse(readFileSync(envFile, 'utf-8')) as Partial<EnvironmentConfig>;
};

export const loadEnvironmentConfig = (): EnvironmentConfig => {
  const envName = process.env.TEST_ENV || 'qa';
  const fileConfig = readEnvironmentFile(envName);

  return {
    envName,
    baseURL: ensureTrailingSlash(process.env.API_BASE_URL || fileConfig.baseURL || 'https://jsonplaceholder.typicode.com/'),
    auth: {
      enabled: process.env.API_AUTH_ENABLED
        ? process.env.API_AUTH_ENABLED === 'true'
        : fileConfig.auth?.enabled ?? false,
      tokenEnv: process.env.API_AUTH_TOKEN_ENV || fileConfig.auth?.tokenEnv || 'API_AUTH_TOKEN',
      loginPath: process.env.API_AUTH_LOGIN_PATH || fileConfig.auth?.loginPath || './auth/login',
      usernameEnv: process.env.API_AUTH_USERNAME_ENV || fileConfig.auth?.usernameEnv || 'API_USERNAME',
      passwordEnv: process.env.API_AUTH_PASSWORD_ENV || fileConfig.auth?.passwordEnv || 'API_PASSWORD',
      tokenJsonPath: process.env.API_AUTH_TOKEN_PATH || fileConfig.auth?.tokenJsonPath || 'token',
    },
  };
};
