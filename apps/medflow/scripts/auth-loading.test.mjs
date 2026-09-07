import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_CODE,
  RECOVERY_CODE,
  createChallenge,
  wireAuth,
} from "../src/auth.js";
import { setLanguage } from "../src/i18n.js";

const originalDocument = globalThis.document;
const originalFormData = globalThis.FormData;

test.afterEach(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  globalThis.FormData = originalFormData;
  setLanguage("en");
});

// These nodes expose the DOM surface consumed by auth and the real runAction.
// Browser component rendering is intentionally left to the integration pass.
function element(localName) {
  const attributes = new Map();
  return {
    localName,
    childNodes: [],
    parentNode: null,
    isConnected: true,
    attributeWrites: [],
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      this.attributeWrites.push([name, String(value)]);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    matches(selector) {
      return selector.split(",").includes(this.localName);
    },
    append(node) {
      node.parentNode = this;
      this.childNodes.push(node);
    },
    remove() {
      if (!this.parentNode) return;
      const siblings = this.parentNode.childNodes;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentNode = null;
    },
  };
}

function mountForm(id, data, state, callbacks) {
  const listeners = new Map();
  const form = element("form");
  const button = element("md-button");
  const caption = { nodeType: 3, textContent: "Continue" };
  const alert = { textContent: "" };
  const control = { localName: "md-text-field", setFocus() {} };
  button.loading = false;
  button.append(caption);
  Object.assign(form, {
    id,
    data,
    resets: 0,
    reads: 0,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    querySelector(selector) {
      if (selector === 'md-button[type="submit"]') return button;
      if (selector === "#auth-error") return alert;
      return control;
    },
    reset() {
      this.resets++;
      this.data = {};
    },
    submit() {
      return listeners.get("submit")({
        preventDefault() {},
        currentTarget: this,
      });
    },
  });
  globalThis.document = {
    documentElement: { lang: "en" },
    createElement: element,
    querySelector: (selector) => (selector === `#${id}` ? form : null),
    querySelectorAll: () => [],
  };
  globalThis.FormData = class extends Map {
    constructor(target) {
      super(Object.entries(target.data));
      target.reads++;
    }
  };
  setLanguage("en");
  wireAuth(state, callbacks);
  return { form, button, caption, alert, control };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function assertBusy({ form, button, caption }, label) {
  assert.equal(form.getAttribute("aria-busy"), "true");
  assert.equal(button.loading, true);
  assert.equal(caption.textContent, label);
  const indicator = button.childNodes.find(
    (node) => node.localName === "md-progress-indicator",
  );
  assert.ok(indicator, "the real feedback helper mounts an AWC indicator");
  assert.equal(indicator.getAttribute("slot"), "loader");
  assert.equal(indicator.getAttribute("label"), label);
}

function assertIdle({ form, button, caption }) {
  assert.equal(form.getAttribute("aria-busy"), null);
  assert.equal(button.loading, false);
  assert.equal(button.getAttribute("aria-label"), null);
  assert.equal(caption.textContent, "Continue");
  assert.equal(button.childNodes.length, 1, "the loader was removed");
}

const loginData = () => ({ email: DEMO_EMAIL, password: DEMO_PASSWORD });

test("login stays busy until readiness resolves and ignores duplicate submissions", async () => {
  const ready = deferred();
  const destinations = [];
  const state = {};
  const fixture = mountForm("login-form", loginData(), state, {
    navigate(route) {
      destinations.push(route);
      return ready.promise;
    },
    toast() {},
    complete() {
      assert.fail("login must require MFA before opening the workspace");
    },
  });
  const first = fixture.form.submit();
  assertBusy(fixture, "Opening verification…");
  const challenge = state.auth.pending;
  await fixture.form.submit();
  assert.deepEqual(destinations, ["mfa"]);
  assert.equal(fixture.form.reads, 1);
  assert.equal(fixture.form.resets, 1);
  assert.equal(state.auth.pending, challenge);
  assert.equal(state.auth.profile, null);
  assertBusy(fixture, "Opening verification…");
  ready.resolve();
  await first;
  assertIdle(fixture);
});

for (const recovery of [false, true]) {
  const method = recovery ? "recovery" : "MFA";
  test(`${method} ignores duplicate submissions while workspace readiness is pending`, async () => {
    const ready = deferred();
    const completed = [];
    const state = {
      auth: {
        pending: createChallenge({
          name: "Sample",
          email: "care@example.test",
        }),
        recoveryUsed: false,
      },
    };
    const fixture = mountForm(
      recovery ? "recovery-form" : "mfa-form",
      { code: recovery ? RECOVERY_CODE : DEMO_CODE },
      state,
      {
        navigate() {
          assert.fail("a duplicate verification must not redirect to login");
        },
        toast() {},
        complete(profile) {
          completed.push(profile);
          return ready.promise;
        },
      },
    );
    const first = fixture.form.submit();
    assertBusy(fixture, "Opening workspace…");
    await fixture.form.submit();
    assert.equal(completed.length, 1);
    assert.equal(fixture.form.reads, 1);
    assert.equal(fixture.form.resets, 1);
    assert.equal(state.auth.profile, completed[0]);
    assert.equal(state.auth.profile.mfaVerified, true);
    assert.equal(state.auth.pending, null);
    assert.equal(state.auth.recoveryUsed, recovery);
    assertBusy(fixture, "Opening workspace…");
    ready.resolve();
    await first;
    assertIdle(fixture);
  });
}

test("invalid credentials show validation without entering action busy state", async () => {
  const fixture = mountForm(
    "login-form",
    { ...loginData(), password: "incorrect" },
    {},
    {
      navigate() {
        assert.fail("invalid credentials must not navigate");
      },
      toast() {},
      complete() {
        assert.fail("invalid credentials must not complete authentication");
      },
    },
  );
  await fixture.form.submit();
  assert.equal(fixture.control.error, true);
  assert.match(fixture.control.errorText, /sample credentials/);
  assert.deepEqual(fixture.form.attributeWrites, []);
  assert.equal(fixture.form.resets, 0);
  assertIdle(fixture);
});

test("rejected readiness removes loading feedback and unlocks a subsequent attempt", async () => {
  let ready = deferred();
  let navigations = 0;
  const fixture = mountForm(
    "login-form",
    loginData(),
    {},
    {
      navigate() {
        navigations++;
        return ready.promise;
      },
      toast() {},
      complete() {},
    },
  );
  const first = fixture.form.submit();
  assertBusy(fixture, "Opening verification…");
  ready.reject(new Error("Component readiness failed"));
  await first;
  assertIdle(fixture);
  assert.equal(
    fixture.alert.textContent,
    "Unable to open this screen. Please try again.",
  );

  ready = deferred();
  fixture.form.data = loginData();
  const retry = fixture.form.submit();
  assert.equal(navigations, 2, "the failed attempt released the submit guard");
  assertBusy(fixture, "Opening verification…");
  ready.resolve();
  await retry;
  assertIdle(fixture);
});
