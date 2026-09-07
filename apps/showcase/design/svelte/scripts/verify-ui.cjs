const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { createRequire } = require("module");
const repo = path.resolve(__dirname, "../../../../.."),
  app = path.resolve(__dirname, "..");
const req = createRequire(repo + "/apps/showcase/design/svelte/package.json"),
  coreReq = createRequire(repo + "/packages/core/package.json");
(async () => {
  const { JSDOM } = coreReq("jsdom"),
    dom = new JSDOM('<div id="root"></div>', {
      url: "https://pictor.test/showcase/design/svelte/",
    });
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "SVGElement",
    "Element",
    "Node",
    "Event",
    "CustomEvent",
    "KeyboardEvent",
    "MouseEvent",
    "localStorage",
    "customElements",
    "location",
    "history",
  ])
    Object.defineProperty(global, key, {
      value: dom.window[key],
      configurable: true,
      writable: true,
    });
  window.matchMedia = global.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  window.scrollTo = () => {};
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  global.requestAnimationFrame = window.requestAnimationFrame = (cb) =>
    setTimeout(cb, 0);
  global.cancelAnimationFrame = window.cancelAnimationFrame = clearTimeout;
  // Mirror the lazy dialog boundary: slotted inputs cannot receive focus
  // before the initial shadow render, and initial open=true emits no mdOpen.
  class LazyDialog extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode:'open'});
      this.ready=false;
      this.readiness=new Promise(resolve=>{this.resolveReady=resolve});
    }
    componentOnReady(){return this.readiness}
    hydrateForTest(){
      this.shadowRoot.innerHTML='<div><slot></slot><slot name="actions"></slot></div>';
      this.ready=true;
      this.resolveReady(this);
    }
  }
  customElements.define('md-dialog',LazyDialog);
  const nativeFocus=HTMLElement.prototype.focus;
  HTMLElement.prototype.focus=function(options){
    const owner=this.closest('md-dialog');
    if(owner&&!owner.ready)return;
    nativeFocus.call(this,options);
  };
  const esbuild = coreReq("esbuild"),
    compiler = req("svelte/compiler");
  const result = await esbuild.build({
    stdin: {
      contents: `export {default as App} from '${app}/src/App.svelte';export {model} from '${app}/src/lib/document';export {navigate} from '${app}/src/lib/router';export {pictorText} from '@awc-ui/pictor-model';export {setShowcaseState} from '@awc-ui/showcase-kit/dock';export {tick} from 'svelte';`,
      resolveDir: app,
    },
    bundle: true,
    format: "cjs",
    write: false,
    conditions: ["browser"],
    mainFields: ["svelte", "browser", "module", "main"],
    loader: { ".css": "empty" },
    logLevel: "silent",
    plugins: [
      {
        name: "svelte",
        setup(build) {
          build.onResolve({ filter: /^\$lib\// }, (a) => {
            const target = app + "/src/lib/" + a.path.slice(5);
            return { path: fs.existsSync(target) ? target : target + ".ts" };
          });
          build.onLoad({ filter: /\.svelte$/ }, async (a) => {
            const raw = fs.readFileSync(a.path, "utf8");
            const source = await compiler.preprocess(
              raw,
              {
                script: async ({ content, attributes }) =>
                  attributes.lang === "ts"
                    ? {
                        code: (
                          await esbuild.transform(content, {
                            loader: "ts",
                            tsconfigRaw: {
                              compilerOptions: { verbatimModuleSyntax: true },
                            },
                          })
                        ).code,
                      }
                    : undefined,
              },
              { filename: a.path },
            );
            const output = compiler.compile(source.code, {
              filename: a.path,
              generate: "dom",
              css: "external",
            });
            return {
              contents: output.js.code,
              loader: "js",
              resolveDir: path.dirname(a.path),
            };
          });
        },
      },
    ],
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    req,
    mod,
    mod.exports,
  );
  const { App, model, navigate, pictorText, setShowcaseState, tick } =
    mod.exports;
  const instance = new App({ target: document.getElementById("root") });
  const settle = async () => {
    await tick();
    await tick();
  };
  await settle();
  const md = async (target, name, detail) => {
    assert(target);
    target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
    await settle();
  };
  const group = document.querySelector(".pictor-filterbar md-button-group");
  assert(group);
  assert.equal(group.selectionMode, "single-select");
  assert.equal(group.required, true);
  await md(group, "mdSelectionChange", { values: ["favorites"] });
  assert.equal(group.querySelector('[value="favorites"]').selected, true);
  await md(group, "mdSelectionChange", { values: [] });
  assert.equal(group.querySelector('[value="favorites"]').selected, true);
  await md(group, "mdSelectionChange", { values: ["all"] });
  console.log("PASS Svelte required single-selection file button group");
  const trigger=document.querySelector('.pictor-command-trigger');
  const clickTrigger=async()=>{trigger.focus();trigger.click();await settle()};
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  await clickTrigger();
  const abandonedDialog=document.querySelector('.pictor-command-dialog');
  assert.equal(document.activeElement,trigger,'unhydrated slotted input is not focusable');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));
  await settle();
  abandonedDialog.hydrateForTest();await settle();await nextFrame();
  assert.equal(document.activeElement,trigger,'closed dialog does not steal focus when lazy loading completes');
  await clickTrigger();
  const palette=document.querySelector('.pictor-command-dialog');
  palette.hydrateForTest();await settle();await nextFrame();
  const input = document.querySelector(".pictor-command-search input"),
    list = document.querySelector(".pictor-command-results");
  assert.equal(document.activeElement,input,'real command trigger focuses search after lazy dialog readiness');
  console.log('PASS Svelte command trigger focus after lazy initial-open dialog rendering');
  list.getBoundingClientRect = () => ({ top: 100, bottom: 300 });
  [...list.querySelectorAll('[role="option"]')].forEach((option, index) => {
    assert.equal(option.tabIndex, -1);
    option.getBoundingClientRect = () => ({
      top: 100 + index * 50 - list.scrollTop,
      bottom: 150 + index * 50 - list.scrollTop,
    });
  });
  for (let i = 0; i < 9; i++) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
  }
  assert.equal(input.getAttribute("aria-activedescendant"), "pictor-command-9");
  assert(list.scrollTop > 0);
  assert.equal(document.activeElement, input);
  for (let i = 0; i < 9; i++) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
  }
  assert.equal(list.scrollTop, 0);
  input.value = "no-such-command-xyz";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  await settle();
  assert.equal(input.getAttribute("aria-activedescendant"), null);
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  assert.equal(input.getAttribute("aria-activedescendant"), "pictor-command-0");
  console.log(
    "PASS Svelte command scrolling, search focus, empty result clamp",
  );
  const names = model.getSnapshot().layers.map((l) => l.name);
  setShowcaseState({ locale: "ar", dir: "rtl" });
  await settle();
  assert.equal(
    document.querySelector("h1").textContent,
    pictorText("ar", "Your creative workspace"),
  );
  assert.equal(
    document.querySelector(".pictor-command-dialog").getAttribute("locale"),
    "ar",
  );
  assert.equal(
    document.querySelector(".pictor-command-dialog").getAttribute("headline"),
    pictorText("ar", "Go anywhere. Make something."),
  );
  assert.equal(
    group.querySelector('[value="all"]').textContent,
    pictorText("ar", "All files"),
  );
  assert.deepEqual(
    model.getSnapshot().layers.map((l) => l.name),
    names,
  );
  input.value = "مكونات";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  assert(
    [...document.querySelectorAll(".pictor-command-item")].some((node) =>
      node.textContent.includes(pictorText("ar", "Explore AWC components")),
    ),
  );
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settle();
  navigate("/editor/");
  await settle();
  model
    .getSnapshot()
    .select([
      model
        .getSnapshot()
        .layers.find((layer) => layer.kind !== "group" && !layer.locked).id,
    ]);
  await settle();
  assert.equal(
    document.querySelector("md-color-picker").getAttribute("locale"),
    "ar",
  );
  const help = document.querySelector(".studio-tool-help");
  assert(
    help?.textContent.includes(pictorText("ar", "Select & move")) ||
      document
        .querySelector('[data-tool="select"]')
        .getAttribute("aria-label")
        .includes(pictorText("ar", "Select and move")),
  );
  assert.equal(
    document.querySelector("md-number-field").getAttribute("locale"),
    "ar-u-nu-arab",
  );
  assert.equal(
    document
      .querySelector("md-number-field")
      .getAttribute("value-missing-label"),
    pictorText("ar", "Please enter a number."),
  );
  window.dispatchEvent(new CustomEvent("pictor:insert"));
  await settle();
  await md(
    document.querySelector("[data-insert-panel] md-text-field"),
    "mdInput",
    "button",
  );
  assert(document.querySelector('[data-insert-component="awc:button"]'));
  await md(
    document.querySelector("[data-insert-panel] md-text-field"),
    "mdInput",
    "زر",
  );
  assert(document.querySelector('[data-insert-component="awc:button"]'));
  if (!customElements.get("md-button"))
    customElements.define("md-button", class extends HTMLElement {});
  window.dispatchEvent(new CustomEvent("pictor:components"));
  await settle();
  await md(
    document.querySelector("[data-component-lens] md-text-field"),
    "mdInput",
    "زر",
  );
  assert(
    [...document.querySelectorAll(".component-lens__list code")].some(
      (node) => node.textContent === "md-button",
    ),
  );
  console.log(
    "PASS Svelte normalized Arabic search, bilingual Insert, Lens and number-field locale",
  );
  setShowcaseState({ locale: "en", dir: "ltr" });
  await settle();
  assert.equal(
    document.querySelector('[data-tool="select"]').getAttribute("aria-label"),
    "Select and move (V)",
  );
  console.log(
    "PASS Svelte reactive locale, dialog/tool labels and authored-name preservation",
  );
  instance.$destroy();
  dom.window.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
