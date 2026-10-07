import assert from "node:assert/strict";
import { test } from "node:test";
import { checkWaitlistRelease } from "./check-waitlist-release.mjs";

const valid = {
  CONTEXT: "production",
  PUBLIC_WAITLIST_ENABLED: "true",
  PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAFMA9reZtyiUb2Pf",
  PUBLIC_WAITLIST_CONTROLLER_NAME: "Example Controller",
  PUBLIC_WAITLIST_CONTACT_ADDRESS: "10 Testing Street, Test City",
};

test("Meta attribution defaults off and can only accompany the production public form", () => {
  assert.deepEqual(
    checkWaitlistRelease({ ...valid, PUBLIC_META_MEASUREMENT_ENABLED: "true" }),
    { enabled: true },
  );
  for (const overrides of [
    { CONTEXT: "deploy-preview" },
    { PUBLIC_WAITLIST_ENABLED: "false" },
    { PUBLIC_WAITLIST_ENABLED: undefined },
  ])
    assert.throws(
      () =>
        checkWaitlistRelease({
          ...valid,
          PUBLIC_META_MEASUREMENT_ENABLED: "true",
          ...overrides,
        }),
      /Meta measurement/,
    );
  assert.throws(
    () => checkWaitlistRelease({ PUBLIC_META_MEASUREMENT_ENABLED: "yes" }),
    /true or false/,
  );
});

test("disabled builds need no provider configuration and never expose a signup form", () => {
  assert.deepEqual(checkWaitlistRelease({}), { enabled: false });
  assert.deepEqual(checkWaitlistRelease({ PUBLIC_WAITLIST_ENABLED: "false" }), {
    enabled: false,
  });
});

test("enabled builds require a production context and real public settings", () => {
  assert.deepEqual(checkWaitlistRelease(valid), { enabled: true });
  for (const CONTEXT of [undefined, "dev", "deploy-preview", "branch-deploy"]) {
    assert.throws(
      () => checkWaitlistRelease({ ...valid, CONTEXT }),
      /production/,
    );
  }
  assert.throws(
    () => checkWaitlistRelease({ ...valid, PUBLIC_WAITLIST_ENABLED: "yes" }),
    /true or false/,
  );
  for (const PUBLIC_TURNSTILE_SITE_KEY of [
    "",
    "1x00000000000000000000AA",
    "2x00000000000000000000AB",
  ]) {
    assert.throws(
      () => checkWaitlistRelease({ ...valid, PUBLIC_TURNSTILE_SITE_KEY }),
      /real PUBLIC/,
    );
  }
});

test("unfinished personal controller details fail the public release", () => {
  for (const name of [
    "PUBLIC_WAITLIST_CONTROLLER_NAME",
    "PUBLIC_WAITLIST_CONTACT_ADDRESS",
  ]) {
    for (const value of ["", "TODO", "[Your address]", "privacy@example.com"]) {
      assert.throws(
        () => checkWaitlistRelease({ ...valid, [name]: value }),
        /completed PUBLIC/,
      );
    }
  }
});

test("operator page requires production, real provider settings and explicitly closed public signup", () => {
  const operator = {
    ...valid,
    PUBLIC_WAITLIST_ENABLED: "false",
    PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED: "true",
  };
  assert.deepEqual(checkWaitlistRelease(operator), {
    enabled: false,
    signupCheckEnabled: true,
  });
  for (const override of [
    { PUBLIC_WAITLIST_ENABLED: undefined },
    { PUBLIC_WAITLIST_ENABLED: "true" },
    { PUBLIC_WAITLIST_ENABLED: "" },
    { PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED: "yes" },
    { CONTEXT: "deploy-preview" },
    { CONTEXT: "dev" },
    { CONTEXT: undefined },
    { PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
    { PUBLIC_WAITLIST_CONTROLLER_NAME: "" },
    { PUBLIC_WAITLIST_CONTACT_ADDRESS: "" },
  ])
    assert.throws(() => checkWaitlistRelease({ ...operator, ...override }));
});
