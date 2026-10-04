import test from "node:test";
import assert from "node:assert/strict";
import {
  createJoinHandler,
  normalizeEmail,
  verifyTurnstile,
  privateKey,
  hashToken,
} from "./handler.mjs";
import { readConfig, ORIGIN, SENDER, OWNER, LIMITS } from "./config.mjs";
import { createUnsubscribeHandler } from "./unsubscribe.mjs";

const now = new Date("2026-10-02T12:00:00Z");
const config = {
  joinEnabled: true,
  turnstileSecret: "test-secret",
  hmacSecret: "x".repeat(40),
  closesAt: now.getTime() + 86400_000,
};
const signupCheckEmail = "operator@example.test";
const signupCheckConfig = {
  ...config,
  joinEnabled: false,
  emailEnabled: false,
  smtpCheckEnabled: false,
  signupCheckEnabled: true,
  signupCheckEmail,
};
const signupCheckEnv = {
  WAITLIST_PRIVACY_READY: "true",
  WAITLIST_HMAC_SECRET: "x".repeat(32),
  TURNSTILE_SECRET_KEY: "test-secret",
  WAITLIST_SIGNUP_CHECK_ENABLED: "true",
  WAITLIST_SIGNUP_CHECK_EMAIL: signupCheckEmail,
  WAITLIST_ENABLED: "false",
  WAITLIST_EMAIL_ENABLED: "false",
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
const registeredSubscriberId = "11111111-1111-4111-8111-111111111111";
function harness(overrides = {}) {
  const calls = [];
  const store = {
    consumeAttempt: async (value) => {
      calls.push(["attempt", value]);
      return true;
    },
    register: async (value) => {
      calls.push(["register", value]);
      return { status: "registered", subscriberId: registeredSubscriberId };
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
    const closed = harness({
      config: readConfig({ ...env, ...extra }, production),
    });
    assert.equal((await closed.handler(req(), context)).status, 503);
    assert.equal(closed.calls.length, 0);
  }
  const scheduled = harness({
    config: readConfig(
      {
        ...env,
        WAITLIST_CLOSES_AT: new Date(now.getTime() + 86400_000).toISOString(),
      },
      production,
    ),
  });
  assert.equal((await scheduled.handler(req(), context)).status, 200);
});

test("signup check requires exact flags with public signup, delivery and SMTP checking disabled", () => {
  const production = { deploy: { context: "production" } };
  for (const smtpFlag of [undefined, "false"]) {
    const result = readConfig(
      { ...signupCheckEnv, WAITLIST_SMTP_CHECK_ENABLED: smtpFlag },
      production,
    );
    assert.equal(result.signupCheckEnabled, true);
    assert.equal(result.joinEnabled, false);
    assert.equal(result.emailEnabled, false);
    assert.equal(result.smtpCheckEnabled, false);
    assert.equal(result.signupCheckEmail, signupCheckEmail);
  }
  for (const [flag, invalidValues] of [
    [
      "WAITLIST_SIGNUP_CHECK_ENABLED",
      [undefined, "false", "TRUE", " true", "1", true],
    ],
    ["WAITLIST_ENABLED", [undefined, "true", "FALSE", " false", "0", false]],
    [
      "WAITLIST_EMAIL_ENABLED",
      [undefined, "true", "FALSE", " false", "0", false],
    ],
    [
      "WAITLIST_SMTP_CHECK_ENABLED",
      ["true", "FALSE", " false", "", "0", false],
    ],
  ]) {
    for (const value of invalidValues) {
      assert.equal(
        readConfig({ ...signupCheckEnv, [flag]: value }, production)
          .signupCheckEnabled,
        false,
        `${flag}=${String(value)}`,
      );
    }
  }
});

test("signup check requires a valid configured mailbox and normalizes it", async () => {
  const production = { deploy: { context: "production" } };
  const normalized = readConfig(
    {
      ...signupCheckEnv,
      WAITLIST_SIGNUP_CHECK_EMAIL: ` ${signupCheckEmail.toUpperCase()} `,
    },
    production,
  );
  assert.equal(normalized.signupCheckEnabled, true);
  assert.equal(normalized.signupCheckEmail, signupCheckEmail);
  const enabled = harness({ config: normalized });
  assert.equal(
    (
      await enabled.handler(
        req({ email: signupCheckEmail, token: "token" }),
        context,
      )
    ).status,
    200,
  );
  for (const email of [
    undefined,
    "",
    "bad",
    "operator@example.test\r\nBcc:other@example.test",
    12,
  ]) {
    const checked = readConfig(
      { ...signupCheckEnv, WAITLIST_SIGNUP_CHECK_EMAIL: email },
      production,
    );
    assert.equal(checked.signupCheckEnabled, false);
    const { handler, calls } = harness({ config: checked });
    assert.equal(
      (await handler(req({ email: signupCheckEmail, token: "token" }), context))
        .status,
      503,
    );
    assert.equal(calls.length, 0);
  }
});

test("signup check cannot bypass production, privacy or HMAC prerequisites", async () => {
  const production = { deploy: { context: "production" } };
  const cases = [
    [signupCheckEnv, undefined],
    ...["deploy-preview", "dev", "branch-deploy"].map((deployment) => [
      { ...signupCheckEnv, CONTEXT: "production" },
      { deploy: { context: deployment } },
    ]),
    ...[
      { WAITLIST_PRIVACY_READY: undefined },
      { WAITLIST_PRIVACY_READY: "false" },
      { WAITLIST_PRIVACY_READY: "TRUE" },
      { WAITLIST_HMAC_SECRET: undefined },
      { WAITLIST_HMAC_SECRET: "x".repeat(31) },
    ].map((extra) => [{ ...signupCheckEnv, ...extra }, production]),
  ];
  for (const [env, deployment] of cases) {
    const checked = readConfig(env, deployment);
    assert.equal(checked, null);
    const { handler, calls } = harness({ config: checked });
    assert.equal(
      (await handler(req({ email: signupCheckEmail, token: "token" }), context))
        .status,
      503,
    );
    assert.equal(calls.length, 0);
  }
});

test("signup check persists only the normalized configured mailbox through ordinary verification and consent", async () => {
  const registered = [];
  const { handler, calls } = harness({
    config: {
      ...signupCheckConfig,
      signupCheckEmail: ` ${signupCheckEmail.toUpperCase()} `,
    },
    onRegistered: (trustedContext, subscriberId) => {
      registered.push({
        trustedContext,
        subscriberId,
        lastCall: calls.at(-1)[0],
      });
    },
  });
  const result = await handler(
    req({
      email: ` ${signupCheckEmail.toUpperCase()} `,
      token: "check-token",
      website: "",
    }),
    context,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.deepEqual(
    calls.map(([kind]) => kind),
    ["attempt", "verify", "register"],
  );
  const ipKey = privateKey(config.hmacSecret, "ip", `2026-10-02:${context.ip}`);
  assert.deepEqual(calls[0][1], { ipKey, now, limits: LIMITS });
  assert.deepEqual(calls[1][1], {
    token: "check-token",
    ip: context.ip,
    secret: "test-secret",
    now,
  });
  const row = calls[2][1];
  assert.deepEqual(row, {
    email: signupCheckEmail,
    emailKey: privateKey(config.hmacSecret, "email", signupCheckEmail),
    ipKey,
    unsubscribeHash: hashToken(row.unsubscribeToken),
    unsubscribeToken: row.unsubscribeToken,
    offerVersion: "datagrid-early-20-v1",
    now,
    limits: LIMITS,
  });
  assert.match(row.unsubscribeToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(!JSON.stringify(row).includes(context.ip));
  assert.ok(!JSON.stringify(row).includes("check-token"));
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert.equal(signupCheckConfig.emailEnabled, false);
  assert.deepEqual(registered, [
    {
      trustedContext: context,
      subscriberId: registeredSubscriberId,
      lastCall: "register",
    },
  ]);
});

test("signup check refuses other mailboxes before the honeypot, quotas, verification or persistence", async () => {
  for (const email of [
    OWNER,
    SENDER,
    "visitor@example.test",
    "operator+check@example.test",
    "bad",
  ]) {
    for (const website of ["", "bot"]) {
      const { handler, calls } = harness({ config: signupCheckConfig });
      for (const token of ["token", ""]) {
        const result = await handler(req({ email, token, website }), context);
        assert.equal(result.status, 503);
        assert.deepEqual(await result.json(), { ok: false });
      }
      assert.equal(calls.length, 0);
    }
  }
  const { handler, calls } = harness({ config: signupCheckConfig });
  assert.equal(
    (
      await handler(
        req({ email: signupCheckEmail, token: "token", website: "bot" }),
        context,
      )
    ).status,
    200,
  );
  assert.equal(calls.length, 0);
});

test("signup check fails closed for inconsistent runtime flags, missing verification secret and closure", async () => {
  for (const extra of [
    { signupCheckEnabled: undefined },
    { signupCheckEnabled: false },
    { signupCheckEnabled: "true" },
    { signupCheckEmail: undefined },
    { signupCheckEmail: "" },
    { signupCheckEmail: "bad" },
    { joinEnabled: undefined },
    { emailEnabled: undefined },
    { emailEnabled: true },
    { emailEnabled: "false" },
    { smtpCheckEnabled: undefined },
    { smtpCheckEnabled: true },
    { smtpCheckEnabled: "false" },
    { turnstileSecret: undefined },
    { closesAt: Number.NaN },
    { closesAt: now.getTime() },
  ]) {
    const { handler, calls } = harness({
      config: { ...signupCheckConfig, ...extra },
    });
    assert.equal(
      (await handler(req({ email: signupCheckEmail, token: "token" }), context))
        .status,
      503,
      JSON.stringify(extra),
    );
    assert.equal(calls.length, 0);
  }
});

test("signup check retains token, origin and trusted IP validation", async () => {
  const body = { email: signupCheckEmail, token: "token" };
  const cases = [
    ...[undefined, "", 12, "x".repeat(2049)].map((token) => [
      req({ ...body, token }),
      context,
      400,
    ]),
    [req({ ...body, email: "bad" }), context, 503],
    [
      req(body, {
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
      }),
      context,
      403,
    ],
    [
      new Request("https://awc-ui.netlify.app/api/waitlist", req(body)),
      context,
      403,
    ],
    [
      new Request(`${ORIGIN}/.netlify/functions/waitlist`, req(body)),
      context,
      403,
    ],
    ...[undefined, {}, { ip: "invalid" }].map((untrusted) => [
      req(body, {
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "x-forwarded-for": context.ip,
          "x-nf-client-connection-ip": context.ip,
        },
      }),
      untrusted,
      503,
    ]),
  ];
  for (const [request, trustedContext, status] of cases) {
    const { handler, calls } = harness({ config: signupCheckConfig });
    assert.equal((await handler(request, trustedContext)).status, status);
    assert.equal(calls.length, 0);
  }
});

test("signup check keeps quota, verification and storage failures closed without delivery", async () => {
  for (const [failure, status, expectedCalls] of [
    ["attempt-limit", 429, ["attempt"]],
    ["attempt-error", 503, ["attempt"]],
    ["verification-rejected", 403, ["attempt", "verify"]],
    ["verification-error", 503, ["attempt", "verify"]],
    ["registration-limit", 429, ["attempt", "verify", "register"]],
    ["registration-error", 503, ["attempt", "verify", "register"]],
    ["existing", 200, ["attempt", "verify", "register"]],
  ]) {
    const calls = [];
    let kicked = 0;
    const { handler } = harness({
      config: signupCheckConfig,
      store: {
        consumeAttempt: async () => {
          calls.push("attempt");
          if (failure === "attempt-error") throw new Error("database");
          return failure !== "attempt-limit";
        },
        register: async () => {
          calls.push("register");
          if (failure === "registration-error") throw new Error("database");
          return {
            status: failure === "registration-limit" ? "limited" : "existing",
          };
        },
      },
      verify: async () => {
        calls.push("verify");
        if (failure === "verification-error") throw new Error("timeout");
        return failure !== "verification-rejected";
      },
      onRegistered: () => kicked++,
    });
    const result = await handler(
      req({ email: signupCheckEmail, token: "token" }),
      context,
    );
    assert.equal(result.status, status, failure);
    assert.deepEqual(await result.json(), { ok: status === 200 }, failure);
    assert.deepEqual(calls, expectedCalls, failure);
    assert.equal(kicked, 0, failure);
  }
});

test("ordinary signup remains unrestricted when the signup-check flag is also present", async () => {
  let kicked = 0;
  const { handler, calls } = harness({
    config: { ...signupCheckConfig, joinEnabled: true },
    onRegistered: () => kicked++,
  });
  assert.equal((await handler(req(), context)).status, 200);
  assert.equal(
    calls.find(([kind]) => kind === "register")[1].email,
    "hello@example.com",
  );
  assert.equal(kicked, 1);
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
