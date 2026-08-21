// Lumen Bank — fictional demo data shared by the showcase screens.

export const currency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

export interface Account {
  id: string;
  name: string;
  last4: string;
  balance: number;
  deltaLabel: string;
  direction: 'up' | 'down';
  trend: number[];
}

export const ACCOUNTS: Account[] = [
  {
    id: 'chk',
    name: 'Everyday Checking',
    last4: '4821',
    balance: 4862.13,
    deltaLabel: '+$318.40 this week',
    direction: 'up',
    trend: [4210, 4380, 4295, 4520, 4468, 4610, 4544, 4700, 4655, 4790, 4732, 4862],
  },
  {
    id: 'sav',
    name: 'High-Yield Savings',
    last4: '7302',
    balance: 18940.55,
    deltaLabel: '+$92.15 interest YTD',
    direction: 'up',
    trend: [17800, 17950, 18100, 18100, 18320, 18400, 18475, 18600, 18620, 18780, 18855, 18941],
  },
  {
    id: 'cc',
    name: 'Lumen Rewards Card',
    last4: '1187',
    balance: -642.8,
    deltaLabel: '$642.80 owed · due Sep 3',
    direction: 'down',
    trend: [-180, -240, -310, -295, -360, -410, -455, -480, -540, -575, -610, -643],
  },
];

export const TREND_LABELS = [
  'May 31', 'Jun 7', 'Jun 14', 'Jun 21', 'Jun 28', 'Jul 5',
  'Jul 12', 'Jul 19', 'Jul 26', 'Aug 2', 'Aug 9', 'Aug 16',
];

export const SPENDING = [
  { label: 'Groceries', value: 684.2 },
  { label: 'Dining', value: 412.75 },
  { label: 'Shopping', value: 356.4 },
  { label: 'Utilities', value: 291.06 },
  { label: 'Transport', value: 238.5 },
  { label: 'Entertainment', value: 187.98 },
];

export const CATEGORIES = [
  'Groceries',
  'Dining',
  'Shopping',
  'Utilities',
  'Transport',
  'Entertainment',
  'Income',
] as const;

export type Category = (typeof CATEGORIES)[number];

const CATEGORY_ICONS: Record<Category, string> = {
  Groceries: 'shopping_basket',
  Dining: 'restaurant',
  Shopping: 'shopping_bag',
  Utilities: 'bolt',
  Transport: 'directions_bus',
  Entertainment: 'movie',
  Income: 'payments',
};

export const categoryIcon = (c: Category) => CATEGORY_ICONS[c];

export interface Tx {
  id: string;
  date: string;
  merchant: string;
  category: Category;
  amount: number;
  account: string;
  reference: string;
  status: 'Posted' | 'Pending';
  note: string;
}

export const TRANSACTIONS: Tx[] = [
  {
    id: 'tx-1041',
    date: 'Aug 19',
    merchant: 'Greenfield Grocers',
    category: 'Groceries',
    amount: -86.42,
    account: 'Checking ··4821',
    reference: 'LB-2026-081941',
    status: 'Pending',
    note: 'Weekly shop, incl. household items',
  },
  {
    id: 'tx-1040',
    date: 'Aug 18',
    merchant: 'Cindersmith Coffee',
    category: 'Dining',
    amount: -7.85,
    account: 'Rewards Card ··1187',
    reference: 'LB-2026-081822',
    status: 'Posted',
    note: 'Oat flat white and a cardamom bun',
  },
  {
    id: 'tx-1039',
    date: 'Aug 17',
    merchant: 'Brightline Transit',
    category: 'Transport',
    amount: -46.0,
    account: 'Checking ··4821',
    reference: 'LB-2026-081703',
    status: 'Posted',
    note: 'Monthly commuter pass top-up',
  },
  {
    id: 'tx-1038',
    date: 'Aug 15',
    merchant: 'Meridian Labs Payroll',
    category: 'Income',
    amount: 2450.0,
    account: 'Checking ··4821',
    reference: 'LB-2026-081501',
    status: 'Posted',
    note: 'Salary, second half of August',
  },
  {
    id: 'tx-1037',
    date: 'Aug 14',
    merchant: 'Juniper & Sage Bistro',
    category: 'Dining',
    amount: -64.3,
    account: 'Rewards Card ··1187',
    reference: 'LB-2026-081418',
    status: 'Posted',
    note: 'Dinner for two, anniversary',
  },
  {
    id: 'tx-1036',
    date: 'Aug 13',
    merchant: 'Streamly Plus',
    category: 'Entertainment',
    amount: -14.99,
    account: 'Rewards Card ··1187',
    reference: 'LB-2026-081307',
    status: 'Posted',
    note: 'Monthly subscription renewal',
  },
  {
    id: 'tx-1035',
    date: 'Aug 12',
    merchant: 'Northwind Utilities',
    category: 'Utilities',
    amount: -132.54,
    account: 'Checking ··4821',
    reference: 'LB-2026-081209',
    status: 'Posted',
    note: 'Electricity and water, July cycle',
  },
  {
    id: 'tx-1034',
    date: 'Aug 11',
    merchant: 'Atlas Hardware',
    category: 'Shopping',
    amount: -58.21,
    account: 'Checking ··4821',
    reference: 'LB-2026-081116',
    status: 'Posted',
    note: 'Shelf brackets and wall anchors',
  },
  {
    id: 'tx-1033',
    date: 'Aug 10',
    merchant: 'Greenfield Grocers',
    category: 'Groceries',
    amount: -92.77,
    account: 'Checking ··4821',
    reference: 'LB-2026-081034',
    status: 'Posted',
    note: 'Weekly shop',
  },
  {
    id: 'tx-1032',
    date: 'Aug 9',
    merchant: 'Orbit Fitness',
    category: 'Entertainment',
    amount: -39.0,
    account: 'Checking ··4821',
    reference: 'LB-2026-080905',
    status: 'Posted',
    note: 'Gym membership, August',
  },
  {
    id: 'tx-1031',
    date: 'Aug 8',
    merchant: 'Pageturner Books',
    category: 'Shopping',
    amount: -31.5,
    account: 'Rewards Card ··1187',
    reference: 'LB-2026-080812',
    status: 'Posted',
    note: 'Two paperbacks and a notebook',
  },
  {
    id: 'tx-1030',
    date: 'Aug 7',
    merchant: 'Casa Verde Restaurant',
    category: 'Dining',
    amount: -48.6,
    account: 'Rewards Card ··1187',
    reference: 'LB-2026-080719',
    status: 'Posted',
    note: 'Team lunch, reimbursable',
  },
  {
    id: 'tx-1029',
    date: 'Aug 5',
    merchant: 'Brightline Transit',
    category: 'Transport',
    amount: -18.5,
    account: 'Checking ··4821',
    reference: 'LB-2026-080502',
    status: 'Posted',
    note: 'Airport express, one way',
  },
  {
    id: 'tx-1028',
    date: 'Aug 4',
    merchant: 'Interest payment',
    category: 'Income',
    amount: 12.4,
    account: 'Savings ··7302',
    reference: 'LB-2026-080401',
    status: 'Posted',
    note: 'Monthly interest, 3.85% APY',
  },
];

export const RECENT_ACTIVITY = TRANSACTIONS.slice(0, 5);

export interface Payee {
  value: string;
  label: string;
  detail: string;
}

export const PAYEES: Payee[] = [
  { value: 'sav-7302', label: 'My High-Yield Savings ··7302', detail: 'Internal transfer' },
  { value: 'maya', label: 'Maya Alvarez — Lumen ··3310', detail: 'Instant' },
  { value: 'daniel', label: 'Daniel Okafor — Harborview CU ··8841', detail: '1–2 business days' },
  { value: 'priya', label: 'Priya Raman — Lumen ··5527', detail: 'Instant' },
  { value: 'tomas', label: 'Tomás Ferreira — Crestline Bank ··0193', detail: '1–2 business days' },
];

export interface Budget {
  id: string;
  name: string;
  spent: number;
  limit: number;
}

export const BUDGETS: Budget[] = [
  { id: 'groceries', name: 'Groceries', spent: 684.2, limit: 800 },
  { id: 'dining', name: 'Dining out', spent: 412.75, limit: 400 },
  { id: 'shopping', name: 'Shopping', spent: 356.4, limit: 500 },
  { id: 'utilities', name: 'Utilities', spent: 291.06, limit: 350 },
  { id: 'transport', name: 'Transport', spent: 238.5, limit: 300 },
  { id: 'entertainment', name: 'Entertainment', spent: 187.98, limit: 250 },
];
