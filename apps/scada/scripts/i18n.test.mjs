import test from "node:test";
import assert from "node:assert/strict";
import { t } from "../src/i18n.js";
import { normalizeAppearance, applyAppearance } from "../src/preferences.js";
import { selectAssets } from "../src/model.js";

test("Arabic translates navigation, auth errors and equipment actions without translating identifiers", () => {
  assert.equal(t("Overview", "ar"), "نظرة عامة");
  assert.equal(t("Password", "ar"), "كلمة المرور");
  assert.notEqual(
    t("Passwords do not match.", "ar"),
    "Passwords do not match.",
  );
  assert.equal(t("P-101", "ar"), "P-101");
  assert.equal(t("482916", "ar"), "482916");
  assert.equal(t("operator@example.test", "ar"), "operator@example.test");
  assert.match(
    t("Inspect Intake pump (P-101), Intake, Running", "ar"),
    /P-101/,
  );
  assert.match(t("Stage 4", "ar"), /المرحلة/);
  assert.equal(
    t("Demo verification complete. Welcome, Ada.", "ar"),
    "اكتمل التحقق التجريبي. مرحباً، Ada.",
  );
  assert.equal(t("Overview", "en"), "Overview");
});
test("Arabic defaults to RTL while preserving an explicit layout override", () => {
  const prefs = normalizeAppearance({ language: "ar" });
  assert.equal(prefs.direction, "rtl");
  const root = { dataset: {}, style: { removeProperty() {} } };
  applyAppearance(prefs, root);
  assert.equal(root.lang, "ar");
  assert.equal(root.dir, "rtl");
  assert.equal(
    normalizeAppearance({ language: "ar", direction: "ltr" }).direction,
    "ltr",
  );
  assert.equal(normalizeAppearance({ language: "invalid" }).language, "en");
});
test("asset search finds translated names and preserves original IDs and area filters", () => {
  const searchNames = { "P-101": "مضخة السحب" };
  assert.deepEqual(
    selectAssets({ query: "السحب", searchNames }).map((a) => a.id),
    ["P-101"],
  );
  assert.equal(
    selectAssets({ query: "السحب", area: "Storage", searchNames }).length,
    0,
  );
  assert.equal(
    selectAssets({ query: "PLC-01.FLOW.PV", searchNames })[0].id,
    "P-101",
  );
});
