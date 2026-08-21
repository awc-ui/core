// Pulseboard — fictional product analytics data for the "Driftline" workspace.
// Everything here is invented; no real companies or products.

export const workspace = {
  name: 'Driftline',
  org: 'Harborlight Labs',
};

// ---------- Overview ----------

export const kpis = [
  {
    id: 'dau',
    label: 'Daily active users',
    value: '18,432',
    delta: '+6.2% vs last week',
    direction: 'up',
    color: 'primary',
    variant: 'area',
    trend: [15210, 15490, 15900, 15720, 16340, 16880, 16510, 17020, 17480, 17260, 17910, 18150, 18040, 18432],
  },
  {
    id: 'sessions',
    label: 'Sessions',
    value: '54,911',
    delta: '+3.8% vs last week',
    direction: 'up',
    color: 'tertiary',
    variant: 'line',
    trend: [48930, 50110, 49480, 51260, 52040, 51680, 52950, 52310, 53470, 54120, 53760, 54390, 54680, 54911],
  },
  {
    id: 'session-length',
    label: 'Median session length',
    value: '7m 24s',
    delta: '-1.9% vs last week',
    direction: 'down',
    color: 'warning',
    variant: 'line',
    trend: [472, 468, 471, 465, 460, 463, 458, 455, 459, 452, 449, 451, 446, 444],
  },
  {
    id: 'retention',
    label: '7-day retention',
    value: '41.3%',
    delta: '+0.8 pts vs last week',
    direction: 'up',
    color: 'success',
    variant: 'bar',
    trend: [38.9, 39.2, 39.0, 39.6, 40.1, 39.8, 40.4, 40.2, 40.7, 41.0, 40.8, 41.1, 41.2, 41.3],
  },
];

export const dauDays = [
  'Jul 24', 'Jul 25', 'Jul 26', 'Jul 27', 'Jul 28', 'Jul 29', 'Jul 30',
  'Jul 31', 'Aug 1', 'Aug 2', 'Aug 3', 'Aug 4', 'Aug 5', 'Aug 6',
  'Aug 7', 'Aug 8', 'Aug 9', 'Aug 10', 'Aug 11', 'Aug 12', 'Aug 13',
  'Aug 14', 'Aug 15', 'Aug 16', 'Aug 17', 'Aug 18', 'Aug 19', 'Aug 20',
];

export const dauSeries = [
  {
    label: 'Web',
    data: [6210, 6320, 5480, 5390, 6510, 6640, 6580, 6720, 6850, 6790, 5920, 5860, 6980, 7110, 7060, 7190, 7240, 6310, 6280, 7350, 7410, 7380, 7460, 7520, 6480, 6440, 7590, 7640],
  },
  {
    label: 'iOS',
    data: [4110, 4180, 4390, 4420, 4160, 4230, 4290, 4340, 4310, 4380, 4560, 4610, 4420, 4470, 4520, 4490, 4550, 4700, 4740, 4580, 4620, 4660, 4630, 4690, 4820, 4860, 4710, 4750],
  },
  {
    label: 'Android',
    data: [3480, 3520, 3690, 3720, 3550, 3610, 3580, 3660, 3700, 3670, 3840, 3880, 3720, 3760, 3810, 3790, 3850, 3960, 3990, 3870, 3910, 3950, 3930, 3980, 4080, 4110, 4010, 4042],
  },
];

export const adoptionFeatures = ['Smart Search', 'Live Cursors', 'Board Templates', 'Offline Mode', 'Slash Commands', 'Guest Links'];

export const adoptionSeries = [
  { label: 'Free plan', data: [61, 38, 44, 19, 27, 33] },
  { label: 'Pro plan', data: [83, 71, 66, 52, 58, 74] },
];

// ---------- Funnels ----------

export const periods = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export const cohortWeeks = ['Week 0', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'];

export const cohortsByPeriod = {
  '7d': [
    { label: 'Aug 4 cohort', data: [100, 58, 47, 42, 39, 37, 36, 35, 34] },
    { label: 'Aug 11 cohort', data: [100, 61, 50, 45, 42, 40, 38, null, null] },
    { label: 'Aug 18 cohort', data: [100, 64, 53, null, null, null, null, null, null] },
  ],
  '30d': [
    { label: 'Jun cohort', data: [100, 54, 43, 38, 35, 33, 31, 30, 29] },
    { label: 'Jul cohort', data: [100, 57, 46, 41, 38, 36, 34, 33, 32] },
    { label: 'Aug cohort', data: [100, 62, 51, 46, 43, 41, null, null, null] },
  ],
  '90d': [
    { label: 'Q1 signups', data: [100, 49, 38, 33, 30, 28, 26, 25, 24] },
    { label: 'Q2 signups', data: [100, 53, 42, 37, 34, 32, 30, 29, 28] },
    { label: 'Q3 signups', data: [100, 59, 48, 43, 40, 38, 36, 35, null] },
  ],
};

export const funnelByPeriod = {
  '7d': [
    { step: 'Visited landing page', count: '31,204', pct: 100, color: 'primary' },
    { step: 'Created an account', count: '11,858', pct: 38, color: 'primary' },
    { step: 'Completed onboarding', count: '7,489', pct: 24, color: 'success' },
    { step: 'Created first board', count: '5,304', pct: 17, color: 'warning' },
    { step: 'Upgraded to paid', count: '1,684', pct: 5.4, color: 'error' },
  ],
  '30d': [
    { step: 'Visited landing page', count: '128,660', pct: 100, color: 'primary' },
    { step: 'Created an account', count: '43,744', pct: 34, color: 'primary' },
    { step: 'Completed onboarding', count: '28,305', pct: 22, color: 'success' },
    { step: 'Created first board', count: '19,299', pct: 15, color: 'warning' },
    { step: 'Upgraded to paid', count: '6,176', pct: 4.8, color: 'error' },
  ],
  '90d': [
    { step: 'Visited landing page', count: '371,912', pct: 100, color: 'primary' },
    { step: 'Created an account', count: '111,574', pct: 30, color: 'primary' },
    { step: 'Completed onboarding', count: '70,663', pct: 19, color: 'success' },
    { step: 'Created first board', count: '48,349', pct: 13, color: 'warning' },
    { step: 'Upgraded to paid', count: '14,876', pct: 4.0, color: 'error' },
  ],
};

// ---------- Events ----------

export const eventCategories = ['Activation', 'Engagement', 'Billing', 'Error'];

export const events = [
  { name: 'account_created', category: 'Activation', count: 1693, trend: [92, 104, 111, 98, 121, 133, 127], lastSeen: '2 min ago', status: 'Healthy' },
  { name: 'onboarding_completed', category: 'Activation', count: 1071, trend: [61, 58, 72, 66, 79, 84, 81], lastSeen: '4 min ago', status: 'Healthy' },
  { name: 'board_created', category: 'Engagement', count: 4820, trend: [610, 640, 588, 655, 702, 688, 731], lastSeen: '18 sec ago', status: 'Healthy' },
  { name: 'card_moved', category: 'Engagement', count: 28744, trend: [3810, 3920, 3760, 4050, 4180, 4090, 4230], lastSeen: '3 sec ago', status: 'Healthy' },
  { name: 'comment_posted', category: 'Engagement', count: 9312, trend: [1240, 1190, 1310, 1280, 1350, 1320, 1394], lastSeen: '41 sec ago', status: 'Healthy' },
  { name: 'guest_link_opened', category: 'Engagement', count: 2158, trend: [244, 261, 238, 279, 301, 288, 312], lastSeen: '1 min ago', status: 'Healthy' },
  { name: 'search_performed', category: 'Engagement', count: 6407, trend: [820, 790, 861, 844, 902, 878, 913], lastSeen: '9 sec ago', status: 'Healthy' },
  { name: 'trial_started', category: 'Billing', count: 412, trend: [48, 52, 44, 57, 61, 55, 63], lastSeen: '6 min ago', status: 'Healthy' },
  { name: 'plan_upgraded', category: 'Billing', count: 187, trend: [21, 19, 24, 22, 27, 25, 28], lastSeen: '11 min ago', status: 'Healthy' },
  { name: 'invoice_paid', category: 'Billing', count: 341, trend: [44, 41, 47, 45, 50, 48, 52], lastSeen: '14 min ago', status: 'Healthy' },
  { name: 'payment_failed', category: 'Billing', count: 29, trend: [2, 4, 3, 6, 5, 4, 5], lastSeen: '38 min ago', status: 'Watch' },
  { name: 'sync_conflict', category: 'Error', count: 74, trend: [6, 9, 8, 12, 10, 14, 15], lastSeen: '7 min ago', status: 'Watch' },
  { name: 'upload_failed', category: 'Error', count: 51, trend: [9, 7, 8, 6, 7, 8, 6], lastSeen: '22 min ago', status: 'Watch' },
  { name: 'api_rate_limited', category: 'Error', count: 12, trend: [1, 2, 1, 3, 2, 2, 1], lastSeen: '1 hr ago', status: 'Healthy' },
];
