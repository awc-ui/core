import assert from "node:assert/strict";
import { test } from "node:test";
import { arabic } from "./ar.mjs";
import {
  stations,
  incidentFixture,
  lines,
  selectStations,
  toCSV,
} from "./model.mjs";
import { DemoAuth, DEMO_EMAIL, DEMO_PASSWORD } from "./auth.mjs";
import { APPEARANCE_KEY } from "./appearance.mjs";
import {
  LANGUAGE_KEY,
  countLabel,
  getLanguage,
  localizedMessage,
  normalizeDigits,
  readLanguage,
  setLanguage,
  subscribeLanguage,
  translateText,
} from "./i18n.mjs";

const ar = (key, params = {}) => translateText(key, params, "ar");
test("Arabic catalog covers fixtures and keeps interpolation tokens intact", () => {
  for (const key of [
    ...stations.map((s) => s.name),
    ...lines.map((l) => l.name),
    ...incidentFixture.flatMap((i) => [i.title, i.detail]),
  ]) {
    assert.match(ar(key), /[\u0600-\u06ff]/u, key);
  }
  for (const [key, value] of Object.entries(arabic)) {
    assert.deepEqual(
      (value.match(/\{\w+\}|%\w+%/g) || []).sort(),
      (key.match(/\{\w+\}|%\w+%/g) || []).sort(),
      key,
    );
  }
  assert.equal(
    ar("View {station}", { station: ar("Westgate") }),
    "عرض البوابة الغربية",
  );
  assert.equal(translateText("Sign in", {}, "en"), "Sign in");
});

test("Arabic and English station search resolve the same canonical station and CSV preserves IDs", () => {
  const translated = selectStations(stations, {
    query: ar("Botanical garden"),
    localize: ar,
    locale: "ar",
  });
  const english = selectStations(stations, {
    query: "Botanical garden",
    localize: ar,
    locale: "ar",
  });
  assert.deepEqual(
    translated.map((s) => s.id),
    ["ST12"],
  );
  assert.deepEqual(translated, english);
  assert.equal(translated[0].name, "Botanical garden");
  const csv = toCSV(translated, ar);
  assert.ok(csv.includes(ar("Station")));
  assert.ok(csv.includes(ar("Botanical garden")));
  assert.ok(csv.includes('"ST12"'));
  assert.ok(csv.includes('"M3"'));
});

test("Arabic and Persian verification digits normalize without changing demo authentication", async () => {
  for (const input of ["٢٤٦٨١٠", "۲۴۶۸۱۰", "2٤۶8١0"]) {
    const auth = new DemoAuth();
    await auth.signin(DEMO_EMAIL, DEMO_PASSWORD);
    assert.equal(auth.verify(normalizeDigits(input)).email, DEMO_EMAIL);
  }
  assert.equal(normalizeDigits("METR2026"), "METR2026");
});

test("language changes persist, update direction and preserve density", (context) => {
  const values = new Map([
    [
      APPEARANCE_KEY,
      JSON.stringify({ primary: "#3658cf", density: -3, direction: "ltr" }),
    ],
  ]);
  for (const [name, value] of Object.entries({
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    document: {
      documentElement: { dataset: {}, lang: "en", dir: "ltr" },
      getElementById: () => null,
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    context.after(() =>
      previous
        ? Object.defineProperty(globalThis, name, previous)
        : delete globalThis[name],
    );
  }
  let changes = 0;
  const unsubscribe = subscribeLanguage(() => changes++);
  setLanguage("ar");
  assert.equal(readLanguage(), "ar");
  assert.equal(getLanguage(), "ar");
  assert.equal(document.documentElement.lang, "ar");
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(JSON.parse(values.get(APPEARANCE_KEY)).density, -3);
  assert.equal(countLabel(2, "stations"), "محطتان");
  assert.match(countLabel(6, "stations"), /محطات$/);
  assert.match(countLabel(15, "stations"), /محطة$/);
  assert.ok(
    !localizedMessage("Too many attempts. Try again in 12 seconds.").includes(
      "Too many",
    ),
  );
  setLanguage("en");
  assert.equal(document.documentElement.dir, "ltr");
  assert.equal(values.get(LANGUAGE_KEY), "en");
  assert.equal(changes, 2);
  unsubscribe();
});
