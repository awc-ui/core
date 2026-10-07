import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AD_CONSENT_VERSION,
  consentKey,
  readAdvertisingConfig,
  readAdvertisingMeasurement,
  deliverAdvertisingOne,
} from "./advertising.mjs";
import { createAdvertisingWithdrawalHandler } from "./advertising-withdraw.mjs";
import { createWaitlistStore } from "./store.mjs";
import { createJoinHandler } from "./handler.mjs";
import { ORIGIN, readConfig } from "./config.mjs";

const NOW = new Date("2026-10-06T12:00:00Z");
const TOKEN = "a".repeat(43);
const UA = "Mozilla/5.0 (Test browser)";
const accepted = {
  consent: true,
  version: AD_CONSENT_VERSION,
  token: TOKEN,
  fbp: `fb.1.${NOW.getTime()}.123456789`,
  fbc: `fb.1.${NOW.getTime()}.example-click-id`,
};
const settings = {
  datasetId: "1234567890",
  apiVersion: "v24.0",
  accessToken: "test-only-access-token",
};
const config = {
  joinEnabled: true,
  turnstileSecret: "test",
  hmacSecret: "x".repeat(32),
  closesAt: null,
  advertising: settings,
};
const request = (email, advertising = accepted, website = "") =>
  new Request(`${ORIGIN}/api/waitlist`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "user-agent": UA,
    },
    body: JSON.stringify({
      email,
      token: "test-challenge",
      website,
      ...(advertising === undefined ? {} : { advertising }),
    }),
  });
const registration = (name, advertising = null) => ({
  email: `${name}@example.test`,
  emailKey: name,
  ipKey: name,
  unsubscribeHash: `hash-${name}`,
  unsubscribeToken: `token-${name}`,
  now: NOW,
  advertising,
});

test("measurement config is off by default and never enabled in previews", () => {
  const env = {
    META_CAPI_ENABLED: "true",
    META_DATASET_ID: settings.datasetId,
    META_GRAPH_API_VERSION: settings.apiVersion,
    META_CAPI_ACCESS_TOKEN: settings.accessToken,
  };
  assert.equal(readAdvertisingConfig({}), null);
  assert.deepEqual(readAdvertisingConfig(env), {
    ...settings,
    testEventCode: undefined,
  });
  for (const invalid of [
    { META_CAPI_ENABLED: "false" },
    { META_DATASET_ID: "123/../../other" },
    { META_DATASET_ID: `${settings.datasetId}\n` },
    { META_GRAPH_API_VERSION: "https://evil.test" },
    { META_CAPI_ACCESS_TOKEN: "" },
    { META_TEST_EVENT_CODE: "\nunsafe" },
  ])
    assert.equal(readAdvertisingConfig({ ...env, ...invalid }), null);
  assert.equal(
    readConfig(
      {
        ...env,
        WAITLIST_PRIVACY_READY: "true",
        WAITLIST_HMAC_SECRET: "x".repeat(32),
      },
      { deploy: { context: "deploy-preview" } },
    ),
    null,
  );
});

test("measurement requires explicit current consent, a capability and bounded attribution; it never promotes extra identity fields", () => {
  const measurement = readAdvertisingMeasurement(accepted, UA, NOW);
  assert.deepEqual(measurement, {
    consentKey: consentKey(TOKEN),
    version: AD_CONSENT_VERSION,
    userData: { client_user_agent: UA, fbp: accepted.fbp, fbc: accepted.fbc },
  });
  for (const value of [
    null,
    {},
    [],
    { ...accepted, consent: "true" },
    { ...accepted, consent: false },
    { ...accepted, version: "old" },
    { ...accepted, token: "short" },
    { ...accepted, token: `${TOKEN}\n` },
    { ...accepted, em: "hello@example.test" },
    { ...accepted, client_ip_address: "192.0.2.1" },
    { ...accepted, fbp: "malformed", fbc: undefined },
    { ...accepted, fbp: `${accepted.fbp}\n`, fbc: undefined },
    { ...accepted, fbp: `fb.1.${NOW.getTime() + 600_000}.123`, fbc: undefined },
    { ...accepted, fbp: undefined, fbc: `fb.1.${NOW.getTime()}.bad@identity` },
  ])
    assert.equal(readAdvertisingMeasurement(value, UA, NOW), null);
  for (const agent of [null, "", "x".repeat(513), "header\rinjection"])
    assert.equal(readAdvertisingMeasurement(accepted, agent, NOW), null);
  assert.deepEqual(
    readAdvertisingMeasurement({ ...accepted, fbp: undefined }, UA, NOW)
      .userData,
    { client_user_agent: UA, fbc: accepted.fbc },
  );
});

test("disabled sender and withdrawn jobs never contact the provider", async () => {
  let claimed = 0;
  const fetcher = () => {
    throw new Error("Must not contact Meta");
  };
  assert.deepEqual(
    await deliverAdvertisingOne({
      config: {},
      store: {
        claimAdvertising() {
          claimed++;
        },
      },
      fetcher,
    }),
    { status: "disabled" },
  );
  assert.equal(claimed, 0);
  assert.deepEqual(
    await deliverAdvertisingOne({
      config,
      store: {
        claimAdvertising: async () => ({ id: "job", claimToken: "claim" }),
        advertisingCanSend: async () => false,
      },
      fetcher,
    }),
    { status: "cancelled" },
  );
});

test("withdrawal validates origin, token, method and rate limit without exposing whether a consent exists", async () => {
  const calls = [];
  const handler = createAdvertisingWithdrawalHandler({
    config,
    clock: () => NOW,
    store: {
      consumeAttempt: async (value) => {
        calls.push(value);
        return true;
      },
      withdrawAdvertising: async (value) => calls.push(value),
    },
  });
  const req = (token = TOKEN) =>
    new Request(`${ORIGIN}/api/advertising/withdraw`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  const context = { ip: "192.0.2.10" };
  assert.equal(
    (await handler(new Request(`${ORIGIN}/api/advertising/withdraw`), context))
      .status,
    405,
  );
  assert.equal(
    (
      await handler(
        new Request("https://evil.test/api/advertising/withdraw", req()),
        context,
      )
    ).status,
    403,
  );
  assert.equal((await handler(req("short"), context)).status, 400);
  assert.equal((await handler(req(), {})).status, 503);
  assert.equal(calls.length, 0);
  for (const token of [TOKEN, "b".repeat(43)])
    assert.deepEqual(await (await handler(req(token), context)).json(), {
      ok: true,
    });
  assert.equal(calls[1].consentKey, consentKey(TOKEN));
  assert.ok(!JSON.stringify(calls).includes(context.ip));
  assert.ok(!JSON.stringify(calls).includes(TOKEN));
});

test(
  "PostgreSQL measurement integrates with real waitlist transactions, leases and withdrawal",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL for isolated PostgreSQL integration tests",
    timeout: 60_000,
  },
  async (t) => {
    const { Pool } = await import("pg");
    const schema = `advertising_test_${randomBytes(8).toString("hex")}`;
    const admin = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 1,
    });
    let pool;
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        options: `-c search_path=${schema}`,
        max: 12,
      });
      for (const filename of [
        "202610020001_create_waitlist.sql",
        "202610060001_advertising_measurement.sql",
        "202610070001_advertising_providers.sql",
      ])
        await pool.query(
          await readFile(
            new URL(
              `../netlify/database/migrations/${filename}`,
              import.meta.url,
            ),
            "utf8",
          ),
        );
      const store = createWaitlistStore(pool);
      const reset = () =>
        pool.query(
          "TRUNCATE waitlist_advertising_outbox, advertising_consents, waitlist_outbox, waitlist_send_attempts, waitlist_subscribers, waitlist_budgets",
        );
      const rows = async () =>
        (
          await pool.query(
            "SELECT * FROM waitlist_advertising_outbox ORDER BY created_at, id",
          )
        ).rows;
      const measurement = readAdvertisingMeasurement(accepted, UA, NOW);
      const join = createJoinHandler({
        store,
        config,
        clock: () => NOW,
        verify: async () => true,
      });

      await t.test(
        "20 concurrent duplicate signups create exactly one Lead and all receive the same response",
        async () => {
          await reset();
          const responses = await Promise.all(
            Array.from({ length: 20 }, () =>
              join(request("same@example.test"), { ip: "192.0.2.10" }),
            ),
          );
          for (const response of responses) {
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { ok: true });
          }
          assert.equal((await rows()).length, 1);
          assert.equal(
            (await pool.query("SELECT count(*) FROM waitlist_outbox")).rows[0]
              .count,
            "2",
          );
          assert.equal(
            (await pool.query("SELECT count(*) FROM waitlist_subscribers"))
              .rows[0].count,
            "1",
          );
        },
      );

      await t.test(
        "no consent, malformed consent, honeypots, duplicate/suppressed and config-off requests create no Lead",
        async () => {
          await reset();
          for (const [index, ad] of [
            null,
            { ...accepted, consent: false },
            { ...accepted, version: "old" },
            { ...accepted, em: "email" },
          ].entries())
            assert.equal(
              (
                await join(request(`optout${index}@example.test`, ad), {
                  ip: `192.0.2.${20 + index}`,
                })
              ).status,
              200,
            );
          assert.equal(
            (
              await join(request("bot@example.test", accepted, "filled"), {
                ip: "192.0.2.30",
              })
            ).status,
            200,
          );
          await store.register(registration("suppressed"));
          await store.unsubscribe({
            unsubscribeHash: "hash-suppressed",
            now: NOW,
          });
          assert.equal(
            (
              await join(request("suppressed@example.test"), {
                ip: "192.0.2.31",
              })
            ).status,
            200,
          );
          const disabled = createJoinHandler({
            store,
            config: { ...config, advertising: null },
            clock: () => NOW,
            verify: async () => true,
          });
          assert.equal(
            (
              await disabled(request("disabled@example.test"), {
                ip: "192.0.2.32",
              })
            ).status,
            200,
          );
          assert.equal((await rows()).length, 0);
        },
      );

      await t.test(
        "revocation cancels unsent jobs and a tombstone also wins withdrawal before signup",
        async () => {
          await reset();
          await store.register(registration("first", measurement));
          const job = await store.claimAdvertising({ now: NOW });
          await store.withdrawAdvertising({
            consentKey: measurement.consentKey,
            now: NOW,
          });
          assert.equal(
            await store.advertisingCanSend({
              id: job.id,
              claimToken: job.claimToken,
              now: NOW,
            }),
            false,
          );
          assert.equal((await rows())[0].state, "cancelled");
          assert.deepEqual((await rows())[0].user_data, {});
          assert.equal(
            await store.completeAdvertising({
              id: job.id,
              claimToken: job.claimToken,
              now: NOW,
            }),
            false,
          );
          await store.register(registration("after-withdrawal", measurement));
          assert.equal((await rows()).length, 1);
          const newToken = "b".repeat(43);
          await store.withdrawAdvertising({
            consentKey: consentKey(newToken),
            now: NOW,
          });
          await store.register(
            registration(
              "pre-withdrawal",
              readAdvertisingMeasurement(
                { ...accepted, token: newToken },
                UA,
                NOW,
              ),
            ),
          );
          assert.equal((await rows()).length, 1);
        },
      );

      await t.test(
        "unknown withdrawals expire without extension, real consent withdrawals retain their suppression, and delayed signup stays unmeasured",
        async () => {
          await reset();
          const unknownKey = consentKey(TOKEN);
          await store.withdrawAdvertising({ consentKey: unknownKey, now: NOW });
          const getConsent = async (key) =>
            (
              await pool.query(
                "SELECT * FROM advertising_consents WHERE consent_key = $1",
                [key],
              )
            ).rows[0];
          const first = await getConsent(unknownKey);
          assert.equal(first.granted_at, null);
          assert.equal(first.expires_at.getTime(), NOW.getTime() + 86400_000);
          await store.withdrawAdvertising({
            consentKey: unknownKey,
            now: new Date(NOW.getTime() + 3600_000),
          });
          assert.equal(
            (await getConsent(unknownKey)).expires_at.getTime(),
            first.expires_at.getTime(),
          );
          await store.register({
            ...registration("delayed", measurement),
            now: new Date(NOW.getTime() + 7200_000),
          });
          assert.equal((await rows()).length, 0);
          const otherToken = "b".repeat(43);
          const known = readAdvertisingMeasurement(
            { ...accepted, token: otherToken },
            UA,
            NOW,
          );
          await store.register(registration("known", known));
          await store.withdrawAdvertising({
            consentKey: known.consentKey,
            now: NOW,
          });
          assert.equal(
            (await getConsent(known.consentKey)).granted_at.getTime(),
            NOW.getTime(),
          );
          assert.equal(
            (await getConsent(known.consentKey)).expires_at.getTime(),
            NOW.getTime() + 180 * 86400_000,
          );
          await store.withdrawAdvertising({
            consentKey: known.consentKey,
            now: new Date(NOW.getTime() + 86400_000),
          });
          assert.equal(
            (await getConsent(known.consentKey)).expires_at.getTime(),
            NOW.getTime() + 180 * 86400_000,
          );
          // Retention is a store operation and does not depend on Meta being enabled.
          await store.maintainAdvertising({
            now: new Date(NOW.getTime() + 86400_001),
          });
          assert.equal(await getConsent(unknownKey), undefined);
          assert.ok(await getConsent(known.consentKey));
          await store.maintainAdvertising({
            now: new Date(NOW.getTime() + 31 * 86400_000),
          });
          assert.equal((await rows()).length, 0);
          assert.ok(await getConsent(known.consentKey));
          await store.maintainAdvertising({
            now: new Date(NOW.getTime() + 181 * 86400_000),
          });
          assert.equal(await getConsent(known.consentKey), undefined);
        },
      );

      await t.test(
        "provider timeouts, HTTP failures and transient Graph errors retry the same ID/time with the match allowlist",
        async () => {
          await reset();
          await store.register(registration("retry", measurement));
          let now = NOW;
          const requests = [];
          const runtime = {
            store,
            config,
            clock: () => now,
            fetcher: async (url, options) => {
              requests.push({ url, options, body: JSON.parse(options.body) });
              if (requests.length === 1)
                throw new Error("Network failed with private provider details");
              if (requests.length === 2)
                return new Response("provider failure", { status: 500 });
              if (requests.length === 3)
                return Response.json(
                  {
                    error: {
                      is_transient: true,
                      message: "private provider details",
                    },
                  },
                  { status: 400 },
                );
              return Response.json({ events_received: 1 });
            },
          };
          assert.deepEqual(await deliverAdvertisingOne(runtime), {
            status: "retry",
          });
          now = new Date(NOW.getTime() + 60_001);
          assert.deepEqual(await deliverAdvertisingOne(runtime), {
            status: "retry",
          });
          now = new Date(NOW.getTime() + 180_002);
          assert.deepEqual(await deliverAdvertisingOne(runtime), {
            status: "retry",
          });
          now = new Date(NOW.getTime() + 420_003);
          assert.deepEqual(await deliverAdvertisingOne(runtime), {
            status: "accepted",
          });
          assert.equal(
            new Set(requests.map((item) => item.body.data[0].event_id)).size,
            1,
          );
          assert.equal(
            new Set(requests.map((item) => item.body.data[0].event_time)).size,
            1,
          );
          for (const { url, options, body } of requests) {
            assert.equal(
              url,
              `https://graph.facebook.com/${settings.apiVersion}/${settings.datasetId}/events`,
            );
            assert.equal(
              options.headers.Authorization,
              `Bearer ${settings.accessToken}`,
            );
            assert.equal(options.redirect, "error");
            assert.deepEqual(body.data[0].user_data, measurement.userData);
            assert.equal(body.data[0].event_name, "Lead");
            assert.equal(body.data[0].action_source, "website");
            assert.equal(body.data[0].event_source_url, `${ORIGIN}/#pro-tier`);
            assert.doesNotMatch(
              JSON.stringify(body),
              /retry@example|email|client_ip_address|192\.0|subscriber_id|unsubscribe|accessToken/,
            );
          }
          assert.equal((await rows())[0].state, "sent");
          assert.deepEqual((await rows())[0].user_data, {});
          assert.deepEqual(await deliverAdvertisingOne(runtime), {
            status: "idle",
          });
        },
      );

      await t.test(
        "expired leases retry the same event while stale workers cannot complete a new lease",
        async () => {
          await reset();
          await store.register(registration("lease", measurement));
          const first = await store.claimAdvertising({ now: NOW });
          assert.equal(await store.claimAdvertising({ now: NOW }), null);
          const second = await store.claimAdvertising({
            now: new Date(NOW.getTime() + 60_001),
          });
          assert.equal(second.id, first.id);
          assert.notEqual(second.claimToken, first.claimToken);
          assert.equal(
            await store.completeAdvertising({ ...first, now: NOW }),
            false,
          );
          assert.equal(
            await store.completeAdvertising({ ...second, now: NOW }),
            true,
          );
        },
      );

      await t.test(
        "permanent errors, retry exhaustion and expiry remove identifiers without affecting subscribers or email jobs",
        async () => {
          await reset();
          await store.register(registration("permanent", measurement));
          assert.deepEqual(
            await deliverAdvertisingOne({
              store,
              config,
              clock: () => NOW,
              fetcher: async () => new Response("error", { status: 400 }),
            }),
            { status: "failed" },
          );
          assert.equal((await rows())[0].state, "failed");
          assert.deepEqual((await rows())[0].user_data, {});
          await store.register(registration("exhausted", measurement));
          let now = NOW;
          for (let attempt = 0; attempt < 6; attempt++) {
            await deliverAdvertisingOne({
              store,
              config,
              clock: () => now,
              fetcher: async () =>
                new Response("rate limited", { status: 429 }),
            });
            now = new Date(now.getTime() + 60_001 * 2 ** attempt);
          }
          assert.ok(
            (await rows()).every(
              (job) =>
                job.state === "failed" &&
                Object.keys(job.user_data).length === 0,
            ),
          );
          await store.register(registration("expired", measurement));
          await store.maintainAdvertising({
            now: new Date(NOW.getTime() + 86400_001),
          });
          const expired = (await rows()).find((job) => job.state === "expired");
          assert.ok(expired);
          assert.deepEqual(expired.user_data, {});
          assert.equal(
            (await pool.query("SELECT count(*) FROM waitlist_subscribers"))
              .rows[0].count,
            "3",
          );
          assert.equal(
            (await pool.query("SELECT count(*) FROM waitlist_outbox")).rows[0]
              .count,
            "6",
          );
        },
      );

      await t.test(
        "an outbox insert failure rolls back subscription and email jobs together",
        async () => {
          await reset();
          await pool.query(
            "ALTER TABLE waitlist_advertising_outbox ADD CONSTRAINT test_reject CHECK (false) NOT VALID",
          );
          try {
            await assert.rejects(
              store.register(registration("rollback", measurement)),
            );
            assert.equal(
              (await pool.query("SELECT count(*) FROM waitlist_subscribers"))
                .rows[0].count,
              "0",
            );
            assert.equal(
              (await pool.query("SELECT count(*) FROM waitlist_outbox")).rows[0]
                .count,
              "0",
            );
          } finally {
            await pool.query(
              "ALTER TABLE waitlist_advertising_outbox DROP CONSTRAINT test_reject",
            );
          }
        },
      );
    } finally {
      await pool?.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
