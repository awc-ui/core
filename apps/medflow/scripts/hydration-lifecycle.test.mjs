import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { coreRoot } from "./paths.mjs";
import { hydrateRegion } from "../src/feedback.js";

// Uses the repository's existing jsdom dependency; no download or app dependency.
const require = createRequire(
  resolve(coreRoot(), "packages/core/package.json"),
);
const { JSDOM } = require("jsdom");
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function fixture(t) {
  const dom = new JSDOM(
    "<!doctype html><main id='main' aria-busy='false'></main>",
  );
  const previous = {
    document: globalThis.document,
    customElements: globalThis.customElements,
  };
  globalThis.document = dom.window.document;
  globalThis.customElements = dom.window.customElements;
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
    dom.window.close();
  });
  // jsdom has custom-element lifecycle callbacks but does not reflect inert.
  Object.defineProperty(dom.window.HTMLElement.prototype, "inert", {
    get() {
      return this.hasAttribute("inert");
    },
    set(value) {
      this.toggleAttribute("inert", !!value);
    },
    configurable: true,
  });
  class ChartProbe extends dom.window.HTMLElement {
    connects = 0;
    disconnects = 0;
    connectedCallback() {
      this.connects++;
      this.engine = {};
    }
    disconnectedCallback() {
      this.disconnects++;
      this.engine = null;
    }
  }
  customElements.define("md-chart-probe", ChartProbe);
  const region = document.getElementById("main");
  region.innerHTML =
    '<section id="panel"><md-chart-probe></md-chart-probe><input value="Retained note"></section><aside inert>Already inactive</aside>';
  const panel = region.firstElementChild;
  const chart = panel.querySelector("md-chart-probe");
  const aside = region.lastElementChild;
  return { region, panel, chart, aside };
}

test("hydration preserves connected chart instances and the direct layout children", async (t) => {
  const { region, panel, chart, aside } = fixture(t);
  const ready = deferred();
  const called = deferred();
  chart.componentOnReady = () => {
    called.resolve();
    return ready.promise;
  };
  const engine = chart.engine;
  const input = panel.querySelector("input");
  const hydration = hydrateRegion(region, "overview", {
    immediate: true,
    readyRoot: panel,
  });
  // A real readiness barrier, with no artificial delay or timer mocking.
  await called.promise;
  assert.equal(
    region.firstElementChild,
    panel,
    "no wrapper is inserted around layout children",
  );
  assert.equal(chart.parentElement, panel);
  assert.equal(chart.connects, 1);
  assert.equal(
    chart.disconnects,
    0,
    "canvas teardown must not run during hydration",
  );
  assert.equal(chart.engine, engine);
  assert.equal(panel.inert, true);
  assert.equal(region.getAttribute("aria-busy"), "true");
  assert.equal(region.querySelectorAll(":scope > .page-loading").length, 1);
  ready.resolve();
  assert.equal(await hydration, true);
  assert.equal(region.firstElementChild, panel);
  assert.equal(chart.engine, engine);
  assert.equal(chart.disconnects, 0);
  assert.equal(panel.querySelector("input"), input);
  assert.equal(input.value, "Retained note");
  assert.equal(panel.inert, false);
  assert.equal(aside.inert, true, "pre-existing inert state is retained");
  assert.equal(region.getAttribute("aria-busy"), "false");
  assert.equal(region.hasAttribute("data-hydrating"), false);
  assert.equal(region.querySelector(".page-loading"), null);
});

test("an older hydration cannot reveal or clean up a newer pending hydration", async (t) => {
  const { region, panel, chart } = fixture(t);
  const firstReady = deferred(),
    firstCalled = deferred();
  chart.componentOnReady = () => {
    firstCalled.resolve();
    return firstReady.promise;
  };
  const first = hydrateRegion(region, "overview", {
    immediate: true,
    readyRoot: panel,
  });
  await firstCalled.promise;
  const firstSkeleton = region.querySelector(".page-loading");

  const secondReady = deferred(),
    secondCalled = deferred();
  chart.componentOnReady = () => {
    secondCalled.resolve();
    return secondReady.promise;
  };
  const second = hydrateRegion(region, "overview", {
    immediate: true,
    readyRoot: panel,
  });
  await secondCalled.promise;
  const secondSkeleton = region.querySelector(".page-loading");
  assert.notEqual(secondSkeleton, firstSkeleton);
  assert.equal(firstSkeleton.isConnected, false);
  assert.equal(region.querySelectorAll(".page-loading").length, 1);

  firstReady.resolve();
  assert.equal(
    await first,
    false,
    "superseded work cannot report current readiness",
  );
  assert.equal(panel.inert, true);
  assert.equal(region.getAttribute("aria-busy"), "true");
  assert.equal(region.hasAttribute("data-hydrating"), true);
  assert.equal(region.querySelector(".page-loading"), secondSkeleton);
  assert.equal(chart.disconnects, 0);

  secondReady.resolve();
  assert.equal(await second, true);
  assert.equal(panel.inert, false);
  assert.equal(region.getAttribute("aria-busy"), "false");
  assert.equal(region.hasAttribute("data-hydrating"), false);
  assert.equal(region.querySelector(".page-loading"), null);
});
