#!/usr/bin/env node
/**
 * Fail a release/deploy when the public discovery surfaces drift or disappear.
 * Run after the docs build so apps/docs/dist contains the deployable site.
 */

import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const root = join(scriptDir, "..");
const dist = join(root, "apps/docs/dist");
const failures = [];
const warnings = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function localFileForUrl(url) {
  const { pathname } = new URL(url);
  const relative = pathname.replace(/^\//, "");
  return pathname.endsWith("/")
    ? join(dist, relative, "index.html")
    : join(dist, relative);
}

const publicPackages = [
  "core",
  "react",
  "angular",
  "vue",
  "svelte",
  "theme",
  "tokens",
];
const requiredNpmKeywords = {
  core: [
    "web-component",
    "web-components",
    "react-component",
    "react-components",
    "angular-component",
    "angular-components",
    "vue-component",
    "vue-components",
    "svelte-component",
    "svelte-components",
    "server-side-rendering",
  ],
  react: [
    "react-component",
    "react-components",
    "react-web-components",
    "react-ssr",
    "nextjs",
    "server-side-rendering",
  ],
  angular: [
    "angular-component",
    "angular-components",
    "angular-web-components",
    "angular-ssr",
    "server-side-rendering",
  ],
  vue: [
    "vue-component",
    "vue-components",
    "vue-web-components",
    "vue-ssr",
    "nuxt",
    "server-side-rendering",
  ],
  svelte: [
    "svelte-component",
    "svelte-components",
    "svelte-web-components",
    "sveltekit",
    "server-side-rendering",
  ],
};
for (const packageName of publicPackages) {
  const packageDir = join(root, "packages", packageName);
  const manifest = await json(join(packageDir, "package.json"));
  check(
    typeof manifest.description === "string" &&
      manifest.description.length >= 70,
    `@awc-ui/${packageName}: description is missing or too generic`,
  );
  check(
    Array.isArray(manifest.keywords) && manifest.keywords.length >= 8,
    `@awc-ui/${packageName}: add at least eight specific npm search keywords`,
  );
  for (const keyword of requiredNpmKeywords[packageName] ?? []) {
    check(
      manifest.keywords?.includes(keyword),
      `@awc-ui/${packageName}: required npm search keyword "${keyword}" is missing`,
    );
  }
  check(
    /^https:\/\/awc-ui\.dev/.test(manifest.homepage ?? ""),
    `@awc-ui/${packageName}: homepage is missing`,
  );
  check(
    manifest.repository?.url === "git+https://github.com/awc-ui/core.git",
    `@awc-ui/${packageName}: repository must identify the canonical GitHub repo`,
  );
  check(
    manifest.license === "MIT",
    `@awc-ui/${packageName}: SPDX license is missing`,
  );
  check(
    await exists(join(packageDir, "README.md")),
    `@awc-ui/${packageName}: npm README is missing`,
  );
}

const corePackage = await json(join(root, "packages/core/package.json"));
check(
  corePackage.customElements === "./custom-elements.json",
  "@awc-ui/core: customElements pointer is missing",
);
check(
  corePackage.exports?.["./customElements"],
  "@awc-ui/core: ./customElements export is missing",
);
check(
  corePackage.files?.includes("custom-elements.json"),
  "@awc-ui/core: custom-elements.json is not publishable",
);

const customElements = await json(
  join(root, "packages/core/custom-elements.json"),
);
const componentDirs = (
  await readdir(join(root, "packages/core/src/components"), {
    withFileTypes: true,
  })
)
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const manifestTags = customElements.modules
  .flatMap((module) => module.declarations ?? [])
  .map((declaration) => declaration.tagName)
  .filter(Boolean)
  .sort();
check(
  customElements.schemaVersion === "1.0.0",
  "custom-elements.json: unsupported or missing schemaVersion",
);
check(
  JSON.stringify(componentDirs) === JSON.stringify(manifestTags),
  `custom-elements.json: expected ${componentDirs.length} source elements, found ${manifestTags.length}`,
);
check(
  new Set(manifestTags).size === manifestTags.length,
  "custom-elements.json: duplicate tag declarations",
);

check(
  await exists(join(root, "CITATION.cff")),
  "GitHub citation metadata is missing",
);
check(
  await exists(dist),
  "apps/docs/dist is missing; build the docs before running verify:discovery",
);

if (await exists(dist)) {
  const robots = await readFile(join(dist, "robots.txt"), "utf8");
  check(
    /User-agent:\s*\*/i.test(robots) && /Allow:\s*\//i.test(robots),
    "robots.txt does not allow crawling",
  );
  check(
    /Sitemap:\s*https:\/\/awc-ui\.dev\/sitemap-index\.xml/i.test(robots),
    "robots.txt does not advertise the sitemap",
  );

  const llmsPath = join(dist, "llms.txt");
  const llmsFullPath = join(dist, "llms-full.txt");
  check(await exists(llmsPath), "/llms.txt is missing from the site build");
  check(
    await exists(llmsFullPath),
    "/llms-full.txt is missing from the site build",
  );
  if (await exists(llmsPath)) {
    const llms = await readFile(llmsPath, "utf8");
    check(
      llms.startsWith("# AWC UI\n"),
      "/llms.txt must start with a single H1",
    );
    check(
      llms.includes("/llm/awc-ui.main-llm.md"),
      "/llms.txt does not link the canonical LLM specification",
    );
    check(
      llms.includes("@awc-ui/core"),
      "/llms.txt does not identify the npm package",
    );
    for (const term of [
      "React components and Next.js SSR",
      "Angular components and Angular SSR",
      "Vue components and Nuxt SSR",
      "Svelte components and SvelteKit SSR",
    ]) {
      check(llms.includes(term), `/llms.txt does not identify ${term}`);
    }
    for (const match of llms.matchAll(/https:\/\/awc-ui\.dev[^)\s]+/g)) {
      const url = match[0];
      check(
        await exists(localFileForUrl(url)),
        `/llms.txt links a missing local resource: ${url}`,
      );
    }
  }
  if (await exists(llmsFullPath)) {
    const llmsFull = await readFile(llmsFullPath, "utf8");
    check(
      (await stat(llmsFullPath)).size > 20_000,
      "/llms-full.txt is unexpectedly small",
    );
    check(
      !llmsFull.includes("./packages/core/src/components/"),
      "/llms-full.txt still contains repository-relative component links",
    );
    check(
      llmsFull.includes("https://awc-ui.dev/components/button/readme.md"),
      "/llms-full.txt does not expose fetchable component-manual links",
    );
  }

  const sitemapIndex = await readFile(join(dist, "sitemap-index.xml"), "utf8");
  const sitemapUrls = [...sitemapIndex.matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (match) => match[1],
  );
  check(sitemapUrls.length > 0, "sitemap-index.xml contains no child sitemaps");

  const pageUrls = [];
  for (const sitemapUrl of sitemapUrls) {
    const sitemapFile = join(
      dist,
      new URL(sitemapUrl).pathname.replace(/^\//, ""),
    );
    const sitemap = await readFile(sitemapFile, "utf8");
    pageUrls.push(
      ...[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
    );
  }
  check(
    pageUrls.length >= 100,
    `sitemap contains only ${pageUrls.length} pages`,
  );
  check(pageUrls.includes("https://awc-ui.dev/llm/"), "sitemap omits /llm/");
  check(
    pageUrls.includes("https://awc-ui.dev/theme-generator/"),
    "sitemap omits /theme-generator/",
  );
  for (const route of [
    "/frameworks/web-components/",
    "/frameworks/react/",
    "/frameworks/angular/",
    "/frameworks/vue/",
    "/frameworks/svelte/",
    "/frameworks/ssr/",
  ]) {
    check(
      pageUrls.includes(`https://awc-ui.dev${route}`),
      `sitemap omits ${route}`,
    );
  }

  const titles = new Map();
  const canonicals = new Set();
  for (const pageUrl of pageUrls) {
    const htmlPath = localFileForUrl(pageUrl);
    check(await exists(htmlPath), `sitemap URL has no built page: ${pageUrl}`);
    if (!(await exists(htmlPath))) continue;
    const html = await readFile(htmlPath, "utf8");
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    const canonical = html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i,
    )?.[1];
    check(Boolean(title), `${pageUrl}: title is missing`);
    check(
      /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+/i.test(html),
      `${pageUrl}: meta description is missing`,
    );
    check(
      canonical === pageUrl,
      `${pageUrl}: canonical is missing or does not match (${canonical ?? "none"})`,
    );
    check(
      /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*index/i.test(html),
      `${pageUrl}: indexable robots policy is missing`,
    );
    check(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']https:\/\//i.test(
        html,
      ),
      `${pageUrl}: absolute Open Graph image is missing`,
    );
    check(
      html.includes('type="application/ld+json"'),
      `${pageUrl}: JSON-LD structured data is missing`,
    );
    for (const jsonLd of html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi,
    )) {
      try {
        JSON.parse(jsonLd[1]);
      } catch (error) {
        failures.push(`${pageUrl}: invalid JSON-LD (${error.message})`);
      }
    }
    if (title) {
      const sameTitle = titles.get(title) ?? [];
      sameTitle.push(pageUrl);
      titles.set(title, sameTitle);
    }
    if (canonical) {
      check(
        !canonicals.has(canonical),
        `${pageUrl}: duplicate canonical ${canonical}`,
      );
      canonicals.add(canonical);
    }
  }

  for (const [title, urls] of titles) {
    if (urls.length > 1)
      failures.push(`duplicate page title "${title}": ${urls.join(", ")}`);
  }

  const sourceFiles = await readdir(join(root, "apps/docs/src/content/docs"), {
    recursive: true,
  });
  for (const relative of sourceFiles.filter((file) => /\.mdx?$/.test(file))) {
    const source = await readFile(
      join(root, "apps/docs/src/content/docs", relative),
      "utf8",
    );
    const description =
      source.match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? "";
    if (description.length < 50 || description.length > 180) {
      warnings.push(
        `${relative}: description length ${description.length} (recommended 50–180)`,
      );
    }
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);

if (failures.length) {
  console.error(`\nDiscovery verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `✓ discovery: ${publicPackages.length} npm packages, ${manifestTags.length} custom elements, crawl + AI endpoints, metadata, structured data, and sitemap`,
);
