import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import ts from "typescript";

// Use the compiler installed with Astro, without booting the complete docs site.
const astroRequire = createRequire(
  realpathSync(new URL("../node_modules/astro/package.json", import.meta.url)),
);
const { transform } = await import(
  astroRequire.resolve("@astrojs/compiler-rs")
);
const { experimental_AstroContainer: AstroContainer } = await import(
  astroRequire.resolve("astro/container")
);
const runtime = pathToFileURL(
  astroRequire.resolve("astro/compiler-runtime"),
).href;
const source = readFileSync(
  new URL("../src/components/WaitlistForm.astro", import.meta.url),
  "utf8",
);
const proSource = readFileSync(
  new URL("../src/components/ProTierSection.astro", import.meta.url),
  "utf8",
);
const controller = ts.transpileModule(
  readFileSync(new URL("../src/scripts/waitlist.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const moduleUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

function compile(source, filename) {
  const result = transform(source, {
    filename,
    internalURL: runtime,
    resultScopedSlot: true,
    resolvePath: (specifier) => specifier,
  });
  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    [],
  );
  // Vite ordinarily handles these extracted styles; insert the same CSS below.
  return {
    ...result,
    code: result.code.replace(
      /^import "[^\n"]+\?astro&type=style[^\n"]+";$/gm,
      "",
    ),
  };
}

async function render(flag, sitekey, fullSection = false) {
  // The hoisted client script is exercised separately through the real controller.
  const component = compile(
    source
      .replace("import.meta.env.PUBLIC_WAITLIST_ENABLED", JSON.stringify(flag))
      .replace(
        "import.meta.env.PUBLIC_TURNSTILE_SITE_KEY",
        JSON.stringify(sitekey),
      )
      .replace(/<script>[\s\S]*?<\/script>/, ""),
    "WaitlistForm.astro",
  );
  let code = component.code;
  let css = component.css.join("\n");
  if (fullSection) {
    const section = compile(
      proSource
        .replace(
          'import WaitlistForm from "./WaitlistForm.astro";',
          `import WaitlistForm from ${JSON.stringify(moduleUrl(code))};`,
        )
        .replace(
          'import stats from "../data/stats.json";',
          `const stats = ${readFileSync(new URL("../src/data/stats.json", import.meta.url), "utf8")};`,
        ),
      "ProTierSection.astro",
    );
    code = section.code;
    css += section.css.join("\n");
  }
  const { default: compiled } = await import(moduleUrl(code));
  const container = await AstroContainer.create();
  const html = await container.renderToString(compiled);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
    html{font-family:sans-serif}body{margin:0}*{box-sizing:border-box}${css}
  </style></head><body>${html}</body></html>`;
}

const turnstileStub = `
  window.__turnstile = { resets: 0, removes: 0 };
  window.turnstile = {
    ready(callback) { callback(); },
    render(container, options) {
      window.__turnstile.options = options;
      container.innerHTML = '<div style="width:150px;height:140px;border:1px solid">Security check</div>';
      return 'widget-1';
    },
    reset() { window.__turnstile.resets++; },
    remove() { window.__turnstile.removes++; },
  };
`;
let browser;
let enabledHtml;
before(async () => {
  enabledHtml = await render("true", "test-public-key");
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});

async function harness(t, behavior = {}) {
  const context = await browser.newContext({
    viewport: behavior.viewport ?? { width: 1000, height: 1100 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  const calls = [];
  const scripts = [];
  const held = [];
  const release = () => held.splice(0).forEach((resolve) => resolve());
  t.after(async () => {
    release();
    await context.close();
  });
  await context.addCookies([
    {
      name: "unrelated-cookie",
      value: "not-for-waitlist",
      domain: "awc-ui.dev",
      path: "/",
    },
  ]);
  // No request reaches the real site, Cloudflare, or the signup endpoint.
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      request.url() ===
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    ) {
      scripts.push(request);
      if (behavior.loaderFail) {
        behavior.loaderFail = false;
        await route.abort("failed");
        return;
      }
      if (behavior.loaderStall)
        await new Promise((resolve) => held.push(resolve));
      try {
        await route.fulfill({
          contentType: "application/javascript",
          body: turnstileStub,
        });
      } catch {
        /* Aborted load. */
      }
      return;
    }
    if (request.url() === "https://awc-ui.dev/api/waitlist") {
      calls.push(request);
      if (behavior.networkFail) {
        await route.abort("failed");
        return;
      }
      if (behavior.stall) await new Promise((resolve) => held.push(resolve));
      const body = behavior.response ?? { ok: true };
      try {
        await route.fulfill({
          status: behavior.status ?? 200,
          contentType: "application/json",
          body: typeof body === "string" ? body : JSON.stringify(body),
        });
      } catch {
        /* The timeout/cleanup tests intentionally abort requests. */
      }
      return;
    }
    if (request.url() === "https://awc-ui.dev/") {
      await route.fulfill({
        contentType: "text/html",
        body: behavior.markup ?? enabledHtml,
      });
      return;
    }
    await route.abort("blockedbyclient");
  });
  await page.goto("https://awc-ui.dev/");
  if (behavior.clock) await page.clock.install();
  if (!behavior.noScript) {
    await page.addScriptTag({
      type: "module",
      content: `${controller}\nwindow.__waitlist = { initializeWaitlists, disposeWaitlists }; initializeWaitlists();`,
    });
    await page.waitForFunction(() => Boolean(window.__waitlist));
  }
  return { page, calls, scripts, release };
}

async function verify(page, token = "fresh-token") {
  await page.waitForFunction(() => Boolean(window.__turnstile?.options));
  await page.evaluate(
    (value) => window.__turnstile.options.callback(value),
    token,
  );
}
async function submit(page) {
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person@example.com");
  await page
    .getByRole("button", { name: "Join the waitlist", exact: true })
    .click();
}
const outcome = (page, state) =>
  page.waitForFunction(
    (value) =>
      document.querySelector("[data-waitlist-status]").dataset.state === value,
    state,
  );
const countResets = (page) => page.evaluate(() => window.__turnstile.resets);

test("signup fails closed for disabled, missing, and blank public configuration", async (t) => {
  for (const [flag, sitekey] of [
    [undefined, undefined],
    ["false", "key"],
    ["TRUE", "key"],
    ["true", ""],
    ["true", "   "],
  ]) {
    const markup = await render(flag, sitekey);
    const { page, scripts, calls } = await harness(t, { markup });
    assert.equal(await page.locator("form").count(), 0);
    assert.match(
      await page.locator("body").textContent(),
      /Waitlist signup is not open yet/,
    );
    assert.equal(scripts.length, 0);
    assert.equal(calls.length, 0);
  }
});

test("without JavaScript the form cannot send email through a browser navigation", async (t) => {
  const { page, calls, scripts } = await harness(t, { noScript: true });
  assert.equal(await page.locator("form").isVisible(), false);
  assert.equal(
    await page.locator("[data-waitlist-fallback]").isVisible(),
    true,
  );
  assert.equal(await page.locator("form").getAttribute("method"), "post");
  assert.equal(calls.length + scripts.length, 0);
});

test("new and duplicate signups share success feedback, private payload transport, reset, and focus", async (t) => {
  for (let duplicate = 0; duplicate < 2; duplicate++) {
    const { page, calls, scripts } = await harness(t);
    await verify(page);
    assert.deepEqual(
      await page.evaluate(() => {
        const options = window.__turnstile.options;
        return [
          options.sitekey,
          options.action,
          options.size,
          options["response-field"],
        ];
      }),
      ["test-public-key", "waitlist_join", "compact", false],
    );
    await submit(page);
    await outcome(page, "success");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].postDataJSON(), {
      email: "person@example.com",
      token: "fresh-token",
      website: "",
    });
    const headers = await calls[0].allHeaders();
    assert.equal(headers.referer, undefined);
    assert.equal(headers.cookie, undefined);
    assert.equal((await scripts[0].allHeaders()).referer, undefined);
    assert.equal(await countResets(page), 1);
    assert.equal(await page.locator("form").isVisible(), false);
    assert.equal(
      await page.locator("[data-waitlist-status]").textContent(),
      "Thank you! Your waitlist request has been received. If this address is already on the list, you’re all set.",
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement ===
          document.querySelector("[data-waitlist-status]"),
      ),
      true,
    );
    assert.equal(
      await page.getByLabel("Email address", { exact: true }).inputValue(),
      "",
    );
  }
});

test("server, malformed response, and network failures preserve email and permit a fresh-token retry", async (t) => {
  for (const [name, behavior] of [
    ["verification rejected", { status: 403 }],
    ["rate limited", { status: 429 }],
    ["service unavailable", { status: 503 }],
    ["invalid JSON", { response: "bad json" }],
    ["not acknowledged", { response: { ok: false } }],
    ["network error", { networkFail: true }],
  ]) {
    await t.test(name, async (t) => {
      const { page, calls } = await harness(t, behavior);
      await verify(page);
      await submit(page);
      await outcome(page, "error");
      assert.equal(
        await page.getByLabel("Email address", { exact: true }).inputValue(),
        "person@example.com",
      );
      assert.equal(await countResets(page), 1);
      assert.equal(
        await page.locator("button[type=submit]").isDisabled(),
        true,
      );
      const message = await page
        .locator("[data-waitlist-status]")
        .textContent();
      await verify(page, "replacement-token");
      assert.equal(await page.locator("button[type=submit]").isEnabled(), true);
      assert.equal(
        await page.locator("[data-waitlist-status]").textContent(),
        message,
      );
      Object.assign(behavior, {
        status: 200,
        response: { ok: true },
        networkFail: false,
      });
      await page.locator("button[type=submit]").click();
      await outcome(page, "success");
      assert.equal(calls[1].postDataJSON().token, "replacement-token");
      assert.equal(await countResets(page), 2);
    });
  }
});

test("native email validation and expired challenge prevent requests until corrected", async (t) => {
  const { page, calls } = await harness(t);
  await verify(page);
  await page.getByLabel("Email address", { exact: true }).fill("not-an-email");
  await page.locator("button[type=submit]").click();
  assert.equal(calls.length, 0);
  await page.evaluate(() => window.__turnstile.options["expired-callback"]());
  assert.equal(await page.locator("button[type=submit]").isDisabled(), true);
  await page.getByRole("button", { name: "Retry security check" }).click();
  assert.equal(await countResets(page), 1);
  await verify(page);
  await submit(page);
  await outcome(page, "success");
});

test("script-load failure has an accessible retry", async (t) => {
  const { page, scripts } = await harness(t, { loaderFail: true });
  await page.getByRole("button", { name: "Retry security check" }).waitFor();
  assert.equal(await page.locator("button[type=submit]").isDisabled(), true);
  await page.getByRole("button", { name: "Retry security check" }).click();
  await verify(page);
  assert.equal(scripts.length, 2);
  assert.equal(await page.locator("button[type=submit]").isEnabled(), true);
});

test("script-load timeout exposes retry rather than leaving signup pending forever", async (t) => {
  const { page, release } = await harness(t, {
    loaderStall: true,
    clock: true,
  });
  await page.clock.fastForward(15_001);
  await outcome(page, "error");
  assert.equal(
    await page
      .getByRole("button", { name: "Retry security check" })
      .isVisible(),
    true,
  );
  assert.equal(await page.locator("button[type=submit]").isDisabled(), true);
  release();
});

test("pending requests lock email and prevent duplicate submissions", async (t) => {
  const { page, calls, release } = await harness(t, { stall: true });
  await verify(page);
  await submit(page);
  await page.waitForFunction(
    () => document.querySelector("form").getAttribute("aria-busy") === "true",
  );
  assert.equal(
    await page
      .getByLabel("Email address", { exact: true })
      .getAttribute("readonly"),
    "",
  );
  assert.equal(await page.locator("button[type=submit]").isDisabled(), true);
  await page.locator("form").dispatchEvent("submit");
  assert.equal(calls.length, 1);
  release();
  await outcome(page, "success");
});

test("request timeout resets the single-use token and preserves the email", async (t) => {
  const { page, release } = await harness(t, { stall: true, clock: true });
  await verify(page);
  await submit(page);
  await page.clock.fastForward(15_001);
  await page.waitForFunction(() =>
    document
      .querySelector("[data-waitlist-status]")
      .textContent.includes("timed out"),
  );
  assert.equal(await countResets(page), 1);
  assert.equal(
    await page.getByLabel("Email address", { exact: true }).inputValue(),
    "person@example.com",
  );
  release();
});

test("mobile layout, keyboard order, repeated initialization, and navigation cleanup", async (t) => {
  const { page, scripts } = await harness(t, {
    markup: await render("true", "test-public-key", true),
    viewport: { width: 320, height: 1000 },
  });
  await verify(page);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.getByLabel("Email address", { exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Privacy Policy",
  );
  await page.evaluate(() => window.__waitlist.initializeWaitlists());
  assert.equal(scripts.length, 1);
  if (process.env.WAITLIST_SCREENSHOT_PATH) {
    await page
      .locator(".awc-waitlist")
      .screenshot({ path: process.env.WAITLIST_SCREENSHOT_PATH });
  }
  await page.evaluate(() => window.__waitlist.disposeWaitlists());
  assert.equal(await page.evaluate(() => window.__turnstile.removes), 1);
});
