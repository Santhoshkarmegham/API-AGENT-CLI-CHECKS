export interface TestAccount {
  name: string;
  email: string;
  password: string;
  title: 'Mr';
  birthDate: string;
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

export function createTemporaryAccount(): TestAccount {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  return {
    name: `AI Agent ${timestamp}`,
    email: `ai.agent.${timestamp}@example.com`,
    password: `Ae!${timestamp}`,
    title: 'Mr',
    birthDate: '10',
    birthMonth: '5',
    birthYear: '1995',
    firstName: 'AI',
    lastName: `Agent${timestamp.slice(-4)}`,
    company: 'ForgeQE Labs',
    address1: '100 Automation Street',
    address2: 'Suite 10',
    country: 'United States',
    state: 'California',
    city: 'San Francisco',
    zipcode: '94105',
    mobileNumber: `555${timestamp.slice(-7)}`,
  };
}
