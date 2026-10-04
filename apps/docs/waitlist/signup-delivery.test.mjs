import assert from "node:assert/strict";
import test from "node:test";
import { queueSignupDelivery } from "./mail.mjs";

const subscriberId = "7d52939e-a101-4c93-b9d6-6712349adc34";
const config = Object.freeze({
  signupCheckEnabled: true,
  joinEnabled: false,
  emailEnabled: false,
  smtpCheckEnabled: false,
});

test("verified operator signup schedules only the registered subscriber without opening general email", async () => {
  const store = {};
  let args;
  const delivery = Promise.resolve();
  let deferred;
  queueSignupDelivery(
    { store, config },
    {
      waitUntil: (value) => {
        deferred = value;
      },
    },
    subscriberId,
    (value) => {
      args = value;
      return delivery;
    },
  );
  assert.equal(deferred, delivery);
  await deferred;
  assert.equal(args.store, store);
  assert.equal(args.subscriberId, subscriberId);
  assert.equal(args.config.emailEnabled, true);
  assert.equal(args.config.joinEnabled, false);
  assert.equal(config.emailEnabled, false);
});

test("operator delivery cannot fall back to the unscoped queue with invalid ID or conflicting switches", () => {
  let calls = 0;
  const deliver = () => {
    calls++;
  };
  const context = {
    waitUntil: () => {
      calls++;
    },
  };
  for (const id of [undefined, null, "", "wrong", "' OR 1=1 --"])
    assert.throws(
      () => queueSignupDelivery({ config }, context, id, deliver),
      /invalid_operator/,
    );
  for (const override of [
    { joinEnabled: true },
    { emailEnabled: true },
    { smtpCheckEnabled: true },
  ])
    assert.throws(
      () =>
        queueSignupDelivery(
          { config: { ...config, ...override } },
          context,
          subscriberId,
          deliver,
        ),
      /invalid_operator/,
    );
  assert.equal(calls, 0);
});

test("ordinary signup preserves its configured delivery switch and missing waitUntil schedules nothing", () => {
  const runtime = {
    store: {},
    config: { emailEnabled: false, signupCheckEnabled: false },
  };
  let args;
  let calls = 0;
  const deliver = (value) => {
    args = value;
    calls++;
    return Promise.resolve();
  };
  queueSignupDelivery(runtime, {}, subscriberId, deliver);
  assert.equal(calls, 0);
  queueSignupDelivery(runtime, { waitUntil: () => {} }, subscriberId, deliver);
  assert.equal(calls, 1);
  assert.equal(args, runtime);
  assert.equal(args.config.emailEnabled, false);
});
