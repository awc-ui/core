import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  t,
  setLanguage,
  getLanguage,
  locale,
  normalizeDigits,
} from "../src/i18n.js";
import { select, casesView, detailsView, tableRows } from "../src/views.js";
import { createInitialState, assignCases, createCase } from "../src/model.js";
import { createChallenge, checkChallenge } from "../src/auth.js";

test("language only changes display labels, leaving selectable domain values and records intact", () => {
  const data = createInitialState();
  const before = structuredClone(data);
  setLanguage("ar");
  const options = select(
    "department",
    "Department",
    ["Emergency", "Cardiology"],
    "Emergency",
  );
  assert.match(options, /value="Emergency"/);
  assert.match(options, /label="الطوارئ"/);
  assert.equal(locale(), "ar-EG");
  const state = {
    data,
    filters: { query: "", department: "Emergency", status: "all" },
    queue: "unassigned",
    selected: new Set(),
  };
  assert.match(casesView(state, true), /إسناد الرعاية المناسبة/);
  const chosen = data.cases.find((c) => !c.assigneeId);
  const assigned = assignCases(data, [chosen.id], "cl-01");
  assert.equal(
    assigned.cases.find((c) => c.id === chosen.id).assigneeId,
    "cl-01",
  );
  assert.deepEqual(data, before);
  setLanguage("en");
  assert.match(casesView(state, true), /The right care, assigned/);
});

test("Arabic generated activity text translates domain terms and preserves patient identifiers", () => {
  setLanguage("ar");
  assert.equal(
    t("Olivia James · Emergency · CASE-1032"),
    "Olivia James · الطوارئ · CASE-1032",
  );
  assert.equal(t("Status: Awaiting review"), "الحالة: بانتظار المراجعة");
  assert.equal(t("3 cases assigned"), "عدد الحالات المسندة: ٣");
  assert.equal(
    t("Admitted to Cardiology · C-204"),
    "تم الإدخال إلى قسم القلب · C-204",
  );
  setLanguage("en");
  assert.equal(t("3 cases assigned"), "3 cases assigned");
});

test("localized details escape identifiers and preserve entered Arabic notes verbatim", () => {
  setLanguage("ar");
  const data = createInitialState();
  const item = data.cases[0];
  item.patient = "<img src=x onerror=alert(1)>";
  item.notes.push({
    id: "user-note",
    author: "منسق",
    at: "2026-09-07T10:00:00Z",
    text: "ملاحظة جديدة <script>alert(1)</script>",
  });
  const html = detailsView({ data }, item.id);
  assert.doesNotMatch(html, /<img src=x|<script>/);
  assert.match(html, /ملاحظة جديدة &lt;script&gt;/);
  setLanguage("en");
});

test("entered summaries stay verbatim even when they contain translated status words", () => {
  const summary = "New · follow-up requested by family";
  const data = createCase(createInitialState(), {
    patient: "مريض تجريبي",
    age: 32,
    department: "Emergency",
    priority: "Routine",
    summary,
  });
  const item = data.cases.find((record) => record.patient === "مريض تجريبي");
  for (const language of ["ar", "en"]) {
    setLanguage(language);
    assert.match(
      detailsView({ data }, item.id),
      /New · follow-up requested by family/,
    );
    assert.match(
      tableRows([item], new Set()),
      /New · follow-up requested by family/,
    );
    assert.equal(item.summary, summary);
  }
});

test("Arabic and Persian verification digits normalize without relaxing challenge validation", () => {
  assert.equal(normalizeDigits("٢٤٦٨١٠"), "246810");
  assert.equal(normalizeDigits("۲۴۶۸۱۰"), "246810");
  const challenge = createChallenge(
    { name: "فاطمة", email: "demo@example.test" },
    1000,
  );
  assert.equal(
    checkChallenge(challenge, normalizeDigits("٢٤٦٨١٠"), { now: 1100 }).ok,
    true,
  );
  assert.equal(
    checkChallenge(challenge, normalizeDigits("٢٤٦٨١١"), { now: 1100 }).ok,
    false,
  );
  assert.equal(
    checkChallenge(challenge, normalizeDigits("٢٤٦٨١٠"), { now: 301000 }).ok,
    false,
  );
});

test("preboot restores Arabic direction before paint and keeps an explicit direction override", () => {
  const script = readFileSync(
    new URL("../src/preboot.js", import.meta.url),
    "utf8",
  );
  const boot = (values) => {
    const root = { dataset: {}, lang: "en", dir: "ltr" };
    runInNewContext(script, {
      document: { documentElement: root },
      localStorage: { getItem: (key) => values[key] ?? null },
      matchMedia: () => ({ matches: false }),
    });
    return root;
  };
  assert.equal(boot({ "medflow-language": "ar" }).dir, "rtl");
  assert.equal(boot({ "medflow-language": "ar" }).lang, "ar");
  assert.equal(
    boot({ "medflow-language": "ar", "medflow-direction": "ltr" }).dir,
    "ltr",
  );
  assert.equal(boot({ "medflow-language": "invalid" }).lang, "en");
  setLanguage("invalid");
  assert.equal(getLanguage(), "en");
});
