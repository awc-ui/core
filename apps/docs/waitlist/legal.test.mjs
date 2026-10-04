import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parse } from "parse5";
import ts from "typescript";

const astroRequire = createRequire(
  realpathSync(new URL("../node_modules/astro/package.json", import.meta.url)),
);
const { parse: parseAstro, transform } = await import(
  astroRequire.resolve("@astrojs/compiler-rs")
);
const { experimental_AstroContainer: AstroContainer } = await import(
  astroRequire.resolve("astro/container")
);
const runtime = pathToFileURL(
  astroRequire.resolve("astro/compiler-runtime"),
).href;

function compile(source, filename, imports = {}) {
  const result = transform(source, {
    filename,
    internalURL: runtime,
    resultScopedSlot: true,
    resolvePath: (specifier) => imports[specifier] ?? specifier,
  });
  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
    [],
  );
  // Styles are extracted by Astro; they are unnecessary for these server-render checks.
  const code = result.code.replace(
    /^import "[^\n"]+\?astro&type=style[^\n"]+";$/gm,
    "",
  );
  let javascript = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  // Resolve the compiled layout just as Vite resolves its .astro import.
  for (const [specifier, target] of Object.entries(imports)) {
    javascript = javascript.replace(
      `from ${JSON.stringify(specifier)};`,
      `from ${JSON.stringify(target)};`,
    );
  }
  return `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
}

const layout = compile(
  readFileSync(
    new URL("../src/components/WaitlistLegalPage.astro", import.meta.url),
    "utf8",
  ),
  "WaitlistLegalPage.astro",
);

function* descendants(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* descendants(child);
}

async function renderPage(page, env = {}) {
  const withEnv = (source) => source.replace(
    /import\.meta\.env\.([A-Z0-9_]+)/g,
    (_match, key) => JSON.stringify(env[key]) ?? "undefined",
  );
  const source = withEnv(readFileSync(
    new URL(`../src/pages/${page}.astro`, import.meta.url),
    "utf8",
  ));
  const imports = { "../components/WaitlistLegalPage.astro": layout };
  if (page === "waitlist-check") {
    const form = readFileSync(
      new URL("../src/components/WaitlistForm.astro", import.meta.url),
      "utf8",
    );
    // Server rendering uses the real form; its hoisted browser script is covered
    // separately by frontend.test.mjs and is bundled by Astro in deployment.
    const parsed = parseAstro(form);
    const scripts = parsed.ast.body.filter((node) =>
      node.type === "JSXElement" &&
      node.openingElement.name.name?.toLowerCase() === "script",
    );
    const template = scripts.reduceRight(
      (source, node) => source.slice(0, node.start) + source.slice(node.end),
      form,
    );
    imports["../components/WaitlistForm.astro"] = compile(
      withEnv(template),
      "WaitlistForm.astro",
    );
  }
  const { default: component } = await import(
    compile(source, `${page}.astro`, imports)
  );
  const container = await AstroContainer.create();
  const html = await container.renderToString(component, {
    request: new Request(`https://preview.example/${page}/?preview=true`),
  });
  const nodes = [...descendants(parse(html))];
  const main = nodes.find((node) => node.tagName === "main");
  assert.ok(main, "the page renders through its shared legal layout");
  const text = [...descendants(main)]
    .filter((node) => node.nodeName === "#text")
    .map((node) => node.value)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const links = nodes
    .filter((node) => node.tagName === "a")
    .map(
      (node) =>
        node.attrs.find((attribute) => attribute.name === "href")?.value,
    );
  return { nodes, text, links };
}

test("legal pages publish complete metadata using canonical production URLs", async () => {
  for (const page of ["privacy", "waitlist-terms"]) {
    const { nodes } = await renderPage(page);
    const attr = (node, name) =>
      node.attrs?.find((attribute) => attribute.name === name)?.value;
    const meta = (name) =>
      attr(
        nodes.find(
          (node) =>
            node.tagName === "meta" &&
            (attr(node, "name") === name || attr(node, "property") === name),
        ) ?? {},
        "content",
      );
    const canonical = `https://awc-ui.dev/${page}/`;
    assert.equal(
      attr(
        nodes.find(
          (node) =>
            node.tagName === "link" && attr(node, "rel") === "canonical",
        ),
        "href",
      ),
      canonical,
    );
    assert.ok(meta("description")?.length >= 50);
    assert.match(meta("robots"), /^index, follow/);
    assert.equal(meta("og:url"), canonical);
    assert.equal(meta("og:description"), meta("description"));
    assert.equal(meta("og:image"), "https://awc-ui.dev/og-awc-ui-dev.png");
    const script = nodes.find(
      (node) =>
        node.tagName === "script" &&
        attr(node, "type") === "application/ld+json",
    );
    const data = JSON.parse(
      script.childNodes.map((node) => node.value).join(""),
    );
    assert.equal(data["@type"], "WebPage");
    assert.equal(data.url, canonical);
    assert.equal(data.description, meta("description"));
    assert.equal(data.name, meta("og:title"));
  }
});

test("privacy stays a closed-signup placeholder without a finalized identity", async () => {
  for (const env of [
    {},
    { PUBLIC_WAITLIST_ENABLED: "false" },
    {
      PUBLIC_WAITLIST_ENABLED: "false",
      PUBLIC_WAITLIST_CONTROLLER_NAME: "  ",
      PUBLIC_WAITLIST_CONTACT_ADDRESS: "  ",
    },
  ]) {
    const { text, links } = await renderPage("privacy", env);
    assert.match(text, /Waitlist signup is not open yet/);
    assert.match(text, /before collecting signups/);
    assert.doesNotMatch(
      text,
      /Who is responsible|What we collect and why|Service providers and access/,
    );
    assert.doesNotMatch(text, /Netlify|Cloudflare|GoDaddy/);
    assert.ok(!links.some((link) => link?.startsWith("mailto:")));
  }
});

test("publishing an enabled waitlist without either identity field fails instead of publishing a placeholder policy", async () => {
  for (const identity of [
    {},
    { PUBLIC_WAITLIST_CONTROLLER_NAME: "Example Maintainer" },
    {
      PUBLIC_WAITLIST_CONTACT_ADDRESS: "Example contact address",
    },
    {
      PUBLIC_WAITLIST_CONTROLLER_NAME: " ",
      PUBLIC_WAITLIST_CONTACT_ADDRESS: "\t",
    },
  ]) {
    await assert.rejects(
      renderPage("privacy", { PUBLIC_WAITLIST_ENABLED: "true", ...identity }),
      /controller identity and contact address must be finalized/i,
    );
  }
});

test("the production operator signup check also requires a finalized privacy identity", async () => {
  for (const identity of [
    {},
    { PUBLIC_WAITLIST_CONTROLLER_NAME: "Example Maintainer" },
    { PUBLIC_WAITLIST_CONTACT_ADDRESS: "operator@example.test" },
    { PUBLIC_WAITLIST_CONTROLLER_NAME: " ", PUBLIC_WAITLIST_CONTACT_ADDRESS: "\t" },
  ]) {
    await assert.rejects(renderPage("privacy", {
      PUBLIC_WAITLIST_ENABLED: "false",
      PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED: "true",
      CONTEXT: "production",
      ...identity,
    }), /controller identity and contact address must be finalized/i);
  }
});

test("the operator route is noindex and renders the shared form only in explicitly enabled production", async () => {
  const env = {
    PUBLIC_WAITLIST_ENABLED: "false",
    PUBLIC_TURNSTILE_SITE_KEY: "operator-public-site-key",
    PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED: "true",
    CONTEXT: "production",
  };
  const attr = (node, name) => node.attrs?.find((attribute) => attribute.name === name)?.value;
  for (const [overrides, enabled] of [
    [{}, true],
    [{ PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED: undefined }, false],
    [{ PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED: "false" }, false],
    [{ PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED: "TRUE" }, false],
    [{ CONTEXT: undefined }, false],
    [{ CONTEXT: "dev" }, false],
    [{ CONTEXT: "deploy-preview" }, false],
    [{ CONTEXT: "branch-deploy" }, false],
    [{ PUBLIC_TURNSTILE_SITE_KEY: " " }, false],
  ]) {
    const { nodes, text } = await renderPage("waitlist-check", { ...env, ...overrides });
    const robots = nodes.find((node) => node.tagName === "meta" && attr(node, "name") === "robots");
    assert.equal(attr(robots, "content"), "noindex, nofollow");
    const forms = nodes.filter((node) => node.tagName === "form");
    assert.equal(forms.length, Number(enabled));
    if (enabled) {
      assert.match(text, /for the AWC UI operator only/);
      assert.match(text, /Public waitlist signup remains closed/);
      assert.match(text, /sends a confirmation to the test address and a notification to the administrator/);
      assert.equal(attr(forms[0], "action"), "/api/waitlist");
      assert.equal(attr(forms[0], "data-sitekey"), env.PUBLIC_TURNSTILE_SITE_KEY);
      const email = nodes.find((node) => node.tagName === "input" && attr(node, "name") === "email");
      assert.equal(attr(email, "value"), undefined);
      assert.equal(attr(email, "readonly"), undefined);
      assert.ok(nodes.some((node) => attr(node, "data-waitlist-challenge") !== undefined));
    }
  }
});

test("a configured privacy notice renders identity, contact and provider links, and consent choices", async () => {
  const { text, links } = await renderPage("privacy", {
    PUBLIC_WAITLIST_ENABLED: "true",
    PUBLIC_WAITLIST_CONTROLLER_NAME: "Example Maintainer",
    PUBLIC_WAITLIST_CONTACT_ADDRESS: "Example Street 1, Bucharest",
  });
  assert.match(text, /Example Maintainer administers the waitlist personally/);
  assert.match(text, /Example Street 1, Bucharest/);
  assert.match(text, /What we collect and why/);
  assert.match(
    text,
    /withdraw email consent at any time using the unsubscribe link/,
  );
  assert.match(
    text,
    /does not affect previous lawful processing or remove your early offer eligibility/,
  );
  assert.doesNotMatch(text, /Waitlist signup is not open yet/);
  for (const link of [
    "mailto:waitlist@awc-ui.dev",
    "https://www.netlify.com/privacy/",
    "https://www.cloudflare.com/cloudflare-customer-dpa/",
    "https://www.godaddy.com/en-uk/legal/agreements/data-processing-addendum",
    "https://www.dataprotection.ro/",
  ]) {
    assert.ok(
      links.includes(link),
      `privacy contact/resource is reachable: ${link}`,
    );
  }
});

test("public controller details render as text even if configured with HTML", async () => {
  const name = "Maintainer </p><script>globalThis.injected=true</script>";
  const address =
    '<img src=x onerror="alert(1)"> & <a href="https://evil.example/">address</a>';
  const { nodes, text, links } = await renderPage("privacy", {
    PUBLIC_WAITLIST_ENABLED: "true",
    PUBLIC_WAITLIST_CONTROLLER_NAME: name,
    PUBLIC_WAITLIST_CONTACT_ADDRESS: address,
  });
  assert.ok(text.includes(name));
  assert.ok(text.includes(address));
  assert.ok(
    !nodes.some(
      (node) =>
        node.tagName === "img" ||
        (node.tagName === "script" &&
          !node.attrs.some(
            (attribute) =>
              attribute.name === "type" &&
              attribute.value === "application/ld+json",
          )),
    ),
  );
  assert.ok(
    !nodes.some((node) =>
      node.attrs?.some((attribute) => attribute.name.startsWith("on")),
    ),
  );
  assert.ok(
    links.every(
      (link) => new URL(link, "https://awc-ui.dev").hostname !== "evil.example",
    ),
  );
});

test("the offer page limits the discount to the first annual Data Grid purchase and the launch redemption window", async () => {
  const { text, links } = await renderPage("waitlist-terms");
  assert.match(text, /20% off your first annual Data Grid purchase/);
  assert.match(text, /first annual billing period only/);
  assert.match(text, /first 30 days after Data Grid’s commercial launch/);
  assert.match(text, /Renewals use the standard price/);
  assert.match(text, /Other future Pro products are not included/);
  assert.match(text, /No payment is taken, no subscription starts/);
  assert.match(
    text,
    /unsubscribe from waitlist emails without losing your early offer eligibility/,
  );
  assert.ok(links.includes("/privacy/"));
  assert.ok(links.includes("mailto:waitlist@awc-ui.dev"));
});
