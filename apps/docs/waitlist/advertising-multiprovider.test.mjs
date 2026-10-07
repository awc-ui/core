import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AD_CONSENT_VERSION,
  readAdvertisingMeasurement,
  deliverAdvertisingOne,
  deliverAdvertisingBatch,
} from "./advertising.mjs";
import { createWaitlistStore } from "./store.mjs";
import { createJoinHandler } from "./handler.mjs";

const now = new Date("2026-10-07T12:00:00Z");
const measurement = {
  consent: true,
  version: AD_CONSENT_VERSION,
  token: "t".repeat(43),
  fbp: `fb.1.${now.getTime()}.1234`,
  rdt_cid: "reddit-click",
  gclid: "google-click",
};
const configs = {
  meta: {
    datasetId: "123456789",
    apiVersion: "v26.0",
    accessToken: "test-only-meta-token",
  },
  reddit: { pixelId: "a2_testpixel", accessToken: "test-only-reddit-token" },
  google: {
    customerId: "1234567890",
    conversionActionId: "123456",
    clientId: "test.apps.googleusercontent.com",
    clientSecret: "test-secret",
    refreshToken: "test-refresh",
  },
};
const config = {
  joinEnabled: true,
  turnstileSecret: "test-only",
  closesAt: null,
  hmacSecret: "h".repeat(32),
  advertising: configs.meta,
  advertisingProviders: { reddit: configs.reddit, google: configs.google },
};
const ua = "Mozilla/5.0 Test";
const request = (email, ad = measurement, website = "") =>
  new Request("https://awc-ui.dev/api/waitlist", {
    method: "POST",
    headers: {
      origin: "https://awc-ui.dev",
      "content-type": "application/json",
      "user-agent": ua,
    },
    body: JSON.stringify({
      email,
      token: "challenge",
      advertising: ad,
      website,
    }),
  });

test("provider click IDs require consent and independent enabled configuration; unsafe or conflicting identifiers are ignored", () => {
  const parsed = readAdvertisingMeasurement(measurement, ua, now, configs);
  assert.deepEqual(parsed.providers, {
    reddit: { click_id: "reddit-click" },
    google: { gclid: "google-click" },
  });
  assert.ok(parsed.destinations.reddit);
  assert.ok(parsed.destinations.google);
  const redditOnly = readAdvertisingMeasurement(measurement, ua, now, {
    reddit: configs.reddit,
  });
  assert.equal(redditOnly.userData, undefined);
  assert.deepEqual(redditOnly.providers, {
    reddit: { click_id: "reddit-click" },
  });
  assert.equal(readAdvertisingMeasurement(measurement, ua, now, {}), null);
  for (const ad of [
    { ...measurement, consent: false },
    { ...measurement, version: "advertising-2026-10-06-v1" },
    { ...measurement, email: "private@example.test" },
  ])
    assert.equal(readAdvertisingMeasurement(ad, ua, now, configs), null);
  for (const invalid of [
    "",
    "x".repeat(501),
    "abc\n",
    "abc\r",
    "abc\0",
    "https://private.test",
    "space id",
  ]) {
    const parsed = readAdvertisingMeasurement(
      { ...measurement, rdt_cid: invalid, gclid: invalid },
      ua,
      now,
      configs,
    );
    assert.equal(
      parsed.providers,
      undefined,
      "valid Meta attribution survives other malformed providers",
    );
    assert.ok(parsed.userData.fbp);
  }
  for (const key of ["gbraid", "wbraid"]) {
    const parsed = readAdvertisingMeasurement(
      { ...measurement, [key]: "conflicting-id" },
      ua,
      now,
      configs,
    );
    assert.equal(parsed.providers.google, undefined);
    assert.ok(parsed.providers.reddit);
  }
});

test(
  "multi-provider transactional signup, withdrawal, delivery isolation and asynchronous Google diagnostics",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL for isolated PostgreSQL integration tests",
    timeout: 60000,
  },
  async (t) => {
    const { Pool } = await import("pg");
    const schema = `provider_test_${randomBytes(8).toString("hex")}`;
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
        max: 20,
      });
      for (const file of [
        "202610020001_create_waitlist.sql",
        "202610060001_advertising_measurement.sql",
        "202610070001_advertising_providers.sql",
      ])
        await pool.query(
          await readFile(
            new URL(`../netlify/database/migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
      const store = createWaitlistStore(pool);
      const join = (settings = config) =>
        createJoinHandler({
          store,
          config: settings,
          clock: () => now,
          verify: async () => true,
        });
      const rows = async () =>
        (
          await pool.query(
            "SELECT * FROM waitlist_advertising_outbox ORDER BY provider",
          )
        ).rows;
      const reset = () =>
        pool.query(
          "TRUNCATE waitlist_advertising_outbox, advertising_consents, waitlist_outbox, waitlist_send_attempts, waitlist_subscribers, waitlist_budgets",
        );
      const submit = (
        email,
        ad = measurement,
        settings = config,
        website = "",
      ) => join(settings)(request(email, ad, website), { ip: "192.0.2.30" });
      await t.test(
        "concurrent duplicates create one event per configured provider and preserve the same public response",
        async () => {
          const responses = await Promise.all(
            Array.from({ length: 20 }, () => submit("one@example.test")),
          );
          for (const response of responses) {
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { ok: true });
          }
          assert.deepEqual(
            (await rows()).map((row) => row.provider),
            ["google", "meta", "reddit"],
          );
          assert.equal(new Set((await rows()).map((row) => row.id)).size, 3);
          assert.equal(
            (await pool.query("SELECT count(*)::int AS n FROM waitlist_outbox"))
              .rows[0].n,
            2,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM waitlist_subscribers",
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "reject, outdated consent, honeypot and disabled configs never enqueue a conversion",
        async () => {
          await reset();
          for (const [index, ad] of [
            null,
            { ...measurement, consent: false },
            { ...measurement, version: "advertising-2026-10-06-v1" },
          ].entries())
            assert.equal(
              (await submit(`reject${index}@example.test`, ad)).status,
              200,
            );
          assert.equal(
            (await submit("honeypot@example.test", measurement, config, "bot"))
              .status,
            200,
          );
          assert.equal(
            (
              await submit("off@example.test", measurement, {
                ...config,
                advertising: null,
                advertisingProviders: {},
              })
            ).status,
            200,
          );
          assert.equal((await rows()).length, 0);
        },
      );
      await t.test(
        "withdrawal cancels every provider, including an already leased job; re-grant cannot replay an existing subscriber",
        async () => {
          await reset();
          await submit("withdraw@example.test");
          const google = await store.claimAdvertising({
            now,
            providers: ["google"],
          });
          await store.deferAdvertising({
            id: google.id,
            claimToken: google.claimToken,
            requestId: "test-request",
            now,
          });
          const meta = await store.claimAdvertising({
            now,
            providers: ["meta"],
          });
          await store.withdrawAdvertising({
            consentKey: readAdvertisingMeasurement(
              measurement,
              ua,
              now,
              configs,
            ).consentKey,
            now,
          });
          assert.equal(
            await store.advertisingCanSend({
              id: meta.id,
              claimToken: meta.claimToken,
              now,
            }),
            false,
          );
          for (const row of await rows()) {
            assert.equal(row.state, "cancelled");
            assert.deepEqual(row.user_data, {});
          }
          await submit("withdraw@example.test", {
            ...measurement,
            token: "n".repeat(43),
          });
          assert.equal((await rows()).length, 3);
          const pre = readAdvertisingMeasurement(
            { ...measurement, token: "p".repeat(43) },
            ua,
            now,
            configs,
          );
          await store.withdrawAdvertising({ consentKey: pre.consentKey, now });
          await submit("race@example.test", {
            ...measurement,
            token: "p".repeat(43),
          });
          assert.equal((await rows()).length, 3);
        },
      );
      await t.test(
        "disabled providers remain unclaimed; other provider failure cannot prevent accepted Meta delivery",
        async () => {
          await reset();
          await submit("delivery@example.test");
          const calls = [];
          const fetcher = async (url) => {
            calls.push(url);
            return url.startsWith("https://graph.facebook.com/")
              ? Response.json({ events_received: 1 })
              : Response.json({}, { status: 503 });
          };
          await deliverAdvertisingBatch(
            {
              store,
              config: {
                ...config,
                advertisingProviders: { reddit: configs.reddit },
              },
              fetcher,
              clock: () => now,
            },
            { maxJobs: 3 },
          );
          const state = Object.fromEntries(
            (await rows()).map((row) => [row.provider, row.state]),
          );
          assert.deepEqual(state, {
            google: "pending",
            meta: "sent",
            reddit: "pending",
          });
          assert.equal(calls.length, 2);
          assert.ok(calls.every((url) => !url.includes("googleapis")));
        },
      );
      await t.test(
        "a pending slow provider cannot delay another provider from starting delivery",
        async () => {
          await reset();
          await submit("slow-provider@example.test");
          let releaseReddit, metaStarted;
          const blocked = new Promise((resolve) => {
            releaseReddit = resolve;
          });
          const started = new Promise((resolve) => {
            metaStarted = resolve;
          });
          const batch = deliverAdvertisingBatch(
            {
              store,
              config: {
                ...config,
                advertisingProviders: { reddit: configs.reddit },
              },
              clock: () => now,
              fetcher: async (url) => {
                if (url.startsWith("https://ads-api.reddit.com/")) {
                  await blocked;
                  return Response.json({}, { status: 503 });
                }
                metaStarted();
                return Response.json({ events_received: 1 });
              },
            },
            { maxJobs: 2 },
          );
          await Promise.race([
            started,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Meta starved")), 1500),
            ),
          ]);
          releaseReddit();
          await batch;
          assert.equal(
            (await rows()).find((row) => row.provider === "meta").state,
            "sent",
          );
        },
      );
      await t.test(
        "Google remains processing until diagnostics confirm the exact destination, retaining ID and clearing match data on acknowledgement",
        async () => {
          await reset();
          await submit("google@example.test");
          const settings = {
            ...config,
            advertising: null,
            advertisingProviders: { google: configs.google },
          };
          const payloads = [],
            urls = [];
          const fetcher = async (url, options) => {
            urls.push(url);
            if (url === "https://oauth2.googleapis.com/token")
              return Response.json({
                access_token: "test-access",
                token_type: "Bearer",
                expires_in: 3600,
              });
            if (url.endsWith("/v1/events:ingest")) {
              payloads.push(JSON.parse(options.body));
              return Response.json({ requestId: "request-123" });
            }
            return Response.json({
              requestStatusPerDestination: [
                {
                  destination: {
                    operatingAccount: {
                      accountType: "GOOGLE_ADS",
                      accountId: configs.google.customerId,
                    },
                    productDestinationId: configs.google.conversionActionId,
                  },
                  requestStatus: "SUCCESS",
                  eventsIngestionStatus: { recordCount: "1" },
                },
              ],
            });
          };
          assert.deepEqual(
            await deliverAdvertisingOne({
              store,
              config: settings,
              fetcher,
              clock: () => now,
            }),
            { status: "processing" },
          );
          let row = (await rows()).find((row) => row.provider === "google");
          assert.equal(row.state, "processing");
          assert.equal(row.remote_request_id, "request-123");
          assert.deepEqual(row.user_data, {});
          assert.equal(payloads[0].events[0].transactionId, row.id);
          assert.deepEqual(
            await deliverAdvertisingOne({
              store,
              config: settings,
              fetcher,
              clock: () => now,
            }),
            { status: "idle" },
          );
          assert.deepEqual(
            await deliverAdvertisingOne({
              store,
              config: settings,
              fetcher,
              clock: () => new Date(now.getTime() + 31 * 60000),
            }),
            { status: "accepted" },
          );
          row = (await rows()).find((row) => row.provider === "google");
          assert.equal(row.state, "sent");
          assert.equal(payloads.length, 1);
          assert.ok(
            urls.some((url) =>
              url.includes("requestStatus:retrieve?requestId=request-123"),
            ),
          );
        },
      );
      await t.test(
        "withdrawal during Google OAuth prevents conversion ingestion before it starts",
        async () => {
          await reset();
          await submit("oauth-race@example.test");
          let releaseToken, tokenStarted;
          const started = new Promise((resolve) => {
            tokenStarted = resolve;
          });
          const token = new Promise((resolve) => {
            releaseToken = resolve;
          });
          const calls = [];
          const delivery = deliverAdvertisingOne({
            store,
            config: {
              ...config,
              advertising: null,
              advertisingProviders: { google: configs.google },
            },
            clock: () => now,
            fetcher: async (url) => {
              calls.push(url);
              tokenStarted();
              await token;
              return Response.json({
                access_token: "test-access",
                token_type: "Bearer",
                expires_in: 3600,
              });
            },
          });
          await started;
          await store.withdrawAdvertising({
            consentKey: readAdvertisingMeasurement(
              measurement,
              ua,
              now,
              configs,
            ).consentKey,
            now,
          });
          releaseToken();
          assert.deepEqual(await delivery, { status: "cancelled" });
          assert.deepEqual(calls, ["https://oauth2.googleapis.com/token"]);
          assert.equal(
            (await rows()).find((row) => row.provider === "google").state,
            "cancelled",
          );
        },
      );
      await t.test(
        "a changed destination fails closed rather than rerouting a queued conversion",
        async () => {
          await reset();
          await submit("changed@example.test");
          let calls = 0;
          const result = await deliverAdvertisingOne({
            store,
            config: {
              ...config,
              advertising: null,
              advertisingProviders: {
                reddit: { ...configs.reddit, pixelId: "a2_changed" },
              },
            },
            fetcher: async () => {
              calls++;
              return Response.json({});
            },
            clock: () => now,
          });
          assert.deepEqual(result, { status: "failed" });
          assert.equal(calls, 0);
          const row = (await rows()).find((row) => row.provider === "reddit");
          assert.equal(row.last_error, "destination_changed");
          assert.deepEqual(row.user_data, {});
        },
      );
      await t.test(
        "provider retries use the same conversion ID/time; expired and malformed payloads are never sent",
        async () => {
          await reset();
          await submit("retry@example.test");
          const payloads = [];
          const settings = {
            ...config,
            advertising: null,
            advertisingProviders: { reddit: configs.reddit },
          };
          const fetcher = async (_url, options) => {
            payloads.push(JSON.parse(options.body));
            return payloads.length === 1
              ? Response.json({}, { status: 503 })
              : Response.json({
                  data: {
                    message: "Successfully processed 1 conversion events.",
                  },
                });
          };
          assert.deepEqual(
            await deliverAdvertisingOne({
              store,
              config: settings,
              fetcher,
              clock: () => now,
            }),
            { status: "retry" },
          );
          assert.deepEqual(
            await deliverAdvertisingOne({
              store,
              config: settings,
              fetcher,
              clock: () => new Date(now.getTime() + 61000),
            }),
            { status: "accepted" },
          );
          assert.deepEqual(payloads[0], payloads[1]);
          await store.maintainAdvertising({
            now: new Date(now.getTime() + 86400001),
          });
          assert.ok(
            (await rows())
              .filter((row) => row.provider !== "reddit")
              .every(
                (row) =>
                  row.state === "expired" &&
                  Object.keys(row.user_data).length === 0,
              ),
          );
        },
      );
    } finally {
      await pool?.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
