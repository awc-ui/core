import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  readAppearance,
  saveAppearance,
  applyAppearance,
} from "../src/preferences.js";
const storageFor = (data = {}) => {
  const entries = new Map(Object.entries(data));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
};
const rootFor = () => {
  const tokens = new Map();
  return {
    dataset: {},
    dir: "ltr",
    style: {
      setProperty: (k, v) => tokens.set(k, v),
      removeProperty: (k) => tokens.delete(k),
    },
    removeAttribute(name) {
      if (name === "data-density") delete this.dataset.density;
    },
    tokens,
  };
};
test("appearance preferences validate persisted input and preserve unrelated storage", () => {
  assert.deepEqual(
    normalizeAppearance({
      theme: "bogus",
      density: "-9",
      direction: "sideways",
      primary: "red; display:none",
    }),
    DEFAULT_APPEARANCE,
  );
  const storage = storageFor({ "other.app": "keep" });
  const prefs = {
    theme: "light",
    language: "en",
    density: "-4",
    direction: "rtl",
    primary: "#166bd9",
  };
  saveAppearance(prefs, storage);
  assert.deepEqual(readAppearance(storage), { ...prefs, primary: "#166BD9" });
  saveAppearance(DEFAULT_APPEARANCE, storage);
  assert.deepEqual(readAppearance(storage), DEFAULT_APPEARANCE);
  assert.equal(storage.getItem("other.app"), "keep");
  assert.deepEqual(
    readAppearance({
      getItem() {
        throw new Error("Blocked storage");
      },
    }),
    DEFAULT_APPEARANCE,
  );
});
test("primary color uses distinct light/dark role maps and reset restores CSS defaults", () => {
  const root = rootFor();
  root.style.setProperty("--unrelated", "keep");
  const prefs = {
    theme: "light",
    language: "en",
    density: "0",
    direction: "rtl",
    primary: "#166BD9",
  };
  applyAppearance(prefs, root);
  assert.equal(root.dataset.density, undefined);
  assert.equal(root.dir, "rtl");
  const light = root.tokens.get("--md-sys-color-primary");
  assert.match(light, /^#[0-9A-F]{6}$/);
  assert(root.tokens.has("--md-sys-color-on-primary"));
  assert(root.tokens.has("--md-sys-color-surface-container"));
  applyAppearance({ ...prefs, theme: "dark", density: "-3" }, root);
  assert.notEqual(root.tokens.get("--md-sys-color-primary"), light);
  assert.equal(root.dataset.density, "-3");
  applyAppearance(DEFAULT_APPEARANCE, root);
  assert.equal(root.dir, "ltr");
  assert.equal(root.dataset.density, "-1");
  assert.deepEqual([...root.tokens], [["--unrelated", "keep"]]);
});
test("preboot restores RTL, light theme, and default density before app render", () => {
  const root = rootFor();
  root.dataset.density = "-1";
  const storage = storageFor({
    "sentinel.theme": "light",
    "sentinel.density": "0",
    "sentinel.direction": "rtl",
  });
  vm.runInNewContext(
    readFileSync(new URL("../src/preboot.js", import.meta.url), "utf8"),
    { document: { documentElement: root }, localStorage: storage },
  );
  assert.deepEqual(root.dataset, { theme: "light" });
  assert.equal(root.dir, "rtl");
});
