import { createTemporaryAccount } from '../data/test-account';
import type { AuthAccount, AuthWorkflowResponses, LoginRequest, SignupCreateRequest, SignupStartRequest } from '../types/auth.types';
import type { ResponseSnapshot } from '../types/common';
import { ApiResponseValidator } from '../validators/api-response-validator';
import { ApiClient } from '../clients/api-client';
import { TokenManager } from '../auth/token-manager';
import { ResponseStore } from '../store/response-store';

export class AuthApiService {
  constructor(
    private readonly apiClient: ApiClient,
    private readonly tokenManager: TokenManager,
    private readonly responseStore: ResponseStore<ResponseSnapshot>,
  ) {}

  createAccountModel(): AuthAccount {
    const account = createTemporaryAccount();

    return {
      title: 'Mr',
      name: account.name,
      email: account.email,
      password: account.password,
      birthDay: account.birthDate,
      birthMonth: account.birthMonth,
      birthYear: account.birthYear,
      firstName: account.firstName,
      lastName: account.lastName,
      company: account.company,
      address1: account.address1,
      address2: account.address2,
      country: account.country,
      state: account.state,
      city: account.city,
      zipcode: account.zipcode,
      mobileNumber: account.mobileNumber,
    };
  }

  async beginSignup(account: AuthAccount): Promise<ResponseSnapshot> {
    const csrfToken = await this.tokenManager.getCsrfToken('/login', true);
    const response = await this.apiClient.postForm('/signup', this.buildSignupStartRequest(account, csrfToken), {
      refererPath: '/login',
    });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('auth.signupStart', snapshot);
    return snapshot;
  }

  async createAccount(account: AuthAccount): Promise<ResponseSnapshot> {
    const csrfToken = await this.tokenManager.getCsrfToken('/signup', true);
    const response = await this.apiClient.postForm('/signup', this.buildCreateAccountRequest(account, csrfToken), {
      refererPath: '/signup',
      maxRedirects: 0,
    });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('auth.createAccount', snapshot);
    return snapshot;
  }

  async fetchAccountCreatedPage(): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get('/account_created', { refererPath: '/signup' });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('auth.accountCreated', snapshot);
    return snapshot;
  }

  async login(request: LoginRequest, maxRedirects?: number): Promise<ResponseSnapshot> {
    const csrfToken = await this.tokenManager.getCsrfToken('/login', true);
    const response = await this.apiClient.postForm('/login', {
      csrfmiddlewaretoken: csrfToken,
      email: request.email,
      password: request.password,
    }, {
      refererPath: '/login',
      ...(maxRedirects !== undefined ? { maxRedirects } : {}),
    });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('auth.login', snapshot);
    return snapshot;
  }

  async fetchHome(): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get('/', { refererPath: '/' });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('auth.home', snapshot);
    return snapshot;
  }

  async logout(): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get('/logout', { refererPath: '/' });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('auth.logout', snapshot);
    return snapshot;
  }

  async deleteAccount(): Promise<ResponseSnapshot> {
    const response = await this.apiClient.get('/delete_account', { refererPath: '/' });
    const snapshot = await ApiResponseValidator.capture(response);
    this.responseStore.set('auth.deleteAccount', snapshot);
    return snapshot;
  }

  async runObservedAuthWorkflow(): Promise<AuthWorkflowResponses> {
    const account = this.createAccountModel();
    const signupStart = await this.beginSignup(account);
    const signupCreate = await this.createAccount(account);
    const accountCreated = await this.fetchAccountCreatedPage();
    const login = await this.login({ email: account.email, password: account.password }, 0);
    const home = await this.fetchHome();
    const deleteAccount = await this.deleteAccount();

    return {
      signupStart,
      signupCreate,
      accountCreated,
      login,
      home,
      deleteAccount,
    };
  }

  private buildSignupStartRequest(account: AuthAccount, csrfToken: string): SignupStartRequest & { csrfmiddlewaretoken: string } {
    return {
      csrfmiddlewaretoken: csrfToken,
      name: account.name,
      email: account.email,
      form_type: 'signup',
    };
  }

  private buildCreateAccountRequest(account: AuthAccount, csrfToken: string): SignupCreateRequest & { csrfmiddlewaretoken: string } {
    return {
      csrfmiddlewaretoken: csrfToken,
      title: account.title,
      name: account.name,
      email_address: account.email,
      password: account.password,
      days: account.birthDay,
      months: account.birthMonth,
      years: account.birthYear,
      first_name: account.firstName,
      last_name: account.lastName,
      company: account.company,
      address1: account.address1,
      address2: account.address2,
      country: account.country,
      state: account.state,
      city: account.city,
      zipcode: account.zipcode,
      mobile_number: account.mobileNumber,
      form_type: 'create_account',
    };
  }
}
