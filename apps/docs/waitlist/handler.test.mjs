import test from "node:test";
import assert from "node:assert/strict";
import {
  createJoinHandler,
  normalizeEmail,
  verifyTurnstile,
  privateKey,
  hashToken,
} from "./handler.mjs";
import { readConfig, ORIGIN } from "./config.mjs";
import { createUnsubscribeHandler } from "./unsubscribe.mjs";

const now = new Date("2026-10-02T12:00:00Z");
const config = {
  joinEnabled: true,
  turnstileSecret: "test-secret",
  hmacSecret: "x".repeat(40),
  closesAt: now.getTime() + 86400_000,
};
const req = (
  body = { email: "hello@example.com", token: "valid-token", website: "" },
  options = {},
) =>
  new Request(`${ORIGIN}/api/waitlist`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
    ...options,
  });
const context = { ip: "203.0.113.20" };
function harness(overrides = {}) {
  const calls = [];
  const store = {
    consumeAttempt: async (value) => {
      calls.push(["attempt", value]);
      return true;
    },
    register: async (value) => {
      calls.push(["register", value]);
      return { status: "registered" };
    },
  };
  const handler = createJoinHandler({
    config,
    store,
    verify: async (value) => {
      calls.push(["verify", value]);
      return true;
    },
    clock: () => now,
    ...overrides,
  });
  return { calls, store, handler };
}

test("accepted signup persists before acknowledgement and keeps IP/token out of stored raw identity", async () => {
  const { handler, calls } = harness();
  const result = await handler(
    req({ email: " Hello+early@EXAMPLE.com ", token: "token" }),
    context,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.deepEqual(
    calls.map(([kind]) => kind),
    ["attempt", "verify", "register"],
  );
  const row = calls[2][1];
  assert.equal(row.email, "hello+early@example.com");
  assert.equal(row.offerVersion, "datagrid-early-20-v1");
  assert.equal(row.unsubscribeHash, hashToken(row.unsubscribeToken));
  assert.match(row.ipKey, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes(context.ip));
  assert.ok(!JSON.stringify(row).includes("test-secret"));
  assert.match(result.headers.get("cache-control"), /no-store/);
});

test("validation rejects malformed, injected, oversized and unexpected data before verification or storage", async () => {
  for (const body of [
    null,
    [],
    {},
    { email: "bad", token: "ok" },
    { email: "hi@example.com\r\nBcc:you@example.com", token: "ok" },
    { email: "hi@example.com", token: "x".repeat(2049) },
    { email: "hi@example.com", token: "ok", to: "other@example.com" },
    { email: "hi@example.com", token: "ok", website: {} },
    { email: "hi@example.com", token: "ok", website: "x".repeat(5000) },
  ]) {
    const { handler, calls } = harness();
    assert.equal((await handler(req(body), context)).status, 400);
    assert.equal(calls.length, 0);
  }
  assert.equal(normalizeEmail("a..b@example.com"), null);
  assert.equal(normalizeEmail("a".repeat(65) + "@example.com"), null);
  assert.equal(normalizeEmail("a.b+tag@example.com"), "a.b+tag@example.com");
});

test("method, content type, origin, direct function URL and aliases cannot bypass checks", async () => {
  const cases = [
    [new Request(`${ORIGIN}/api/waitlist`), 405],
    [
      req(undefined, {
        headers: { origin: ORIGIN, "content-type": "text/plain" },
      }),
      415,
    ],
    [
      req(undefined, {
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
      }),
      403,
    ],
    [new Request("https://awc-ui.netlify.app/api/waitlist", req()), 403],
    [new Request(`${ORIGIN}/.netlify/functions/waitlist`, req()), 403],
  ];
  for (const [request, status] of cases) {
    const { handler, calls } = harness();
    assert.equal((await handler(request, context)).status, status);
    assert.equal(calls.length, 0);
  }
});

test("honeypot is a silent no-op; missing trusted context cannot use spoofed headers", async () => {
  const { handler, calls } = harness();
  assert.equal(
    (
      await handler(
        req({ email: "hi@example.com", token: "ok", website: "bot" }),
        context,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handler(
        req(undefined, {
          headers: {
            origin: ORIGIN,
            "content-type": "application/json",
            "x-forwarded-for": context.ip,
          },
        }),
        {},
      )
    ).status,
    503,
  );
  assert.equal(calls.length, 0);
});

test("limits, verification failures and storage failures never acknowledge new signup", async () => {
  for (const [overrides, status] of [
    [{ store: { consumeAttempt: async () => false } }, 429],
    [{ verify: async () => false }, 403],
    [
      {
        verify: async () => {
          throw new Error("timeout");
        },
      },
      503,
    ],
    [
      {
        store: {
          consumeAttempt: async () => true,
          register: async () => {
            throw new Error("database");
          },
        },
      },
      503,
    ],
    [
      {
        store: {
          consumeAttempt: async () => true,
          register: async () => ({ status: "limited" }),
        },
      },
      429,
    ],
    [{ config: { ...config, closesAt: now.getTime() } }, 503],
    [{ config: { ...config, joinEnabled: false } }, 503],
  ]) {
    const { handler } = harness(overrides);
    assert.equal((await handler(req(), context)).status, status);
  }
});

test("existing addresses receive same success without immediate email kick; new registration kicks only after persistence", async () => {
  let kicked = 0;
  const existing = harness({
    store: {
      consumeAttempt: async () => true,
      register: async () => ({ status: "existing" }),
    },
    onRegistered: () => kicked++,
  });
  assert.deepEqual(await (await existing.handler(req(), context)).json(), {
    ok: true,
  });
  assert.equal(kicked, 0);
  const registered = harness({ onRegistered: () => kicked++ });
  await registered.handler(req(), context);
  assert.equal(kicked, 1);
});

test("enrollment stays open until launch with no scheduled date, while invalid dates and the launch switch fail closed", async () => {
  const env = {
    WAITLIST_PRIVACY_READY: "true",
    WAITLIST_HMAC_SECRET: "x".repeat(32),
    WAITLIST_ENABLED: "true",
    TURNSTILE_SECRET_KEY: "test-secret",
  };
  const production = { deploy: { context: "production" } };
  const openConfig = readConfig(env, production);
  assert.equal(openConfig.closesAt, null);
  const open = harness({ config: openConfig });
  assert.equal((await open.handler(req(), context)).status, 200);
  assert.ok(open.calls.some(([kind]) => kind === "register"));
  for (const extra of [
    { WAITLIST_ENABLED: "false" },
    { WAITLIST_CLOSES_AT: "" },
    { WAITLIST_CLOSES_AT: "not-a-date" },
    { WAITLIST_CLOSES_AT: now.toISOString() },
  ]) {
    const closed = harness({ config: readConfig({ ...env, ...extra }, production) });
    assert.equal((await closed.handler(req(), context)).status, 503);
    assert.equal(closed.calls.length, 0);
  }
  const scheduled = harness({
    config: readConfig({
      ...env,
      WAITLIST_CLOSES_AT: new Date(now.getTime() + 86400_000).toISOString(),
    }, production),
  });
  assert.equal((await scheduled.handler(req(), context)).status, 200);
});

test("Siteverify validates success, host, action, timestamp, replay/expiry; network and HTTP failure fail closed", async () => {
  const good = {
    success: true,
    hostname: "awc-ui.dev",
    action: "waitlist_join",
    challenge_ts: now.toISOString(),
  };
  const check = (data) =>
    verifyTurnstile({
      token: "t",
      ip: context.ip,
      secret: "s",
      now,
      fetcher: async (url, request) => {
        assert.equal(
          url,
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        );
        assert.equal(request.body.get("remoteip"), context.ip);
        assert.ok(request.signal);
        return Response.json(data);
      },
    });
  assert.equal(await check(good), true);
  for (const bad of [
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { hostname: "preview.netlify.app" },
    { action: "login" },
    { challenge_ts: "bad" },
    { challenge_ts: new Date(now.getTime() - 301000).toISOString() },
    { challenge_ts: new Date(now.getTime() + 60000).toISOString() },
  ])
    assert.equal(await check({ ...good, ...bad }), false);
  await assert.rejects(
    verifyTurnstile({
      token: "t",
      ip: context.ip,
      secret: "s",
      now,
      fetcher: async () => new Response("", { status: 503 }),
    }),
  );
});

test("runtime context cannot be promoted from preview by a build environment variable", () => {
  const env = {
    CONTEXT: "production",
    WAITLIST_PRIVACY_READY: "true",
    WAITLIST_HMAC_SECRET: "x".repeat(32),
  };
  const production = { deploy: { context: "production" } };
  assert.ok(readConfig(env, production));
  assert.ok(readConfig({ ...env, CONTEXT: undefined }, production));
  assert.equal(readConfig(env), null);
  for (const deployment of ["deploy-preview", "dev", "branch-deploy"]) {
    assert.equal(readConfig(env, { deploy: { context: deployment } }), null);
  }
  for (const extra of [
    { WAITLIST_PRIVACY_READY: "false" },
    { WAITLIST_HMAC_SECRET: "short" },
  ]) {
    assert.equal(readConfig({ ...env, ...extra }, production), null);
  }
  assert.notEqual(
    privateKey("key", "ip", "2026-10-02:1.2.3.4"),
    privateKey("key", "ip", "2026-10-03:1.2.3.4"),
  );
});

test("unsubscribe GET does not change consent; POST suppresses, tokens are validated, failures are retryable", async () => {
  const token = "x".repeat(43);
  const calls = [];
  const handler = createUnsubscribeHandler({
    store: { unsubscribe: async (input) => calls.push(input) },
    clock: () => now,
  });
  const url = `${ORIGIN}/api/waitlist/unsubscribe?token=${token}`;
  const get = await handler(new Request(url));
  assert.equal(get.status, 200);
  assert.equal(calls.length, 0);
  assert.match(
    get.headers.get("content-security-policy"),
    /default-src 'none'/,
  );
  const post = await handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    }),
  );
  assert.equal(post.status, 200);
  assert.equal(calls[0].unsubscribeHash, hashToken(token));
  assert.equal(
    (
      await handler(
        new Request(`${ORIGIN}/api/waitlist/unsubscribe?token=%22script`),
      )
    ).status,
    400,
  );
});
