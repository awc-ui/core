import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import ts from "typescript";
import { readAdvertisingMeasurement } from "./advertising.mjs";

const VERSION = "advertising-2026-10-07-v2";
const CHOICE = "awc:advertising:choice";
const REVOKE = "awc:advertising:revoke:";
const oldToken = "A".repeat(43);
const day = 86400_000;
const source = readFileSync(new URL("../src/scripts/advertising-consent.ts", import.meta.url), "utf8");
const controller = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const astroRequire = createRequire(realpathSync(new URL("../node_modules/astro/package.json", import.meta.url)));
const { parse, transform } = await import(astroRequire.resolve("@astrojs/compiler-rs"));
const { experimental_AstroContainer: AstroContainer } = await import(astroRequire.resolve("astro/container"));
const runtime = pathToFileURL(astroRequire.resolve("astro/compiler-runtime")).href;
const componentSource = readFileSync(new URL("../src/components/GoogleTag.astro", import.meta.url), "utf8");
const parsed = parse(componentSource);
const scripts = parsed.ast.body.filter((node) => node.type === "JSXElement" && node.openingElement.name.name?.toLowerCase() === "script");
assert.equal(scripts.length, 1);
const template = scripts.reduceRight((source, node) => source.slice(0, node.start) + source.slice(node.end), componentSource);

async function markup(behavior) {
  const env = { PROD: true, CONTEXT: "production", PUBLIC_META_MEASUREMENT_ENABLED: "true", ...behavior.env };
  const result = transform(template.replace(/import\.meta\.env\.([A-Z0-9_]+)/g,
    (_match, key) => JSON.stringify(env[key]) ?? "undefined"), { filename: "GoogleTag.astro", internalURL: runtime, resultScopedSlot: true, resolvePath: (specifier) => specifier });
  assert.deepEqual(result.diagnostics.filter((entry) => entry.severity === "error"), []);
  const code = ts.transpileModule(result.code.replace(/^import "[^\n"]+\?astro&type=style[^\n"]+";$/gm, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const { default: compiled } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const container = await AstroContainer.create();
  const head = await container.renderToString(compiled, { props: { sensitive: behavior.sensitive ?? false } });
  assert.doesNotMatch(head, /<script[^>]+src=/, "server markup contains no third-party tag");
  return `<!doctype html><html lang="en"><head>${head}<style>${result.css.join("\n")}</style></head><body><main><h1>AWC UI</h1><input aria-label="Email address"></main><script type="module">${controller}\nwindow.__initAdvertising = initializeAdvertisingConsent; initializeAdvertisingConsent();</script></body></html>`;
}
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function harness(t, behavior = {}) {
  const context = await browser.newContext({ viewport: behavior.viewport ?? { width: 1000, height: 900 }, serviceWorkers: "block" });
  t.after(() => context.close());
  const external = [], withdrawals = [], errors = [];
  await context.addInitScript(({ storage, blocked }) => {
    if (blocked) {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Blocked", "SecurityError"); } });
    } else if (!sessionStorage.getItem("seeded")) {
      for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
      sessionStorage.setItem("seeded", "yes");
    }
    if (!blocked) {
      const original = Storage.prototype.setItem;
      const install = (both) => {
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage || both) throw new DOMException("Full", "QuotaExceededError");
          return original.call(this, key, value);
        };
      };
      window.__breakStorageWrites = (both) => {
        original.call(localStorage, "test:late-write-failure", both ? "both" : "local");
        install(both);
      };
      const failure = localStorage.getItem("test:late-write-failure");
      if (failure) install(failure === "both");
    }
  }, { storage: behavior.storage ?? {}, blocked: behavior.blocked ?? false });
  if (behavior.cookies) await context.addCookies(behavior.cookies.map(([name, value]) => ({ name, value, url: "https://awc-ui.dev/", secure: true, sameSite: "Lax" })));
  const html = await markup(behavior);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== "https://awc-ui.dev") {
      external.push(request);
      if (url.hostname === "www.googletagmanager.com") await route.fulfill({ contentType: "application/javascript", body: "window.__googleLoaded = true;" });
      else await route.abort("blockedbyclient");
    } else if (url.pathname === "/api/advertising/withdraw") {
      withdrawals.push(request);
      if (behavior.failWithdraw) await route.abort("failed");
      else await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: behavior.withdrawOk ?? true }) });
    } else await route.fulfill({ contentType: "text/html", body: html });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) => errors.push(error.message));
  if (behavior.clock) await page.clock.install();
  await page.goto(behavior.url ?? "https://awc-ui.dev/");
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  return { page, context, external, withdrawals, errors };
}
const accept = (page) => page.getByRole("button", { name: "Accept advertising", exact: true }).click();
const reject = (page) => page.getByRole("button", { name: "Reject advertising", exact: true }).click();
const preferences = (page) => page.getByRole("button", { name: "Advertising preferences", exact: true }).click();
const measurement = (page) => page.evaluate(() => window.awcAdvertising.signupMeasurement());
const cookies = (context) => context.cookies("https://awc-ui.dev/");
const serverProviders = {
  PUBLIC_META_MEASUREMENT_ENABLED: "false",
  PUBLIC_REDDIT_MEASUREMENT_ENABLED: "true",
  PUBLIC_GOOGLE_MEASUREMENT_ENABLED: "true",
};

test("Reddit and Google server attribution remain off by default, independently of Meta and the basic Google tag", async (t) => {
  const { page, context, external } = await harness(t, {
    env: { PUBLIC_META_MEASUREMENT_ENABLED: "false" },
    url: "https://awc-ui.dev/?rdt_cid=reddit_click&gclid=google_click#pro-tier",
  });
  await accept(page);
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
  assert.equal(external.length, 0);
});

test("Reddit and Google click capture requires explicit current consent and never sends a browser conversion", async (t) => {
  const { page, context, external } = await harness(t, {
    env: serverProviders, url: "https://awc-ui.dev/?rdt_cid=reddit_click&gclid=google_click#pro-tier",
  });
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
  await accept(page);
  const value = await measurement(page);
  assert.equal(value.rdt_cid, "reddit_click");
  assert.equal(value.gclid, "google_click");
  assert.equal(value.version, VERSION);
  assert.deepEqual(Object.keys(value).sort(), ["consent", "gclid", "rdt_cid", "token", "version"]);
  const parsed = readAdvertisingMeasurement(value, "test-browser", new Date(), { reddit: true, google: true });
  assert.deepEqual(parsed.providers, { reddit: { click_id: "reddit_click" }, google: { gclid: "google_click" } });
  assert.equal(parsed.userData, undefined);
  assert.equal(external.length, 0);
  assert.equal(await page.evaluate(() => window.dataLayer), undefined);
  for (const item of await cookies(context)) {
    assert.equal(item.secure, true);
    assert.equal(item.sameSite, "Lax");
    assert.equal(item.domain, "awc-ui.dev");
    assert.ok(item.expires * 1000 <= Date.now() + 90 * day);
  }
});

test("each provider works independently and Google accepts opaque gclid or braid attribution without inventing one", async (t) => {
  for (const key of ["gclid", "gbraid", "wbraid"]) {
    const { page } = await harness(t, {
      env: { ...serverProviders, PUBLIC_REDDIT_MEASUREMENT_ENABLED: "false" },
      url: `https://awc-ui.dev/?${key}=opaque_123-ABC&rdt_cid=reddit_click`,
    });
    await accept(page);
    assert.equal((await measurement(page))[key], "opaque_123-ABC");
    assert.equal((await measurement(page)).rdt_cid, undefined);
  }
  const { page } = await harness(t, {
    env: { ...serverProviders, PUBLIC_GOOGLE_MEASUREMENT_ENABLED: "false" },
    url: "https://awc-ui.dev/?rdt_cid=reddit_click&gclid=google_click",
  });
  await accept(page);
  assert.equal((await measurement(page)).rdt_cid, "reddit_click");
  assert.equal((await measurement(page)).gclid, undefined);
});

test("malformed, duplicate, conflicting and missing provider click IDs cannot create attribution", async (t) => {
  for (const query of [
    "?rdt_cid=%3Cbad%3E", "?rdt_cid=one&rdt_cid=one", "?rdt_cid=",
    "?gclid=one&gclid=two", "?gclid=one&gbraid=two", "?wbraid=one&gbraid=two",
    "?gclid=one&gbraid=", "?gclid=has%20space", "?gbraid=%3Cbad%3E", "?wbraid=%0Ainvalid", "?rdt_cid=invalid%0A", "?gclid=invalid%0A",
    `?gclid=${"x".repeat(501)}`, "?utm_source=google#pro-tier",
  ]) {
    const { page, context } = await harness(t, { env: serverProviders, url: `https://awc-ui.dev/${query}` });
    await accept(page);
    assert.equal(await measurement(page), undefined, query);
    assert.deepEqual(await cookies(context), [], query);
  }
});

test("new Google landings replace attribution, ambiguous landings clear it and ordinary navigation preserves its original expiry", async (t) => {
  const { page, context } = await harness(t, { env: serverProviders, url: "https://awc-ui.dev/?gclid=first" });
  await accept(page);
  const firstCookie = (await cookies(context))[0];
  await page.goto("https://awc-ui.dev/#pro-tier");
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal((await measurement(page)).gclid, "first");
  assert.equal((await cookies(context))[0].expires, firstCookie.expires);
  await page.goto("https://awc-ui.dev/?wbraid=second");
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal((await measurement(page)).wbraid, "second");
  assert.equal((await measurement(page)).gclid, undefined);
  await page.goto("https://awc-ui.dev/?gclid=third&wbraid=conflict");
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
});

test("Reddit and Google capture fail closed on preview, sensitive pages, rejected grants and blocked storage", async (t) => {
  for (const behavior of [
    { env: { ...serverProviders, PROD: false } },
    { env: { ...serverProviders, CONTEXT: "deploy-preview" } },
    { env: serverProviders, sensitive: true },
    { env: serverProviders, blocked: true },
  ]) {
    const { page, context, external } = await harness(t, {
      ...behavior, url: "https://awc-ui.dev/?rdt_cid=reddit_click&gclid=google_click",
    });
    await accept(page);
    assert.equal(await measurement(page), undefined);
    assert.deepEqual(await cookies(context), []);
    assert.equal(external.length, 0);
  }
  const { page, context } = await harness(t, { env: serverProviders, url: "https://awc-ui.dev/?rdt_cid=reddit_click&gclid=google_click" });
  await reject(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
});

test("upgrading the consent version revokes the previous grant and clears provider cookies before asking again", async (t) => {
  const { page, context, withdrawals } = await harness(t, {
    env: serverProviders,
    url: "https://awc-ui.dev/?rdt_cid=new_click&gclid=new_click",
    storage: { [CHOICE]: JSON.stringify({ version: "advertising-2026-10-06-v1", decision: "accepted", at: Date.now(), token: oldToken }) },
    cookies: [["_awc_rdt_cid", "old_click"], ["_awc_gclid", "old_click"]],
  });
  await page.waitForFunction((key) => localStorage.getItem(key) === null, REVOKE + oldToken);
  assert.ok(withdrawals.some((request) => request.postDataJSON().token === oldToken));
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
  assert.equal(await page.locator("section").isVisible(), true);
});

test("withdrawal clears all provider identifiers across tabs and cancels only with the private capability", async (t) => {
  const { page, context, withdrawals, external } = await harness(t, {
    env: serverProviders, url: "https://awc-ui.dev/?rdt_cid=reddit_click&gclid=google_click#pro-tier",
  });
  await accept(page);
  const previous = await measurement(page);
  const other = await context.newPage();
  await other.goto("https://awc-ui.dev/#pro-tier");
  await other.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.ok(await measurement(other));
  await preferences(page);
  await reject(page);
  await other.waitForFunction(() => window.awcAdvertising.signupMeasurement() === undefined);
  assert.deepEqual(await cookies(context), []);
  assert.equal(await measurement(page), undefined);
  assert.equal(external.length, 0);
  assert.ok(withdrawals.length > 0);
  assert.ok(withdrawals.every((request) => JSON.stringify(request.postDataJSON()) === JSON.stringify({ token: previous.token })));
});

test("server attribution cookies expire with the original grant while the page stays open", async (t) => {
  const { page, context } = await harness(t, { env: serverProviders,
    url: "https://awc-ui.dev/?rdt_cid=reddit_click&gclid=google_click", clock: true,
    storage: { [CHOICE]: JSON.stringify({ version: VERSION, decision: "accepted", at: Date.now() - 90 * day + 60_000, token: oldToken }) },
  });
  assert.ok(await measurement(page));
  for (const item of await cookies(context)) assert.ok(item.expires * 1000 <= Date.now() + 60_000);
  await page.clock.fastForward(60_001);
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
});

test("no advertising requests, identifiers or capture before a choice; reject keeps signup usable", async (t) => {
  const { page, context, external, withdrawals } = await harness(t, { url: "https://awc-ui.dev/?fbclid=valid_click" });
  assert.equal(external.length, 0);
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
  await page.getByLabel("Email address").fill("person@example.test");
  await reject(page);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal(await page.locator("section").isVisible(), false);
  assert.equal(external.length + withdrawals.length, 0);
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
});

test("Accept loads Google only after consent with personalization and analytics denied and no browser Lead", async (t) => {
  const { page, external, errors } = await harness(t);
  assert.equal(external.length, 0);
  await accept(page);
  await page.waitForFunction(() => window.__googleLoaded === true);
  assert.equal(external.length, 1);
  assert.equal((await external[0].allHeaders()).referer, undefined);
  const commands = await page.evaluate(() => window.dataLayer.map((entry) => Array.from(entry)));
  assert.equal(commands[0][0], "consent");
  assert.equal(commands[0][2].ad_storage, "denied");
  const grant = commands.find((entry) => entry[0] === "consent" && entry[1] === "update")[2];
  assert.deepEqual(grant, { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied", analytics_storage: "denied" });
  const config = commands.find((entry) => entry[0] === "config")[2];
  assert.equal(config.page_location, "https://awc-ui.dev/");
  assert.equal(config.page_referrer, "");
  assert.equal(config.cookie_update, false);
  assert.equal(config.allow_enhanced_conversions, false);
  assert.equal(commands.some((entry) => entry[0] === "event"), false);
  await page.evaluate(() => window.__initAdvertising());
  assert.equal(await page.locator(".awc-advertising").count(), 1);
  assert.equal(external.length, 1);
  assert.deepEqual(errors, []);
});

test("Meta captures only valid current click identifiers after Accept, with secure 90-day cookies and a private capability", async (t) => {
  const { page, context, external } = await harness(t, { url: "https://awc-ui.dev/?fbclid=valid_click-123" });
  await accept(page);
  const value = await measurement(page);
  assert.equal(value.consent, true);
  assert.equal(value.version, VERSION);
  const parsed = readAdvertisingMeasurement(value, await page.evaluate(() => navigator.userAgent));
  assert.ok(parsed, "the real backend parser accepts the browser payload");
  assert.equal(parsed.userData.fbp, value.fbp);
  assert.equal(parsed.userData.fbc, value.fbc);
  assert.match(value.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(value.fbp, /^fb\.1\.\d{13}\.\d{1,20}$/);
  assert.match(value.fbc, /^fb\.1\.\d{13}\.valid_click-123$/);
  assert.deepEqual(Object.keys(value).sort(), ["consent", "fbc", "fbp", "token", "version"]);
  for (const cookie of await cookies(context)) {
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, "Lax");
    assert.equal(cookie.domain, "awc-ui.dev");
    assert.ok(cookie.expires * 1000 <= Date.now() + 90 * day);
  }
  assert.equal(external.length, 0, "Google is skipped on parameter-bearing links; no Meta browser pixel exists");
});

test("malformed, duplicate, future and stale identifiers are not sent; fbc is never invented", async (t) => {
  for (const query of ["", "?fbclid=%3Cbad%3E", "?fbclid=a&fbclid=b"]) {
    const { page } = await harness(t, { url: `https://awc-ui.dev/${query}` });
    await accept(page);
    assert.equal((await measurement(page)).fbc, undefined, "a click identifier is never invented or salvaged from an invalid link");
  }
  const { page, context } = await harness(t, { url: "https://awc-ui.dev/?fbclid=%3Cbad%3E" });
  await accept(page);
  assert.equal((await measurement(page)).fbc, undefined);
  await context.addCookies([
    { name: "_fbp", value: `fb.1.${Date.now() + day}.123`, url: "https://awc-ui.dev/" },
    { name: "_fbc", value: `fb.1.${Date.now() - 91 * day}.old`, url: "https://awc-ui.dev/" },
  ]);
  assert.equal(await measurement(page), undefined);
});

test("local, preview, default-off Meta and sensitive pages fail closed", async (t) => {
  for (const behavior of [
    { env: { PROD: false } }, { env: { CONTEXT: "deploy-preview" } },
    { env: { CONTEXT: undefined } }, { sensitive: true },
  ]) {
    const { page, context, external } = await harness(t, behavior);
    await accept(page);
    assert.equal(await measurement(page), undefined);
    assert.equal(external.length, 0);
    assert.deepEqual(await cookies(context), []);
  }
  const { page, context } = await harness(t, { env: { PUBLIC_META_MEASUREMENT_ENABLED: undefined }, url: "https://awc-ui.dev/?fbclid=click" });
  await accept(page);
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
});

test("blocked storage and invalid or expired saved choices cannot enable advertising", async (t) => {
  for (const stored of ["broken-json", JSON.stringify({ version: "old", decision: "accepted", at: Date.now(), token: oldToken }),
    JSON.stringify({ version: VERSION, decision: "accepted", at: Date.now() - 91 * day, token: oldToken }),
    JSON.stringify({ version: VERSION, decision: "accepted", at: Date.now() + day, token: oldToken }),
    JSON.stringify({ version: VERSION, decision: "accepted", at: Date.now(), token: "bad" })]) {
    const { page, context, external } = await harness(t, { storage: { [CHOICE]: stored } });
    assert.equal(external.length, 0);
    assert.equal(await measurement(page), undefined);
    assert.deepEqual(await cookies(context), []);
    assert.equal(await page.locator("section").isVisible(), true);
  }
  const { page, external } = await harness(t, { blocked: true });
  await accept(page);
  assert.match(await page.locator("[data-advertising-status]").textContent(), /Advertising stays off/);
  assert.equal(external.length, 0);
  assert.equal(await measurement(page), undefined);
});

test("withdrawal persists denial, clears cookies, unloads Google and sends only the revocation capability", async (t) => {
  const { page, context, external, withdrawals } = await harness(t);
  await accept(page);
  await page.waitForFunction(() => window.__googleLoaded === true);
  const previous = await measurement(page);
  await context.addCookies([{ name: "_gcl_test", value: "old", url: "https://awc-ui.dev/" }]);
  await preferences(page);
  await reject(page);
  await page.waitForFunction(() => Boolean(window.awcAdvertising) && !window.__googleLoaded);
  await page.waitForFunction(() => !Object.keys(localStorage).some((key) => key.startsWith("awc:advertising:revoke:")));
  assert.ok(withdrawals.length >= 1);
  assert.ok(withdrawals.every((request) => request.postDataJSON().token === previous.token));
  assert.deepEqual(Object.keys(withdrawals[0].postDataJSON()), ["token"]);
  const headers = await withdrawals[0].allHeaders();
  assert.equal(headers.cookie, undefined);
  assert.equal(headers.referer, undefined);
  assert.deepEqual(await cookies(context), []);
  assert.equal(await measurement(page), undefined);
  assert.equal(external.length, 1, "reloaded page stays unmeasured");
});

test("failed withdrawal survives reload and a new grant; online retry revokes only the previous capability", async (t) => {
  const behavior = { failWithdraw: true, url: "https://awc-ui.dev/?fbclid=old_click" };
  const { page, withdrawals } = await harness(t, behavior);
  await accept(page);
  const previous = await measurement(page);
  await preferences(page);
  await reject(page);
  await page.waitForFunction((key) => localStorage.getItem(key) === "pending", REVOKE + previous.token);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  await preferences(page);
  await accept(page);
  const next = await measurement(page);
  assert.notEqual(next.token, previous.token);
  assert.notEqual(next.fbp, previous.fbp);
  behavior.failWithdraw = false;
  // Wait for the first failed request to release its in-flight lock.
  await page.waitForTimeout(50);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction((key) => localStorage.getItem(key) === null, REVOKE + previous.token);
  assert.ok(withdrawals.every((request) => request.postDataJSON().token === previous.token));
  assert.equal((await measurement(page)).token, next.token);
});

test("withdrawal in another tab stops stale in-memory attribution and Google on both tabs", async (t) => {
  const { page, context, external } = await harness(t);
  await accept(page);
  await page.waitForFunction(() => window.__googleLoaded === true);
  const other = await context.newPage();
  await other.goto("https://awc-ui.dev/");
  await other.waitForFunction(() => window.__googleLoaded === true);
  await preferences(page);
  await reject(page);
  await other.waitForFunction(() => Boolean(window.awcAdvertising) && !window.__googleLoaded);
  assert.equal(await measurement(other), undefined);
  assert.deepEqual(await cookies(context), []);
  assert.equal(external.length, 2);
});

test("90-day expiry is enforced while the page remains open without renewing consent", async (t) => {
  const { page, external } = await harness(t, { url: "https://awc-ui.dev/?fbclid=click", clock: true, storage: {
    [CHOICE]: JSON.stringify({ version: VERSION, decision: "accepted", at: Date.now() - 90 * day + 60_000, token: oldToken }),
  } });
  assert.ok(await measurement(page));
  await page.clock.fastForward(60_001);
  assert.equal(await measurement(page), undefined);
  assert.equal(await page.locator("section").isVisible(), true);
  assert.equal(external.length, 0);
});

test("mobile consent actions have equal emphasis, remain keyboard accessible and can be changed", async (t) => {
  const { page } = await harness(t, { viewport: { width: 320, height: 620 }, url: "https://awc-ui.dev/?fbclid=click" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.ok((await page.locator("section").boundingBox()).height < 280, "compact banner leaves the page accessible at 320px");
  await page.getByRole("textbox", { name: "Email address" }).fill("reader@example.com");
  assert.equal(await measurement(page), undefined);
  const buttons = page.locator(".awc-advertising-actions button");
  const styles = await buttons.evaluateAll((items) => items.map((item) => {
    const style = getComputedStyle(item);
    return [style.backgroundColor, style.color, style.border, style.fontWeight, style.minHeight];
  }));
  assert.deepEqual(styles[0], styles[1]);
  await buttons.nth(0).focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Accept");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await preferences(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), "awc-advertising-title");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("section").isVisible(), false);
});

test("dismissing the banner leaves consent undecided and measurement off", async (t) => {
  const { page, context, external } = await harness(t);
  assert.ok((await page.locator("section").boundingBox()).height < 180, "desktop banner stays compact");
  await page.getByRole("button", { name: "Close advertising preferences" }).click();
  assert.equal(await page.locator("section").isVisible(), false);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), CHOICE), null);
  assert.equal(await measurement(page), undefined);
  assert.deepEqual(await cookies(context), []);
  assert.equal(external.length, 0);
  await preferences(page);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("section").isVisible(), false);
  await preferences(page);
  await accept(page);
  assert.ok(await measurement(page));
});


test("late localStorage write failure falls back to a saved session denial and retries withdrawal after reload", async (t) => {
  const behavior = { failWithdraw: true };
  const { page, external, withdrawals } = await harness(t, behavior);
  await accept(page);
  await page.waitForFunction(() => window.__googleLoaded === true);
  const previous = await measurement(page);
  await page.evaluate(() => window.__breakStorageWrites(false));
  await preferences(page);
  await reject(page);
  await page.waitForFunction(() => Boolean(window.awcAdvertising) && !window.__googleLoaded);
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), REVOKE + previous.token), "pending");
  assert.equal(await measurement(page), undefined);
  assert.equal(external.length, 1);
  behavior.failWithdraw = false;
  await page.waitForTimeout(50);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction((key) => sessionStorage.getItem(key) === null, REVOKE + previous.token);
  assert.ok(withdrawals.every((request) => request.postDataJSON().token === previous.token));
});

test("when both stores fail after acceptance, a forced-off reload unloads Google and preserves the old revocation code until ACK", async (t) => {
  const behavior = { failWithdraw: true };
  const { page, external, withdrawals } = await harness(t, behavior);
  await accept(page);
  await page.waitForFunction(() => window.__googleLoaded === true);
  const previous = await measurement(page);
  await page.evaluate(() => window.__breakStorageWrites(true));
  await preferences(page);
  await reject(page);
  await page.waitForURL("https://awc-ui.dev/?awc_advertising=off");
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal(await measurement(page), undefined);
  assert.equal(external.length, 1);
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).token, CHOICE), previous.token);
  assert.match(await page.locator("[data-advertising-status]").textContent(), /could not save/);
  await accept(page);
  assert.equal(await measurement(page), undefined);
  behavior.failWithdraw = false;
  await page.waitForTimeout(50);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction((key) => localStorage.getItem(key) === null, CHOICE);
  assert.ok(withdrawals.every((request) => request.postDataJSON().token === previous.token));
  await page.reload();
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal(await measurement(page), undefined);
  assert.equal(external.length, 1);
});

test("Meta-only campaign withdrawal stays off across reload and internal links when both stores fail", async (t) => {
  const behavior = { failWithdraw: true, url: "https://awc-ui.dev/?fbclid=campaign#pro-tier" };
  const { page, external } = await harness(t, behavior);
  await accept(page);
  const previous = await measurement(page);
  await page.evaluate(() => window.__breakStorageWrites(true));
  await preferences(page);
  await reject(page);
  assert.equal(new URL(page.url()).searchParams.get("awc_advertising"), "off");
  assert.equal(await measurement(page), undefined);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal(await measurement(page), undefined);
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).token, CHOICE), previous.token);
  await page.getByRole("link", { name: "Read about advertising and your data" }).click();
  await page.waitForURL("https://awc-ui.dev/privacy/?awc_advertising=off#advertising-measurement");
  await page.waitForFunction(() => Boolean(window.awcAdvertising));
  assert.equal(await measurement(page), undefined);
  assert.equal(external.length, 0);
});

test("expiry preserves its revocation code when both stores fail until the server acknowledges", async (t) => {
  const behavior = { failWithdraw: true, clock: true, url: "https://awc-ui.dev/?fbclid=click", storage: {
    [CHOICE]: JSON.stringify({ version: VERSION, decision: "accepted", at: Date.now() - 90 * day + 60_000, token: oldToken }),
  } };
  const { page } = await harness(t, behavior);
  await page.evaluate(() => window.__breakStorageWrites(true));
  await page.clock.fastForward(60_001);
  assert.equal(await measurement(page), undefined);
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).token, CHOICE), oldToken);
  behavior.failWithdraw = false;
  await page.waitForTimeout(50);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction((key) => localStorage.getItem(key) === null, CHOICE);
});
