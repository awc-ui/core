import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { LIMITS, OWNER, readConfig } from "./config.mjs";
import { runSmtpCheck } from "./smtp-check.mjs";

const production = { deploy: { context: "production" } };
const now = new Date("2026-10-04T12:00:00Z");
const env = {
  WAITLIST_PRIVACY_READY: "true",
  WAITLIST_HMAC_SECRET: "test-only-operator-key-".repeat(2),
  WAITLIST_SMTP_PASSWORD: "test-only-password",
  WAITLIST_SMTP_CHECK_ENABLED: "true",
  WAITLIST_ENABLED: "false",
  WAITLIST_EMAIL_ENABLED: "false",
};

test("SMTP check requires trusted production metadata and privacy readiness", () => {
  for (const context of [
    undefined,
    {},
    { deploy: { context: "deploy-preview" } },
    { deploy: { context: "branch-deploy" } },
    { deploy: { context: "dev" } },
  ])
    assert.equal(readConfig({ ...env, CONTEXT: "production" }, context), null);
  for (const override of [
    { WAITLIST_PRIVACY_READY: undefined },
    { WAITLIST_PRIVACY_READY: "false" },
    { WAITLIST_HMAC_SECRET: undefined },
    { WAITLIST_HMAC_SECRET: "short" },
  ])
    assert.equal(readConfig({ ...env, ...override }, production), null);
  assert.equal(readConfig(env, production).smtpCheckEnabled, true);
});

test("SMTP check requires its explicit flag and both public switches explicitly off", () => {
  for (const override of [
    { WAITLIST_SMTP_CHECK_ENABLED: undefined },
    { WAITLIST_SMTP_CHECK_ENABLED: "false" },
    { WAITLIST_SMTP_CHECK_ENABLED: "TRUE" },
    { WAITLIST_ENABLED: undefined },
    { WAITLIST_ENABLED: "true" },
    { WAITLIST_ENABLED: "FALSE" },
    { WAITLIST_EMAIL_ENABLED: undefined },
    { WAITLIST_EMAIL_ENABLED: "true" },
    { WAITLIST_EMAIL_ENABLED: "FALSE" },
  ])
    assert.equal(
      readConfig({ ...env, ...override }, production).smtpCheckEnabled,
      false,
    );
});

test("disabled, incomplete, or general-delivery configurations have no SMTP-check side effects", async () => {
  const config = readConfig(env, production);
  for (const override of [
    { smtpCheckEnabled: false },
    { smtpCheckEnabled: undefined },
    { joinEnabled: true },
    { joinEnabled: undefined },
    { emailEnabled: true },
    { emailEnabled: undefined },
    { smtpPassword: "" },
    { smtpPassword: undefined },
  ]) {
    let registrations = 0;
    let deliveries = 0;
    await runSmtpCheck({
      config: { ...config, ...override },
      store: {
        register: async () => {
          registrations++;
        },
      },
      deliver: async () => {
        deliveries++;
      },
    });
    assert.equal(registrations, 0);
    assert.equal(deliveries, 0);
  }
});

test("SMTP check registers only the fixed owner with separate consent and scopes both deliveries", async () => {
  const config = Object.freeze({
    ...readConfig(env, production),
    recipient: "unrelated@example.test",
  });
  for (const status of ["registered", "existing"]) {
    const registrations = [];
    const deliveries = [];
    const subscriberId = "8b6c27b4-3833-4a92-823a-95ded48fc258";
    const store = {
      register: async (value) => {
        registrations.push(value);
        return { status, subscriberId };
      },
    };
    await runSmtpCheck({
      config,
      store,
      email: "unrelated@example.test",
      clock: () => now,
      deliver: async (value) => {
        deliveries.push(value);
      },
    });
    assert.equal(registrations.length, 1);
    const registration = registrations[0];
    assert.equal(registration.email, OWNER);
    assert.equal(registration.consentVersion, "operator-email-check-v1");
    assert.equal(registration.now, now);
    assert.deepEqual(registration.limits, LIMITS);
    assert.match(registration.unsubscribeToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(
      registration.unsubscribeHash,
      createHash("sha256").update(registration.unsubscribeToken).digest("hex"),
    );
    assert.equal(
      registration.emailKey,
      createHmac("sha256", config.hmacSecret)
        .update(`email:${OWNER}`)
        .digest("hex"),
    );
    assert.equal(
      registration.ipKey,
      createHmac("sha256", config.hmacSecret)
        .update("operator:smtp-check")
        .digest("hex"),
    );
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].store, store);
    assert.equal(deliveries[0].subscriberId, subscriberId);
    assert.equal(deliveries[0].maxJobs, 2);
    assert.equal(deliveries[0].config.emailEnabled, true);
    assert.equal(deliveries[0].config.joinEnabled, false);
    assert.equal(deliveries[0].config.smtpPassword, env.WAITLIST_SMTP_PASSWORD);
    assert.equal(config.emailEnabled, false);
  }
});

test("limited or failed registration never starts SMTP delivery", async () => {
  let deliveries = 0;
  const common = {
    config: readConfig(env, production),
    clock: () => now,
    deliver: async () => {
      deliveries++;
    },
  };
  await runSmtpCheck({
    ...common,
    store: { register: async () => ({ status: "limited" }) },
  });
  assert.equal(deliveries, 0);
  await assert.rejects(
    runSmtpCheck({
      ...common,
      store: {
        register: async () => {
          throw new Error("database unavailable");
        },
      },
    }),
    /database unavailable/,
  );
  assert.equal(deliveries, 0);
});
