import type { ResponseSnapshot } from './common';

export interface AuthAccount {
  title: 'Mr';
  name: string;
  email: string;
  password: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  mobileNumber: string;
}

export interface SignupStartRequest {
  name: string;
  email: string;
  form_type: 'signup';
}

export interface SignupCreateRequest {
  title: 'Mr';
  name: string;
  email_address: string;
  password: string;
  days: string;
  months: string;
  years: string;
  first_name: string;
  last_name: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zipcode: string;
  mobile_number: string;
  form_type: 'create_account';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthWorkflowResponses {
  signupStart: ResponseSnapshot;
  signupCreate: ResponseSnapshot;
  accountCreated: ResponseSnapshot;
  login: ResponseSnapshot;
  home: ResponseSnapshot;
  deleteAccount: ResponseSnapshot;
}
