// Fictional Relaymesh fleet data. Everything is generated deterministically
// (seeded PRNG, fixed timestamps) so the server render and the client
// hydration always agree.

export type ServiceStatus = 'operational' | 'degraded' | 'down';

export interface Service {
  id: string;
  name: string;
  tier: 'edge' | 'core' | 'async';
  region: string;
  status: ServiceStatus;
  version: string;
  uptime: number[]; // last 24 h, sampled hourly, percent
  p95: number; // ms
  rps: number;
  alerts: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uptimeSeries(seed: number, status: ServiceStatus): number[] {
  const rnd = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < 24; i++) {
    let v = 99.72 + rnd() * 0.28;
    if (status === 'degraded' && i >= 16 && i <= 20) v = 98.4 + rnd() * 0.7;
    if (status === 'down' && i >= 20) v = 95.1 + rnd() * 1.2;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

const serviceSeed: Array<
  Omit<Service, 'uptime'> & { seed: number }
> = [
  { id: 'auth-gateway', name: 'auth-gateway', tier: 'edge', region: 'us-east-1', status: 'operational', version: 'v3.8.2', p95: 84, rps: 1240, alerts: 0, seed: 11 },
  { id: 'billing-core', name: 'billing-core', tier: 'core', region: 'us-east-1', status: 'operational', version: 'v2.14.0', p95: 132, rps: 310, alerts: 0, seed: 22 },
  { id: 'webhook-relay', name: 'webhook-relay', tier: 'async', region: 'eu-west-2', status: 'degraded', version: 'v1.9.4', p95: 468, rps: 505, alerts: 3, seed: 33 },
  { id: 'ingest-pipeline', name: 'ingest-pipeline', tier: 'async', region: 'us-east-1', status: 'operational', version: 'v4.1.1', p95: 205, rps: 2180, alerts: 0, seed: 44 },
  { id: 'graph-api', name: 'graph-api', tier: 'core', region: 'us-west-2', status: 'operational', version: 'v5.0.3', p95: 96, rps: 890, alerts: 1, seed: 55 },
  { id: 'session-store', name: 'session-store', tier: 'core', region: 'eu-west-2', status: 'operational', version: 'v2.2.7', p95: 41, rps: 3320, alerts: 0, seed: 66 },
  { id: 'object-vault', name: 'object-vault', tier: 'core', region: 'ap-south-1', status: 'down', version: 'v1.4.9', p95: 1890, rps: 12, alerts: 5, seed: 77 },
  { id: 'notify-dispatch', name: 'notify-dispatch', tier: 'async', region: 'us-west-2', status: 'operational', version: 'v3.3.0', p95: 174, rps: 460, alerts: 0, seed: 88 },
  { id: 'edge-cache', name: 'edge-cache', tier: 'edge', region: 'global', status: 'operational', version: 'v6.2.1', p95: 18, rps: 7440, alerts: 0, seed: 99 },
];

export const services: Service[] = serviceSeed.map(({ seed, ...s }) => ({
  ...s,
  uptime: uptimeSeries(seed, s.status),
}));

// ---------------------------------------------------------------- Latency

export type TimeWindow = '1h' | '6h' | '24h' | '7d';

export interface LatencyWindow {
  labels: string[];
  p50: number[];
  p95: number[];
  p99: number[];
  regions: { label: string; data: number[] }[];
  deployAt?: string;
}

function series(seed: number, n: number, base: number, spread: number, spikeAt = -1, spike = 0): number[] {
  const rnd = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = base + Math.sin(i / 2.4) * spread * 0.35 + rnd() * spread;
    if (spikeAt >= 0 && Math.abs(i - spikeAt) <= 1) v += spike * (i === spikeAt ? 1 : 0.55);
    out.push(Math.round(v));
  }
  return out;
}

function windowData(seed: number, labels: string[], spikeAt: number, deployAt?: string): LatencyWindow {
  const n = labels.length;
  return {
    labels,
    p50: series(seed + 1, n, 46, 14, spikeAt, 40),
    p95: series(seed + 2, n, 160, 46, spikeAt, 210),
    p99: series(seed + 3, n, 340, 90, spikeAt, 520),
    regions: [
      { label: 'us-east-1', data: series(seed + 4, n, 640, 160, spikeAt, -180) },
      { label: 'eu-west-2', data: series(seed + 5, n, 410, 120) },
      { label: 'ap-south-1', data: series(seed + 6, n, 230, 90) },
    ],
    deployAt,
  };
}

function ticks(count: number, stepMin: number, endH: number, endM: number): string[] {
  const out: string[] = [];
  let total = endH * 60 + endM - (count - 1) * stepMin;
  for (let i = 0; i < count; i++) {
    const h = Math.floor(((total % 1440) + 1440) % 1440 / 60);
    const m = ((total % 60) + 60) % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    total += stepMin;
  }
  return out;
}

export const latencyWindows: Record<TimeWindow, LatencyWindow> = {
  '1h': windowData(101, ticks(12, 5, 14, 35), 8, '14:15'),
  '6h': windowData(202, ticks(12, 30, 14, 30), 6, '13:00'),
  '24h': windowData(303, ticks(12, 120, 14, 0), 9, '12:00'),
  '7d': windowData(404, ['Aug 14', 'Aug 15', 'Aug 16', 'Aug 17', 'Aug 18', 'Aug 19', 'Aug 20'], 4, 'Aug 18'),
};

// ------------------------------------------------------------- Request log

export interface LogEntry {
  id: string;
  time: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  status: number;
  latency: number; // ms
  service: string;
  payload: object;
}

export const requestLog: LogEntry[] = [
  { id: 'req_9f2c41', time: '14:32:08.412', method: 'POST', endpoint: '/v2/payments/capture', status: 201, latency: 148, service: 'billing-core', payload: { invoice: 'inv_88231', amount_cents: 12900, currency: 'USD', idempotency_key: 'idm_5f7a' } },
  { id: 'req_8be07d', time: '14:32:06.921', method: 'GET', endpoint: '/v2/accounts/acct_5521/limits', status: 200, latency: 36, service: 'auth-gateway', payload: { plan: 'scale', rate_limit: 600, burst: 1200, window_s: 60 } },
  { id: 'req_7d31aa', time: '14:32:05.284', method: 'POST', endpoint: '/v1/webhooks/deliver', status: 503, latency: 3012, service: 'webhook-relay', payload: { destination: 'https://hooks.lumafleet.example/orders', attempt: 4, backoff_s: 120, last_error: 'upstream timeout' } },
  { id: 'req_6c88f2', time: '14:32:03.870', method: 'PUT', endpoint: '/v2/objects/obj_20441/meta', status: 507, latency: 1890, service: 'object-vault', payload: { bucket: 'media-prod-aps1', size_bytes: 48211004, error: 'insufficient storage on shard aps1-07' } },
  { id: 'req_5aa913', time: '14:32:02.109', method: 'GET', endpoint: '/v3/graph/customers/cus_1188/orders', status: 200, latency: 92, service: 'graph-api', payload: { depth: 2, nodes: 41, edges: 66, cache: 'MISS' } },
  { id: 'req_49e6b0', time: '14:32:00.663', method: 'POST', endpoint: '/v2/sessions/refresh', status: 200, latency: 22, service: 'session-store', payload: { session: 'ses_c7714', ttl_s: 3600, rotated: true } },
  { id: 'req_3fd2c8', time: '14:31:58.977', method: 'POST', endpoint: '/v1/ingest/events', status: 202, latency: 187, service: 'ingest-pipeline', payload: { batch: 'bat_66109', events: 500, dedupe: 12, partition: 'evt-2026-08-20' } },
  { id: 'req_2e97d4', time: '14:31:57.301', method: 'DELETE', endpoint: '/v2/webhooks/wh_3327', status: 204, latency: 41, service: 'webhook-relay', payload: { webhook: 'wh_3327', deliveries_pending: 0 } },
  { id: 'req_1c40be', time: '14:31:55.518', method: 'GET', endpoint: '/v2/payments/pay_71a2', status: 404, latency: 28, service: 'billing-core', payload: { error: 'resource_missing', hint: 'payment pay_71a2 not found in live mode' } },
  { id: 'req_0b7731', time: '14:31:54.024', method: 'POST', endpoint: '/v2/tokens/exchange', status: 401, latency: 19, service: 'auth-gateway', payload: { error: 'invalid_grant', client: 'cli_meridian_ops', scope: 'fleet:read' } },
  { id: 'req_fe61a9', time: '14:31:52.740', method: 'GET', endpoint: '/v1/cache/edge/health', status: 200, latency: 6, service: 'edge-cache', payload: { pops: 42, hit_ratio: 0.973, stale_served: 118 } },
  { id: 'req_ed09c5', time: '14:31:51.116', method: 'POST', endpoint: '/v3/notify/email', status: 429, latency: 11, service: 'notify-dispatch', payload: { template: 'invoice-receipt', error: 'rate_limited', retry_after_s: 30 } },
  { id: 'req_dc554f', time: '14:31:49.483', method: 'PUT', endpoint: '/v3/graph/schema/orders', status: 200, latency: 264, service: 'graph-api', payload: { version: 19, fields_added: ['fulfillment_eta'], breaking: false } },
  { id: 'req_cb302e', time: '14:31:47.902', method: 'POST', endpoint: '/v1/ingest/metrics', status: 202, latency: 133, service: 'ingest-pipeline', payload: { batch: 'bat_66102', points: 12800, resolution_s: 10 } },
];

// -------------------------------------------------------------- Incidents

export type Severity = 'critical' | 'major' | 'minor' | 'resolved';

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  opened: string;
  description: string;
  tags: string[];
  service: string;
  acked: boolean;
}

export const incidents: Incident[] = [
  {
    id: 'INC-2417',
    title: 'object-vault shard aps1-07 out of storage',
    severity: 'critical',
    opened: 'Aug 20, 13:58 UTC',
    description: 'Writes to the ap-south-1 vault are failing with 507s. Replication to the standby shard has been paused while capacity is added.',
    tags: ['ap-south-1', 'storage', 'writes-failing'],
    service: 'object-vault',
    acked: false,
  },
  {
    id: 'INC-2416',
    title: 'webhook-relay delivery backlog above 40k',
    severity: 'major',
    opened: 'Aug 20, 13:21 UTC',
    description: 'A slow consumer at a large tenant is exhausting the delivery pool. Retries are being throttled to protect unrelated destinations.',
    tags: ['eu-west-2', 'backlog', 'throttling'],
    service: 'webhook-relay',
    acked: false,
  },
  {
    id: 'INC-2415',
    title: 'graph-api p99 regression after schema v19',
    severity: 'minor',
    opened: 'Aug 20, 12:44 UTC',
    description: 'The new fulfillment_eta resolver adds an extra fan-out on order queries deeper than two levels. A batched resolver is being rolled out.',
    tags: ['us-west-2', 'latency', 'deploy'],
    service: 'graph-api',
    acked: true,
  },
  {
    id: 'INC-2414',
    title: 'Elevated 401s on token exchange',
    severity: 'minor',
    opened: 'Aug 20, 11:07 UTC',
    description: 'A partner integration is retrying with an expired refresh token. Confirmed client-side; the partner has been notified.',
    tags: ['auth', 'partner', 'client-error'],
    service: 'auth-gateway',
    acked: true,
  },
  {
    id: 'INC-2413',
    title: 'edge-cache PoP fra2 cold after node rotation',
    severity: 'resolved',
    opened: 'Aug 20, 09:30 UTC',
    description: 'Hit ratio in Frankfurt dipped to 81% during scheduled node rotation. Cache warmed back to steady state within 25 minutes.',
    tags: ['edge', 'maintenance'],
    service: 'edge-cache',
    acked: true,
  },
  {
    id: 'INC-2412',
    title: 'ingest-pipeline consumer lag on evt partition',
    severity: 'resolved',
    opened: 'Aug 19, 22:12 UTC',
    description: 'Nightly compaction competed with the ingest consumers for IO. Compaction window moved to 03:00 UTC.',
    tags: ['us-east-1', 'kafka', 'lag'],
    service: 'ingest-pipeline',
    acked: true,
  },
];
