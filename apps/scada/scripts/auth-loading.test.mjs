import test from "node:test";
import assert from "node:assert/strict";
import { wireAuth } from "../src/auth.js";
import { createActionRunner } from "../src/loading.js";
import { DEMO_CODE, checkChallenge } from "../src/model.js";

class Control {
  constructor(localName, name = "", value = "") {
    Object.assign(this, {
      localName,
      name,
      value,
      disabled: false,
      loading: false,
      isConnected: true,
      textContent: "",
    });
    this.attributes = new Map();
    this.listeners = new Map();
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }
  querySelectorAll() {
    return [];
  }
}

function fixture(context) {
  const code = new Control("md-otp-field", "code", DEMO_CODE);
  const button = new Control("md-button");
  const recoveryLink = new Control("md-button");
  const unavailable = new Control("md-button");
  unavailable.disabled = true;
  const form = new Control("form");
  form.controls = [code, button, recoveryLink, unavailable];
  form.querySelectorAll = () => form.controls;
  form.querySelector = (selector) =>
    selector === "md-otp-field"
      ? code
      : selector === 'md-button[type="submit"]'
        ? button
        : null;
  const error = new Control("p");
  const document = {
    documentElement: { lang: "en" },
    querySelector: (selector) =>
      selector === "#mfa-form"
        ? form
        : selector === "#auth-error"
          ? error
          : null,
    querySelectorAll: () => [code],
  };

  // Model successful form controls: disabling an OTP removes it from any
  // subsequent FormData snapshot, just as with the form-associated component.
  const snapshots = [];
  class CapturedFormData {
    constructor(source) {
      this.values = new Map(
        source.controls
          .filter((control) => control.name && !control.disabled)
          .map((control) => [control.name, control.value]),
      );
      snapshots.push(this.values);
    }
    get(name) {
      return this.values.get(name) ?? null;
    }
    [Symbol.iterator]() {
      return this.values[Symbol.iterator]();
    }
  }
  const originalGlobals = new Map(
    ["document", "FormData"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  for (const [name, value] of Object.entries({
    document,
    FormData: CapturedFormData,
  })) {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }

  let waitCount = 0;
  const releases = [];
  const operations = [];
  const errors = [];
  const completed = [];
  const state = {
    pending: {
      name: "Ada Operator",
      email: "ada@example.test",
      expiresAt: Date.now() + 300_000,
      attempts: 0,
    },
  };
  const runAction = createActionRunner({
    wait: () => {
      waitCount++;
      return new Promise((resolve) => releases.push(resolve));
    },
    onError: (error) => errors.push(error),
  });
  const track = (operation) => {
    operations.push(operation);
    return operation;
  };
  const release = () => {
    assert.ok(releases.length, "an operation should be waiting");
    releases.shift()();
  };
  context.after(async () => {
    // Settle even a failing test's pending callback before restoring globals.
    form.isConnected = false;
    for (const resolve of releases.splice(0)) resolve();
    await Promise.allSettled(operations);
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  wireAuth(state, {
    navigate: () => assert.fail("MFA should complete, not navigate directly"),
    complete: (profile) => completed.push(profile),
    runAction,
  });
  const submit = () => {
    const event = {
      currentTarget: form,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    const operation = form.listeners.get("submit")(event);
    // DOM currentTarget is only available during synchronous dispatch.
    event.currentTarget = null;
    assert.equal(event.defaultPrevented, true);
    return track(operation);
  };
  return {
    state,
    form,
    code,
    button,
    recoveryLink,
    unavailable,
    error,
    snapshots,
    completed,
    errors,
    runAction,
    track,
    submit,
    release,
    get waitCount() {
      return waitCount;
    },
  };
}

test(
  "MFA snapshots the code before disabling fields and completes only once for duplicate submits",
  { concurrency: false },
  async (context) => {
    const f = fixture(context);
    const first = f.submit();
    assert.equal(f.snapshots[0].get("code"), DEMO_CODE);
    assert.equal(f.code.disabled, true);
    assert.equal(f.button.loading, true);
    assert.equal(f.form.getAttribute("aria-busy"), "true");
    assert.equal(f.recoveryLink.disabled, true);

    const duplicate = f.submit();
    await duplicate;
    assert.equal(
      f.snapshots.length,
      1,
      "duplicate submits must not read now-disabled fields",
    );
    assert.equal(f.waitCount, 1);
    // A later DOM value must not replace the already-submitted code.
    f.code.value = "000000";
    f.release();
    await first;

    assert.deepEqual(f.completed, [
      {
        name: "Ada Operator",
        email: "ada@example.test",
        demo: true,
        mfaVerified: true,
      },
    ]);
    assert.equal(f.state.pending.attempts, 0);
    assert.equal(f.code.disabled, false);
    assert.equal(f.button.loading, false);
    assert.equal(f.recoveryLink.disabled, false);
    assert.equal(f.unavailable.disabled, true);
    assert.equal(f.form.getAttribute("aria-busy"), null);
    assert.deepEqual(f.errors, []);
  },
);

test(
  "MFA shares the recovery verification lock and accepts a retry after recovery finishes",
  { concurrency: false },
  async (context) => {
    const f = fixture(context);
    const recoveryButton = new Control("md-button");
    let recoveryChecks = 0;
    // The app's recovery handler uses this same runner key. Holding it first
    // catches a regression where wireAuth changes to an independent MFA key.
    const recovery = f.track(
      f.runAction(
        "verification",
        recoveryButton,
        "Verifying recovery code…",
        () => {
          recoveryChecks++;
          assert.equal(
            checkChallenge(f.state.pending, "INVALID1", true).ok,
            false,
          );
          f.state.pending.attempts++;
        },
      ),
    );
    await f.submit();
    assert.equal(f.waitCount, 1);
    assert.equal(f.completed.length, 0);
    assert.equal(f.state.pending.attempts, 0);
    f.release();
    await recovery;
    assert.equal(recoveryChecks, 1);
    assert.equal(f.state.pending.attempts, 1);

    const retry = f.submit();
    assert.equal(f.waitCount, 2);
    f.release();
    await retry;
    assert.equal(f.completed.length, 1);
    assert.equal(f.state.pending.attempts, 1);
    assert.deepEqual(f.errors, []);
  },
);

test(
  "MFA discards a pending result when its challenge has been replaced",
  { concurrency: false },
  async (context) => {
    const f = fixture(context);
    const originalChallenge = f.state.pending;
    const operation = f.submit();
    f.state.pending = {
      ...originalChallenge,
      name: "New Operator",
      email: "new@example.test",
    };
    f.release();
    await operation;

    assert.equal(f.completed.length, 0);
    assert.equal(originalChallenge.attempts, 0);
    assert.equal(f.state.pending.email, "new@example.test");
    assert.equal(f.code.disabled, false);
    assert.equal(f.button.loading, false);
    assert.equal(f.form.getAttribute("aria-busy"), null);
    assert.equal(f.error.textContent, "");
    assert.deepEqual(f.errors, []);
  },
);
