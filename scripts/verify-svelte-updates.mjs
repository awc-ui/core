#!/usr/bin/env node
// Real Svelte 5 + Chromium: DSD adoption, cooperative class updates and first input.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(root + "/package.json");
const sr = createRequire(root + "/apps/example-sveltekit/package.json");
const core = createRequire(root + "/packages/core/package.json");
const { compile } = sr("svelte/compiler");
const { build } = core("esbuild");
const { renderToString } = core("./hydrate/index.js");
const { default: puppeteer } = await import(require.resolve("puppeteer"));
const { createPageTransform } = await import(
  root + "/packages/core/ssr/sveltekit.mjs"
);
const bundle = async (contents, platform = "browser", format = "iife") =>
  (
    await build({
      stdin: { contents, resolveDir: root + "/apps/example-sveltekit" },
      bundle: true,
      format,
      write: false,
      platform,
    })
  ).outputFiles[0].text;
const source = `<script>
let count=0;let show=true;let items=['a','b'];let text='server';let selected=true;let inputs=0;let changes=0;
function update(){count+=1;items=items[0]==='a'?['b','a','c']:['a','b'];}
</script>
<button id="update" on:click={update}>update</button>
<button id="toggle" on:click={()=>show=!show}>toggle</button>
<button id="reset" on:click={()=>{text='reset';selected=false}}>reset values</button>
<md-card id="card" class:updated={count>0} class:initial={count===0} variant={count?'outlined':'elevated'}>
 <span slot="headline">Revenue {count}</span>
 {#if show}<md-button id="conditional">Conditional {count}</md-button>{/if}
 {#each items as item (item)}<md-button data-item={item}>{item} {count}</md-button>{/each}
</md-card>
<md-text-field id="field" label="Name" value={text} on:mdInput={e=>{text=e.detail;inputs+=1}}></md-text-field>
<md-switch id="switch" class:updated={count>0} class:initial={count===0} selected={selected} on:mdChange={e=>{selected=e.detail.selected;changes+=1}}></md-switch>
<output id="state">{text}|{selected}|{inputs}|{changes}</output>`;
const entries = await bundle(
  "import '@awc-ui/core/components/md-card';import '@awc-ui/core/components/md-button';import '@awc-ui/core/components/md-text-field';import '@awc-ui/core/components/md-switch';window.componentsStarted=true;",
);
const modes = {};
for (const syntax of ["legacy", "property"]) {
  const src =
    syntax === "property"
      ? source
          .replaceAll("on:click=", "onclick=")
          .replaceAll("on:mdInput=", "onmdInput=")
          .replaceAll("on:mdChange=", "onmdChange=")
      : source;
  const ssr = compile(src, {
    generate: "server",
    css: "external",
    name: "Probe",
  }).js.code;
  const ssrBundle = await bundle(
    `${ssr}\nimport {render} from 'svelte/server';export const html=render(Probe).body;`,
    "node",
    "esm",
  );
  const { html } = await import(
    `data:text/javascript;base64,${Buffer.from(ssrBundle).toString("base64")}`
  );
  const transform = createPageTransform(async (html) => {
    const out = await renderToString(html, {
      fullDocument: true,
      serializeShadowRoot: "declarative-shadow-dom",
      removeScripts: false,
      removeHtmlComments: false,
    });
    assert(!out.diagnostics.some((d) => d.level === "error"));
    return out.html;
  });
  const full = `<!doctype html><html><head></head><body><div id="app">${html}</div></body></html>`;
  // Split inside attributes, Svelte comments and custom tags, one character per chunk.
  for (let i = 0; i < full.length - 1; i++)
    assert.equal(await transform({ html: full[i], done: false }), "");
  const rendered = await transform({ html: full.slice(-1), done: true });
  const client = compile(src, {
    generate: "client",
    css: "external",
    name: "Probe",
  }).js.code;
  const clientBundle = (client) => bundle(
    `${client}\nimport {hydrate,mount,unmount,flushSync} from 'svelte';import {createSvelteHydration} from '${root}/packages/core/ssr/sveltekit.mjs';const handoff=createSvelteHydration();let instance;window.mountProbe=()=>{handoff.capture(document);instance=hydrate(Probe,{target:document.getElementById('app'),recover:false});flushSync();handoff.restore();};window.remountProbe=async()=>{await unmount(instance);instance=mount(Probe,{target:document.getElementById('app')});flushSync();};window.flushProbe=flushSync;`,
  );
  modes[syntax] = { rendered, js: await clientBundle(client) };
  const initialClient = compile(src.replace('let selected=true', 'let selected=false'), {
    generate:'client', css:'external', name:'Probe',
  }).js.code;
  modes[`${syntax}-initial`] = { rendered, js: await clientBundle(initialClient) };
}
const server = createServer((request, response) => {
  const [path] = request.url.split("?");
  if (path === "/entries.js")
    return response
      .writeHead(200, { "Content-Type": "text/javascript" })
      .end(entries);
  const mode = path.split("/")[1].replace(/\.js$/, "");
  if (modes[mode] && path.endsWith(".js"))
    return response
      .writeHead(200, { "Content-Type": "text/javascript" })
      .end(modes[mode].js);
  if (modes[mode])
    return response
      .writeHead(200, { "Content-Type": "text/html" })
      .end(modes[mode].rendered);
  response.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox"],
});
const results = [];
try {
  for (const syntax of ["legacy", "property"])
    for (const inputTiming of ["after-runtime", "before-runtime"]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/${syntax}`, {
        waitUntil: "load",
      });
      await page.evaluate(() => {
        window.serverSwitch = document.querySelector("#switch");
        window.selectedThumbPosition = getComputedStyle(
          serverSwitch.shadowRoot.querySelector(".md-switch__handle-container"),
        ).left;
        window.serverCard = document.querySelector("#card");
        window.serverShadow = serverCard.shadowRoot;
        window.serverA = document.querySelector('[data-item="a"]');
        window.serverField = document.querySelector("#field");
        window.serverFieldShadow = serverField.shadowRoot;
      });
      await page.addScriptTag({ url: `/${syntax}.js` });
      await page.evaluate(() => window.mountProbe());
      assert(
        await page.evaluate(
          () =>
            document.querySelector("#card") === serverCard &&
            serverCard.shadowRoot === serverShadow,
        ),
        "SSR card identity",
      );
      if (inputTiming === "before-runtime") await page.click("#update");
      await page.addScriptTag({ url: "/entries.js" });
      await page.waitForFunction(
        () =>
          document.querySelector("#field").shadowRoot.querySelector("input") &&
          document
            .querySelector("#switch")
            .shadowRoot.querySelector('[part="track"]') &&
          document.querySelector("#card").hasAttribute("data-awc-motion-ready"),
      );
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      assert(
        await page.evaluate(
          () =>
            document.querySelector("#field") === serverField &&
            serverField.shadowRoot === serverFieldShadow,
        ),
        "SSR field identity",
      );
      assert.equal(
        await page.$eval("#state", (el) => el.textContent),
        "server|true|0|0",
        "initial events must not fire",
      );
      // Keyed reordering, conditional removal/recreation and slotted dynamic labels.
      if (inputTiming === "after-runtime") await page.click("#update");
      assert.deepEqual(
        await page.$$eval("[data-item]", (nodes) =>
          nodes.map((el) => el.textContent),
        ),
        ["b 1", "a 1", "c 1"],
      );
      assert(
        await page.evaluate(
          () => document.querySelector('[data-item="a"]') === serverA,
        ),
        "keyed item identity",
      );
      assert.equal(await page.$eval("#card", (el) => el.variant), "outlined");
      await page.waitForFunction(() =>
        document.querySelector("#card").classList.contains("md-card--outlined"),
      );
      assert(
        await page.$eval(
          "#switch",
          (el) =>
            el.selected &&
            el.getAttribute("aria-checked") === "true" &&
            el.classList.contains("md-switch--selected"),
        ),
        "application class update must preserve selected state",
      );
      assert(
        await page.evaluate(
          () =>
            getComputedStyle(
              document
                .querySelector("#switch")
                .shadowRoot.querySelector(".md-switch__handle-container"),
            ).left === selectedThumbPosition,
        ),
        "selected thumb must stay at its server-rendered position",
      );
      assert(
        await page.$eval(
          "#card",
          (el) =>
            el.classList.contains("updated") &&
            el.classList.contains("md-card"),
        ),
        "application and component classes must coexist",
      );
      await page.click("#toggle");
      assert.equal(await page.$("#conditional"), null);
      await page.click("#toggle");
      assert.equal(
        await page.$eval("#conditional", (el) => el.textContent),
        "Conditional 1",
      );
      await page.waitForFunction(() =>
        document
          .querySelector("#conditional")
          .shadowRoot?.querySelector('[part="label"]'),
      );
      const input = await page.evaluateHandle(() =>
        document.querySelector("#field").shadowRoot.querySelector("input"),
      );
      await input.click();
      await page.keyboard.press("End");
      await page.keyboard.type("!");
      await page.waitForFunction(
        () =>
          document.querySelector("#state").textContent === "server!|true|1|0",
      );
      const toggle = await page.$("#switch");
      await toggle.click();
      await page.waitForFunction(
        () =>
          document.querySelector("#state").textContent === "server!|false|1|1",
      );
      await page.click("#reset");
      await page.waitForFunction(
        () =>
          document.querySelector("#field").shadowRoot.querySelector("input")
            .value === "reset" && !document.querySelector("#switch").selected,
      );
      // A client route's unmount/mount must not replay the initial server snapshot.
      await page.evaluate(() => window.remountProbe());
      await page.waitForFunction(
        () =>
          document.querySelector("#field").shadowRoot?.querySelector("input")
            ?.value === "server",
      );
      assert(
        await page.evaluate(
          () => document.querySelector("#card") !== serverCard,
        ),
        "remount must create new route hosts",
      );
      await page.click("#update");
      assert.deepEqual(
        await page.$$eval("[data-item]", (nodes) =>
          nodes.map((el) => el.textContent),
        ),
        ["b 1", "a 1", "c 1"],
      );
      assert.deepEqual(errors, []);
      results.push({ syntax, inputTiming, passed: true });
      await page.close();
    }
  for (const syntax of ["legacy", "property"]) for (const timing of ["framework-first", "runtime-first"]) {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/${syntax}-initial`, {waitUntil:'load'});
    await page.evaluate(() => {
      window.originalSwitch = document.querySelector('#switch');
      window.originalSwitchShadow = originalSwitch.shadowRoot;
      window.initialAnimations = [];
      const sample = () => {
        initialAnimations.push(originalSwitch.getAnimations({subtree:true}).filter(animation => animation.playState === 'running').length);
        window.animationSample = requestAnimationFrame(sample);
      };
      sample();
    });
    await page.addScriptTag({url:`/${syntax}-initial.js`});
    if (timing === 'runtime-first') {
      await page.addScriptTag({url:'/entries.js'});
      await page.waitForFunction(() => originalSwitch.hasAttribute('data-awc-motion-ready'));
    }
    await page.evaluate(() => window.mountProbe());
    if (timing === 'framework-first') await page.addScriptTag({url:'/entries.js'});
    await page.waitForFunction(() => originalSwitch.hasAttribute('data-awc-motion-ready') && originalSwitch.selected === false && originalSwitch.getAttribute('aria-checked') === 'false');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const state = await page.evaluate(() => {
      cancelAnimationFrame(animationSample);
      return {same:document.querySelector('#switch') === originalSwitch && originalSwitch.shadowRoot === originalSwitchShadow,
        selected:originalSwitch.selected,aria:originalSwitch.getAttribute('aria-checked'),selectedClass:originalSwitch.classList.contains('md-switch--selected'),
        annotation:originalSwitch.hasAttribute('s-attrs'),state:document.querySelector('#state').textContent,animations:initialAnimations.some(Boolean)};
    });
    assert.deepEqual(state,{same:true,selected:false,aria:'false',selectedClass:false,annotation:false,state:'server|false|0|0',animations:false});
    await page.click('#switch');
    await page.waitForFunction(() => document.querySelector('#state').textContent === 'server|true|0|1');
    assert.deepEqual(errors,[]);
    results.push({syntax,timing,initialClientState:'false',passed:true});
    await page.close();
  }
  // Interleaved, async, distinct per-request transforms cannot leak data.
  const requests = Array.from({ length: 25 }, (_, id) =>
    createPageTransform(async (html) => {
      await new Promise((r) => setTimeout(r, (24 - id) % 4));
      return `R${id}:${html}`;
    }),
  );
  await Promise.all(
    requests.map((fn, id) => fn({ html: `<md-card>${id}`, done: false })),
  );
  const output = await Promise.all(
    requests.map((fn, id) => fn({ html: `/${id}</md-card>`, done: true })),
  );
  output.forEach((value, id) =>
    assert.equal(value, `R${id}:<md-card>${id}/${id}</md-card>`),
  );
  console.log(
    JSON.stringify(
      {
        svelte: sr("svelte/package.json").version,
        scenarios: results,
        streaming:
          "character-by-character split and 25 concurrent request buffers PASS",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
