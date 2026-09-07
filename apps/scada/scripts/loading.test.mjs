import test from "node:test";
import assert from "node:assert/strict";
import { createActionRunner } from "../src/loading.js";

function fixture() {
  const attributes = new Map();
  const button = {
    localName: "md-button",
    loading: false,
    disabled: false,
    getAttribute: (key) => attributes.get(key) ?? null,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key),
  };
  const input = { disabled: false };
  const locked = { disabled: true };
  const scopeAttributes = new Map();
  const scope = {
    isConnected: true,
    querySelectorAll: () => [button, input, locked],
    getAttribute: (key) => scopeAttributes.get(key) ?? null,
    setAttribute: (key, value) => scopeAttributes.set(key, value),
    removeAttribute: (key) => scopeAttributes.delete(key),
  };
  let resolve;
  const wait = () =>
    new Promise((done) => {
      resolve = done;
    });
  return { button, input, locked, scope, wait, finish: () => resolve() };
}

test("pending actions prevent duplicate submissions and restore existing control state", async () => {
  const f = fixture();
  const statuses = [];
  const run = createActionRunner({
    wait: f.wait,
    onStatus: (text) => statuses.push(text),
  });
  let calls = 0;
  const first = run("verify", f.button, "Verifying…", () => calls++, {
    scope: f.scope,
  });
  assert.equal(f.button.loading, true);
  assert.equal(f.button.disabled, false, "initiating control retains focus");
  assert.equal(f.input.disabled, true);
  assert.equal(f.scope.getAttribute("aria-busy"), "true");
  assert.equal(f.button.getAttribute("aria-label"), "Verifying…");
  assert.equal(
    await run("verify", f.button, "Verifying…", () => calls++),
    false,
  );
  assert.equal(calls, 0);
  f.finish();
  assert.equal(await first, true);
  assert.equal(calls, 1);
  assert.equal(f.button.loading, false);
  assert.equal(f.input.disabled, false);
  assert.equal(f.locked.disabled, true);
  assert.equal(f.scope.getAttribute("aria-busy"), null);
  assert.equal(f.button.getAttribute("aria-label"), null);
  assert.deepEqual(statuses, ["Verifying…", ""]);
});

test("failed work releases its lock, restores controls, and permits retry", async () => {
  const f = fixture();
  const errors = [];
  const run = createActionRunner({
    wait: async () => {},
    onError: (error) => errors.push(error.message),
  });
  f.button.setAttribute("aria-label", "Export snapshot");
  const success = await run(
    "export",
    f.button,
    "Preparing…",
    () => {
      throw Error("Failed");
    },
    { scope: f.scope },
  );
  assert.equal(success, false);
  assert.deepEqual(errors, ["Failed"]);
  assert.equal(f.button.loading, false);
  assert.equal(f.input.disabled, false);
  assert.equal(f.button.getAttribute("aria-label"), "Export snapshot");
  assert.equal(
    await run("export", f.button, "Preparing…", () => {}, { scope: f.scope }),
    true,
  );
});

test("navigation or dismissed scopes cancel pending work without stale side effects", async () => {
  for (const cancellation of ["detached", "dismissed"]) {
    const f = fixture();
    let current = true;
    const run = createActionRunner({ wait: f.wait });
    let calls = 0;
    const task = run("acknowledge", f.button, "Acknowledging…", () => calls++, {
      scope: f.scope,
      isCurrent: () => current,
    });
    if (cancellation === "detached") f.scope.isConnected = false;
    else current = false;
    f.finish();
    assert.equal(await task, false);
    assert.equal(calls, 0);
    assert.equal(f.button.loading, false);
    assert.equal(f.input.disabled, false);
    assert.equal(f.scope.getAttribute("aria-busy"), null);
  }
});

test("a rejected loading phase also restores the action without invoking work", async () => {
  const f = fixture();
  let calls = 0;
  let errors = 0;
  const run = createActionRunner({
    wait: async () => {
      throw Error("Offline");
    },
    onError: () => errors++,
  });
  assert.equal(
    await run("export", f.button, "Preparing…", () => calls++, {
      scope: f.scope,
    }),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(errors, 1);
  assert.equal(f.button.loading, false);
  assert.equal(f.input.disabled, false);
});
