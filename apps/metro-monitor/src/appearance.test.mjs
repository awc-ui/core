import assert from "node:assert/strict";
import { test } from "node:test";
import { computeTheme } from "@awc-ui/theme";
import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  readAppearance,
  saveAppearance,
} from "./appearance.mjs";

function stubStorage(t, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value,
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
}

test("stored appearance survives reload and rejects damaged preference fields", (t) => {
  const data = new Map();
  stubStorage(t, {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  });
  assert.deepEqual(readAppearance(), DEFAULT_APPEARANCE);
  for (const density of [0, -1, -2, -3, -4]) {
    assert.equal(
      saveAppearance({ primary: "#7C3AED", density, direction: "rtl" }),
      true,
    );
    assert.deepEqual(readAppearance(), {
      primary: "#7c3aed",
      density,
      direction: "rtl",
    });
  }
  data.set(
    APPEARANCE_KEY,
    JSON.stringify({ primary: "red; }", density: -99, direction: "rtl" }),
  );
  assert.deepEqual(readAppearance(), {
    ...DEFAULT_APPEARANCE,
    direction: "rtl",
  });
  data.set(APPEARANCE_KEY, "{broken");
  assert.deepEqual(readAppearance(), DEFAULT_APPEARANCE);
});

test("unavailable browser storage leaves customization usable in memory", (t) => {
  stubStorage(t, {
    getItem() {
      throw new Error("Storage unavailable");
    },
    setItem() {
      throw new Error("Storage unavailable");
    },
  });
  assert.deepEqual(readAppearance(), DEFAULT_APPEARANCE);
  assert.equal(saveAppearance(DEFAULT_APPEARANCE), false);
});

function luminance(hex) {
  const rgb = hex.match(/[\da-f]{2}/gi).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test("custom primary colors retain readable button and container labels in both themes", () => {
  for (const primaryHex of [
    "#7c3aed",
    "#087f8c",
    "#2e7d32",
    "#b64c15",
    "#c42c69",
    "#ffffff",
    "#000000",
  ]) {
    const { roles } = computeTheme({ primaryHex });
    for (const palette of [roles.light, roles.dark]) {
      for (const [background, foreground] of [
        ["primary", "onPrimary"],
        ["primaryContainer", "onPrimaryContainer"],
      ]) {
        const values = [
          luminance(palette[background]),
          luminance(palette[foreground]),
        ];
        assert.ok(
          (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05) >= 4.5,
          primaryHex,
        );
      }
    }
  }
});
