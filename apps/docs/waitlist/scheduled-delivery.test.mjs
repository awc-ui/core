import assert from "node:assert/strict";
import test from "node:test";
import { runScheduledDelivery } from "./scheduled-delivery.mjs";

test("provider and maintenance failures are independent; advertising retention runs even with measurement off", async () => {
  for (const failed of [
    "maintain",
    "maintainAdvertising",
    "advertising",
    "email",
    "smtpCheck",
  ]) {
    const calls = [];
    const operation = (name) => async () => {
      calls.push(name);
      if (name === failed) throw new Error("injected test failure");
    };
    await runScheduledDelivery(
      {
        config: { advertising: null, smtpCheckEnabled: failed === "smtpCheck" },
        store: {
          maintain: operation("maintain"),
          maintainAdvertising: operation("maintainAdvertising"),
        },
      },
      {
        advertising: operation("advertising"),
        email: operation("email"),
        smtpCheck: operation("smtpCheck"),
      },
    );
    assert.deepEqual(calls, [
      "maintain",
      "maintainAdvertising",
      "advertising",
      failed === "smtpCheck" ? "smtpCheck" : "email",
    ]);
  }
});
