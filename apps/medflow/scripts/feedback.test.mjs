import test from "node:test";
import assert from "node:assert/strict";
import {
  runAction,
  waitForComponents,
  skeletonMarkup,
} from "../src/feedback.js";
import { setLanguage } from "../src/i18n.js";

class Element {
  constructor(localName, text = "") {
    this.localName = localName;
    this.attributes = new Map();
    this.childNodes = text ? [{ nodeType: 3, textContent: text }] : [];
    this.loading = false;
    this.softDisabled = false;
  }
  matches(selector) {
    return selector.split(",").includes(this.localName);
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
  append(child) {
    child.parent = this;
    this.childNodes.push(child);
  }
  remove() {
    if (this.parent)
      this.parent.childNodes = this.parent.childNodes.filter(
        (child) => child !== this,
      );
  }
  querySelector() {
    return this.childNodes.find((child) => child.localName === "md-button");
  }
}
const installDOM = () => {
  globalThis.document = { createElement: (name) => new Element(name) };
  setLanguage("en");
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test("pending form action blocks duplicate submits and restores button state only after completion", async () => {
  installDOM();
  const form = new Element("form"),
    button = new Element("md-button", "Save case");
  form.append(button);
  button.setAttribute("aria-label", "Save this case");
  const work = deferred();
  let runs = 0;
  const first = runAction(form, "Updating case view…", () => {
    runs++;
    return work.promise;
  });
  assert.equal(form.getAttribute("aria-busy"), "true");
  assert.equal(button.loading, true);
  assert.equal(button.getAttribute("aria-label"), "Updating case view…");
  assert.equal(button.childNodes[0].textContent, "Updating case view…");
  assert.equal(button.childNodes[1].localName, "md-progress-indicator");
  assert.deepEqual(
    await runAction(form, "Updating case view…", () => {
      runs++;
    }),
    { started: false },
  );
  assert.equal(runs, 1);
  work.resolve("saved");
  assert.deepEqual(await first, { started: true, value: "saved" });
  assert.equal(button.loading, false);
  assert.equal(form.getAttribute("aria-busy"), null);
  assert.equal(button.getAttribute("aria-label"), "Save this case");
  assert.equal(button.childNodes[0].textContent, "Save case");
  assert.equal(button.childNodes.length, 1);
});

test("sync and async errors clean up and allow a retry without changing its error", async () => {
  installDOM();
  const button = new Element("md-button", "Export");
  const failure = new Error("failed");
  await assert.rejects(
    runAction(button, "Preparing export…", () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(button.loading, false);
  assert.equal(button.getAttribute("aria-busy"), null);
  await assert.rejects(
    runAction(button, "Preparing export…", () => Promise.reject(failure)),
    (error) => error === failure,
  );
  assert.deepEqual(await runAction(button, "Preparing export…", () => 42), {
    started: true,
    value: 42,
  });
  assert.equal(button.childNodes.length, 1);
});

test("icon actions use the native slot and soft-disabled state and restore both", async () => {
  installDOM();
  const button = new Element("md-icon-button");
  button.setAttribute("aria-label", "Assign");
  const work = deferred();
  const action = runAction(button, "Opening assignment…", () => work.promise);
  assert.equal(button.softDisabled, true);
  assert.equal(button.childNodes[0].getAttribute("slot"), null);
  work.resolve();
  await action;
  assert.equal(button.softDisabled, false);
  assert.equal(button.childNodes.length, 0);
  assert.equal(button.getAttribute("aria-label"), "Assign");
});

test("action labels and skeleton announcements use the current language", async () => {
  installDOM();
  setLanguage("ar");
  const button = new Element("md-button", "تصدير");
  const work = deferred();
  const action = runAction(button, "Preparing export…", () => work.promise);
  assert.equal(button.getAttribute("aria-label"), "جارٍ تجهيز التصدير…");
  const html = skeletonMarkup("overview");
  assert.match(html, /جارٍ تحميل محتوى مساحة العمل/);
  assert.equal((html.match(/aria-label=/g) || []).length, 1);
  assert.match(skeletonMarkup("signup"), /loading-auth/);
  work.resolve();
  await action;
  setLanguage("en");
});

test("readiness waits for definitions and real component hydration", async () => {
  const definition = deferred(),
    hydration = deferred();
  let initialized = false;
  const el = {
    localName: "md-card",
    componentOnReady() {
      initialized = true;
      return hydration.promise;
    },
  };
  const root = {
    localName: "main",
    querySelectorAll: () => [el, { localName: "div" }],
  };
  let completed = false;
  const wait = waitForComponents(root, {
    registry: { whenDefined: () => definition.promise },
    timeoutMs: 1000,
  }).then(() => {
    completed = true;
  });
  await Promise.resolve();
  assert.equal(initialized, false);
  definition.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(initialized, true);
  assert.equal(completed, false);
  hydration.resolve();
  await wait;
  assert.equal(completed, true);
});

test("failed or stalled components reject so callers can remove skeletons", async () => {
  const root = {
    localName: "main",
    querySelectorAll: () => [{ localName: "md-card" }],
  };
  await assert.rejects(
    waitForComponents(root, {
      registry: {
        whenDefined: () => Promise.reject(new Error("component failed")),
      },
    }),
    /component failed/,
  );
  await assert.rejects(
    waitForComponents(root, {
      registry: { whenDefined: () => new Promise(() => {}) },
      timeoutMs: 5,
    }),
    /could not finish loading/,
  );
});
