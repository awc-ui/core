import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deliverProvider,
  providerDestination,
  readProviderConfigs,
} from "./advertising-providers.mjs";
import {
  AD_CONSENT_VERSION,
  readAdvertisingMeasurement,
  deliverAdvertisingOne,
} from "./advertising.mjs";
import { createWaitlistStore } from "./store.mjs";
import { createJoinHandler } from "./handler.mjs";

const env = {
  LINKEDIN_CAPI_ENABLED: "true",
  LINKEDIN_CONVERSION_ID: "12345678",
  LINKEDIN_CAPI_ACCESS_TOKEN: "test-only-linkedin-access-token",
  LINKEDIN_API_VERSION: "202609",
};
const settings = {
  conversionId: env.LINKEDIN_CONVERSION_ID,
  accessToken: env.LINKEDIN_CAPI_ACCESS_TOKEN,
  apiVersion: env.LINKEDIN_API_VERSION,
};
const now = new Date("2026-10-17T12:34:56Z");
const job = {
  id: "8b87ee82-5a98-491f-b662-f52ed89f2e2a",
  createdAt: now,
  userData: { li_fat_id: "test_linkedin-click-123" },
};
const measurement = {
  consent: true,
  version: AD_CONSENT_VERSION,
  token: "t".repeat(43),
  li_fat_id: job.userData.li_fat_id,
};
const deliver = (fetcher, overrides = {}) =>
  deliverProvider({ provider: "linkedin", settings, job, fetcher, ...overrides });

test("LinkedIn configuration is opt-in, bounded and independently validated", () => {
  assert.equal(readProviderConfigs({}).linkedin, null);
  assert.deepEqual(readProviderConfigs(env).linkedin, settings);
  for (const invalid of [
    { LINKEDIN_CAPI_ENABLED: "TRUE" },
    { LINKEDIN_CONVERSION_ID: "" },
    { LINKEDIN_CONVERSION_ID: "urn:lla:llaPartnerConversion:123" },
    { LINKEDIN_CONVERSION_ID: "123/../456" },
    { LINKEDIN_CONVERSION_ID: "123\n" },
    { LINKEDIN_CONVERSION_ID: "1".repeat(31) },
    { LINKEDIN_CAPI_ACCESS_TOKEN: "" },
    { LINKEDIN_CAPI_ACCESS_TOKEN: "private token" },
    { LINKEDIN_CAPI_ACCESS_TOKEN: "private\r\nHeader" },
    { LINKEDIN_CAPI_ACCESS_TOKEN: "x".repeat(4097) },
    { LINKEDIN_API_VERSION: undefined },
    { LINKEDIN_API_VERSION: "2026-09" },
    { LINKEDIN_API_VERSION: "202609\n" },
  ])
    assert.equal(readProviderConfigs({ ...env, ...invalid }).linkedin, null);
  assert.equal(readProviderConfigs({ ...env, GOOGLE_CONVERSIONS_ENABLED: "true" }).google, null);
  assert.deepEqual(readProviderConfigs({ ...env, GOOGLE_CONVERSIONS_ENABLED: "true" }).linkedin, settings);
});

test("LinkedIn destinations bind the conversion and tolerate token rotation", () => {
  const destination = providerDestination("linkedin", settings);
  assert.ok(destination?.includes(settings.conversionId));
  assert.equal(providerDestination("linkedin", { ...settings, accessToken: "test-only-rotated-token" }), destination);
  assert.notEqual(providerDestination("linkedin", { ...settings, conversionId: "87654321" }), destination);
  assert.equal(providerDestination("linkedin", {}), null);
});

test("LinkedIn sends exactly one stable signup using only the consented first-party click identifier", async () => {
  const requests = [];
  const result = await deliver(async (url, options) => {
    requests.push({ url, options });
    return new Response(null, { status: 201 });
  });
  assert.deepEqual(result, { status: "accepted" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.linkedin.com/rest/conversionEvents");
  const options = requests[0].options;
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  const headers = new Headers(options.headers);
  assert.equal(headers.get("authorization"), `Bearer ${env.LINKEDIN_CAPI_ACCESS_TOKEN}`);
  assert.equal(headers.get("linkedin-version"), "202609");
  assert.equal(headers.get("x-restli-protocol-version"), "2.0.0");
  assert.deepEqual(JSON.parse(options.body), {
    conversion: "urn:lla:llaPartnerConversion:12345678",
    conversionHappenedAt: now.getTime(),
    eventId: job.id,
    user: { userIds: [{ idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: job.userData.li_fat_id }] },
  });
});

test("LinkedIn rejects missing, malformed or additional identity data before any network call", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error("unexpected request"); };
  for (const userData of [
    {}, [], { li_fat_id: "" }, { li_fat_id: "x".repeat(501) },
    { li_fat_id: "click\n" }, { li_fat_id: "https://private.test" },
    { li_fat_id: "click", email: "private@example.test" },
    { li_fat_id: "click", emailHash: "a".repeat(64) },
    { li_fat_id: "click", ip_address: "192.0.2.1" },
    { li_fat_id: "click", client_user_agent: "private UA" },
    { li_fat_id: "click", gclid: "other-click" },
  ])
    assert.equal((await deliver(fetcher, { job: { ...job, userData } })).status, "failed");
  for (const override of [{ id: "unsafe\n" }, { createdAt: "invalid" }])
    assert.equal((await deliver(fetcher, { job: { ...job, ...override } })).status, "failed");
  assert.equal((await deliver(fetcher, { settings: { ...settings, conversionId: "unsafe/path" } })).status, "failed");
  assert.equal(calls, 0);
});

test("LinkedIn checks revocation immediately before transmission", async () => {
  const actions = [];
  assert.deepEqual(await deliver(async () => {
    actions.push("network");
    return new Response(null, { status: 201 });
  }, { canSend: async () => { actions.push("check"); return false; } }), { status: "cancelled" });
  assert.deepEqual(actions, ["check"]);
  assert.deepEqual(await deliver(async () => {
    actions.push("network");
    return new Response(null, { status: 201 });
  }, { canSend: async () => { actions.push("check"); return true; } }), { status: "accepted" });
  assert.deepEqual(actions, ["check", "check", "network"]);
});

test("LinkedIn accepts only HTTP 201, bounds retries and never exposes provider details", async () => {
  for (const [httpStatus, status] of [
    [200, "retry"], [202, "retry"], [204, "retry"],
    [400, "failed"], [401, "failed"], [403, "failed"],
    [429, "retry"], [500, "retry"], [503, "retry"],
  ]) {
    const result = await deliver(async () => new Response(httpStatus === 204 ? null : "private@example.test", { status: httpStatus }));
    assert.equal(result.status, status, `HTTP ${httpStatus}`);
    assert.ok(!JSON.stringify(result).includes("private@example.test"));
  }
  const result = await deliver(async () => { throw new Error("private-token-value"); });
  assert.equal(result.status, "retry");
  assert.ok(!JSON.stringify(result).includes("private-token-value"));
});

test("LinkedIn retries preserve the original event ID and signup timestamp", async () => {
  const requests = [];
  const fetcher = async (_url, options) => {
    requests.push(options.body);
    return new Response(null, { status: requests.length === 1 ? 503 : 201 });
  };
  assert.equal((await deliver(fetcher)).status, "retry");
  assert.equal((await deliver(fetcher)).status, "accepted");
  assert.equal(requests[0], requests[1]);
});

test("LinkedIn attribution requires the new consent and enabled config without inheriting email or other providers' identity", () => {
  const configs = { linkedin: settings };
  const parsed = readAdvertisingMeasurement(measurement, "private UA", now, configs);
  assert.deepEqual(parsed.providers, { linkedin: job.userData });
  assert.equal(parsed.userData, undefined);
  assert.equal(parsed.destinations.linkedin, providerDestination("linkedin", settings));
  for (const value of [
    { ...measurement, consent: false },
    { ...measurement, version: "advertising-2026-10-07-v2" },
    { ...measurement, email: "private@example.test" },
    { ...measurement, li_fat_id: undefined },
    { ...measurement, li_fat_id: "bad\n" },
  ]) assert.equal(readAdvertisingMeasurement(value, "private UA", now, configs), null);
  assert.equal(readAdvertisingMeasurement(measurement, "private UA", now, {}), null);
});

test("LinkedIn transactional outbox records only new signups and prevents replay or rerouting", {
  skip: !process.env.TEST_DATABASE_URL && "Set TEST_DATABASE_URL for isolated PostgreSQL integration tests",
  timeout: 60000,
}, async (t) => {
  const { Pool } = await import("pg");
  const schema = `linkedin_test_${randomBytes(8).toString("hex")}`;
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}`, max: 20 });
    for (const file of [
      "202610020001_create_waitlist.sql",
      "202610060001_advertising_measurement.sql",
      "202610070001_advertising_providers.sql",
      "202610170001_linkedin_measurement.sql",
    ]) await pool.query(await readFile(new URL(`../netlify/database/migrations/${file}`, import.meta.url), "utf8"));
    const store = createWaitlistStore(pool);
    const config = {
      joinEnabled: true, turnstileSecret: "test-only", closesAt: null,
      hmacSecret: "h".repeat(32), advertising: null, advertisingProviders: { linkedin: settings },
    };
    const join = createJoinHandler({ store, config, clock: () => now, verify: async () => true });
    const submit = (email, ad = measurement, website = "") => join(new Request("https://awc-ui.dev/api/waitlist", {
      method: "POST", headers: { origin: "https://awc-ui.dev", "content-type": "application/json", "user-agent": "Mozilla/5.0 Test" },
      body: JSON.stringify({ email, token: "challenge", advertising: ad, website }),
    }), { ip: "192.0.2.30" });
    const rows = async () => (await pool.query("SELECT * FROM waitlist_advertising_outbox ORDER BY created_at")).rows;
    const reset = () => pool.query("TRUNCATE waitlist_advertising_outbox, advertising_consents, waitlist_outbox, waitlist_send_attempts, waitlist_subscribers, waitlist_budgets");

    await t.test("concurrent duplicate POSTs create one subscriber and one click-only LinkedIn event", async () => {
      for (const response of await Promise.all(Array.from({ length: 20 }, () => submit("one@example.test")))) {
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      }
      const queued = await rows();
      assert.equal(queued.length, 1);
      assert.equal(queued[0].provider, "linkedin");
      assert.deepEqual(queued[0].user_data, job.userData);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM waitlist_subscribers")).rows[0].n, 1);
      assert.equal((await pool.query("SELECT count(*)::int AS n FROM waitlist_outbox")).rows[0].n, 2);
      await submit("one@example.test", { ...measurement, token: "n".repeat(43) });
      assert.equal((await rows()).length, 1);
    });

    await t.test("outdated consent and honeypot remain unmeasured despite identical successful responses", async () => {
      await reset();
      for (const [email, ad, website] of [
        ["old@example.test", { ...measurement, version: "advertising-2026-10-07-v2" }, ""],
        ["none@example.test", null, ""],
        ["bot@example.test", measurement, "honeypot"],
      ]) {
        const response = await submit(email, ad, website);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      }
      assert.equal((await rows()).length, 0);
      await submit("suppressed@example.test", null);
      const subscriber = (await pool.query("SELECT unsubscribe_hash FROM waitlist_subscribers WHERE email = $1", ["suppressed@example.test"])).rows[0];
      await store.unsubscribe({ unsubscribeHash: subscriber.unsubscribe_hash, now });
      const response = await submit("suppressed@example.test");
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      assert.equal((await rows()).length, 0);
    });

    await t.test("withdrawal cancels a claimed LinkedIn event and erases its click identity", async () => {
      await reset();
      await submit("withdraw@example.test");
      const leased = await store.claimAdvertising({ now, providers: ["linkedin"] });
      await store.withdrawAdvertising({ consentKey: readAdvertisingMeasurement(measurement, "Mozilla/5.0 Test", now, { linkedin: settings }).consentKey, now });
      assert.equal(await store.advertisingCanSend({ id: leased.id, claimToken: leased.claimToken, now }), false);
      assert.equal((await rows())[0].state, "cancelled");
      assert.deepEqual((await rows())[0].user_data, {});
    });

    await t.test("changing conversion destination never sends a queued signup to another campaign", async () => {
      await reset();
      await submit("destination@example.test");
      let calls = 0;
      const result = await deliverAdvertisingOne({ store, config: { ...config, advertisingProviders: { linkedin: { ...settings, conversionId: "87654321" } } }, clock: () => now,
        fetcher: async () => { calls++; return new Response(null, { status: 201 }); },
      });
      assert.equal(result.status, "failed");
      assert.equal(calls, 0);
      assert.equal((await rows())[0].last_error, "destination_changed");
      assert.deepEqual((await rows())[0].user_data, {});
    });

    await t.test("outbox retries preserve the event and erase identity only after acceptance", async () => {
      await reset();
      await submit("retry@example.test");
      const bodies = [];
      const fetcher = async (_url, options) => { bodies.push(options.body); return new Response(null, { status: bodies.length === 1 ? 503 : 201 }); };
      assert.equal((await deliverAdvertisingOne({ store, config, clock: () => now, fetcher })).status, "retry");
      assert.deepEqual((await rows())[0].user_data, job.userData);
      assert.equal((await deliverAdvertisingOne({ store, config, clock: () => new Date(now.getTime() + 61000), fetcher })).status, "accepted");
      assert.equal(bodies[0], bodies[1]);
      assert.equal((await rows())[0].state, "sent");
      assert.deepEqual((await rows())[0].user_data, {});
    });

    await t.test("database rejects extra LinkedIn identity fields even if a caller bypasses the parser", async () => {
      await reset();
      await submit("database@example.test");
      await assert.rejects(pool.query("UPDATE waitlist_advertising_outbox SET user_data = $1::jsonb WHERE provider = 'linkedin'", [JSON.stringify({ ...job.userData, email: "private@example.test" })]), { code: "23514" });
      assert.deepEqual((await rows())[0].user_data, job.userData);
    });
  } finally {
    await pool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
