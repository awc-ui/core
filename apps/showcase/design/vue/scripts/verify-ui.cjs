const { createRequire } = require("module"),
  path = require("path"),
  fs = require("fs"),
  assert = require("assert/strict");
const repo = path.resolve(__dirname, "../../../../.."),
  app = path.resolve(__dirname, "..");
const req = createRequire(repo + "/apps/showcase/design/vue/package.json"),
  coreReq = createRequire(repo + "/packages/core/package.json");
(async () => {
  const { JSDOM } = coreReq("jsdom"),
    dom = new JSDOM('<div id="root"></div>', {
      url: "https://pictor.test/showcase/design/vue/",
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
  let frames = [];
  global.requestAnimationFrame = window.requestAnimationFrame = (cb) => (
    frames.push(cb),
    frames.length
  );
  global.cancelAnimationFrame = window.cancelAnimationFrame = () => {};
  const captures = new WeakMap();
  HTMLElement.prototype.setPointerCapture = function (id) {
    captures.set(this, id);
  };
  HTMLElement.prototype.hasPointerCapture = function (id) {
    return captures.get(this) === id;
  };
  HTMLElement.prototype.releasePointerCapture = function () {
    captures.delete(this);
  };
  const vueCompiler = req("vue/compiler-sfc");
  const result = await coreReq("esbuild").build({
    stdin: {
      contents: `export {default as App} from '${app}/src/App.vue';export {useDocument,disposeDocument} from '${app}/src/composables/useDocument';export {useRouter} from '${app}/src/lib/router';export {awcDirective} from '${app}/src/lib/awc';export {createLayer,pictorText} from '@awc-ui/pictor-model';export {setShowcaseState} from '@awc-ui/showcase-kit/dock';`,
      resolveDir: app,
    },
    logOverride: { "ignored-bare-import": "silent" },
    bundle: true,
    format: "cjs",
    write: false,
    external: ["vue"],
    loader: { ".css": "empty" },
    plugins: [
      {
        name: "vue",
        setup(build) {
          build.onResolve({ filter: /^[~@]\// }, (a) => {
            const target = app + "/src/" + a.path.slice(2);
            return { path: fs.existsSync(target) ? target : target + ".ts" };
          });
          build.onLoad({ filter: /\.vue$/ }, (a) => {
            const { descriptor } = vueCompiler.parse(
              fs.readFileSync(a.path, "utf8"),
              {
                filename: a.path,
                templateParseOptions: {
                  isCustomElement: (t) =>
                    t.startsWith("md-") || t.startsWith("awc-"),
                },
              },
            );
            descriptor.template.ast = undefined;
            return {
              contents: vueCompiler.compileScript(descriptor, {
                id: "test",
                inlineTemplate: true,
                templateOptions: {
                  compilerOptions: {
                    isCustomElement: (t) =>
                      t.startsWith("md-") || t.startsWith("awc-"),
                  },
                },
              }).content,
              loader: "ts",
              resolveDir: path.dirname(a.path),
            };
          });
        },
      },
    ],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    req,
    module,
    module.exports,
  );
  const {
    App,
    useDocument,
    useRouter,
    awcDirective,
    createLayer,
    disposeDocument,
  } = module.exports;
  const { createApp, nextTick } = req("vue");
  const errors = [];
  const instance = createApp(App);
  instance.config.errorHandler = (e) => errors.push(e);
  instance.config.warnHandler = (message) => errors.push(new Error(message));
  instance.directive("awc", awcDirective);
  instance.mount(document.querySelector("#root"));
  const doc = useDocument(),
    router = useRouter();
  const settle = async () => {
    await nextTick();
    const callbacks = frames;
    frames = [];
    callbacks.forEach((cb) => cb());
    await nextTick();
    if (errors.length) throw errors.shift();
  };
  await settle();
  for (const route of [
    "/",
    "/assets/",
    "/profile/",
    "/editor/",
    "/p/atlas-mobile/",
    "/a/unknown/",
    "/f/unknown/",
    "/bad/",
  ]) {
    router.push(route);
    await settle();
    assert(document.querySelector("h1")?.textContent, "route " + route);
    console.log("PASS route", route, document.querySelector("h1").textContent);
  }
  router.push("/editor/");
  await settle();
  assert(document.querySelector(".artboard"));
  console.log("PASS editor native mount");
  const click = async (target) => {
    assert(target, "click target");
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await settle();
  };
  const md = async (target, name, detail) => {
    assert(target, "event target " + name);
    target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
    await settle();
  };
  await click(document.querySelector('[data-tool="image"]'));
  assert.equal(doc.tool, "image");
  assert(document.querySelector(".studio-insert"));
  assert(document.querySelector(".studio-art-grid"));
  console.log("PASS image selects tool and opens insert");
  window.dispatchEvent(new CustomEvent("pictor:commands"));
  await settle();
  assert(document.querySelector(".pictor-command-dialog"));
  let input = document.querySelector(".pictor-command-search input");
  input.value = "export";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  assert.equal(document.querySelectorAll(".pictor-command-item").length, 1);
  console.log("PASS command palette live search");
  await click(document.querySelector(".pictor-command-item"));
  assert(document.querySelector(".studio-dialog"));
  console.log("PASS command opens export dialog");
  await md(document.querySelector(".studio-dialog"), "mdCancel", undefined);
  await settle();
  function geometry() {
    const board = document.querySelector(".artboard");
    board.getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      width: 480,
      height: 320,
    });
    const viewport = document.querySelector(".canvas-scroll");
    viewport.getBoundingClientRect = () => ({ width: 760, height: 600 });
    for (const [key, value] of Object.entries({
      clientWidth: 760,
      clientHeight: 600,
      scrollWidth: 1500,
      scrollHeight: 1100,
    }))
      Object.defineProperty(viewport, key, { configurable: true, value });
  }
  const pointer = async (target, type, x, y, extra = {}) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      ...extra,
    });
    Object.defineProperty(event, "pointerId", { value: extra.pointerId ?? 1 });
    target.dispatchEvent(event);
    await settle();
  };
  const reset = async (layers = [], selection = [], tool = "select") => {
    doc.replaceCanvas(layers);
    doc.select(selection);
    doc.setTool(tool);
    await settle();
    geometry();
  };
  const layer = (id, rect, kind = "rect", parentId = null) =>
    createLayer(kind, rect, { id, name: id, parentId, fill: "#203D35" });
  await reset([], [], "rect");
  let board = document.querySelector(".artboard"),
    viewport = document.querySelector(".canvas-scroll");
  await pointer(board, "pointerdown", 125, 135);
  await pointer(viewport, "pointermove", 126, 136);
  await pointer(viewport, "pointerup", 126, 136);
  assert.deepEqual(doc.layers[0].rect, { x: 2, y: 3, w: 12, h: 10 });
  console.log("PASS draw click creates useful default");
  doc.undo();
  await settle();
  assert.equal(doc.layers.length, 0);
  doc.redo();
  await settle();
  assert.equal(doc.layers.length, 1);
  console.log("PASS history undo/redo updates Vue");
  await reset([], [], "rect");
  await pointer(board, "pointerdown", 305, 305);
  await pointer(viewport, "pointermove", 205, 355, { shiftKey: true });
  await pointer(viewport, "pointerup", 205, 355, { shiftKey: true });
  assert.deepEqual(doc.layers[0].rect, { x: 15, y: 20, w: 6, h: 6 });
  console.log("PASS reverse Shift drawing");
  const a = layer("a", { x: 2, y: 2, w: 4, h: 4 }),
    b = layer("b", { x: 10, y: 10, w: 3, h: 3 });
  await reset([a, b], ["a"]);
  await pointer(
    document.querySelector('.artboard [data-layer="a"]'),
    "pointerdown",
    130,
    130,
    { shiftKey: true },
  );
  assert.deepEqual(doc.selection, []);
  await pointer(
    document.querySelector('.artboard [data-layer="a"]'),
    "pointerdown",
    130,
    130,
  );
  await pointer(viewport, "pointerup", 130, 130);
  await pointer(
    document.querySelector('.artboard [data-layer="b"]'),
    "pointerdown",
    205,
    205,
    { shiftKey: true },
  );
  await pointer(viewport, "pointerup", 205, 205);
  assert.deepEqual(doc.selection, ["a", "b"]);
  console.log("PASS additive selection");
  const group = layer("g", { x: 2, y: 2, w: 10, h: 10 }, "group"),
    child = layer("child", { x: 3, y: 3, w: 2, h: 2 }, "rect", "g");
  await reset([group, child], ["g"]);
  await pointer(
    document.querySelector('[data-corner="se"]'),
    "pointerdown",
    220,
    220,
  );
  await pointer(viewport, "pointermove", 320, 320);
  await pointer(viewport, "pointerup", 320, 320);
  assert.deepEqual(doc.layers[0].rect, { x: 2, y: 2, w: 20, h: 20 });
  assert.deepEqual(doc.layers[1].rect, { x: 4, y: 4, w: 4, h: 4 });
  console.log("PASS group resize updates descendants");
  await reset([group, child], ["g"]);
  await pointer(
    document.querySelector('.artboard [data-layer="child"]'),
    "pointerdown",
    135,
    135,
  );
  await pointer(viewport, "pointermove", 165, 155);
  await pointer(viewport, "pointerup", 165, 155);
  assert.deepEqual(doc.selection, ["g"]);
  assert.deepEqual(doc.layers[1].rect, { x: 6, y: 5, w: 2, h: 2 });
  console.log("PASS group member drag");
  await reset([a], [], "hand");
  viewport.scrollLeft = 370;
  viewport.scrollTop = 250;
  await pointer(viewport, "pointerdown", 50, 50);
  await pointer(viewport, "pointermove", 110, 10);
  await pointer(viewport, "pointerup", 110, 10);
  assert.equal(viewport.scrollLeft, 310);
  assert.equal(viewport.scrollTop, 290);
  console.log("PASS workspace pan");
  const text = layer("double-click-text", { x: 2, y: 2, w: 8, h: 4 }, "text");
  await reset([text], []);
  await click(document.querySelector('[aria-label="Toggle inspector"]'));
  assert.equal(document.querySelector("[data-editor]").dataset.right, "closed");
  viewport.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, clientX: 130, clientY: 130 }),
  );
  await settle();
  assert.equal(document.querySelector("[data-editor]").dataset.right, "open");
  assert.deepEqual(doc.selection, ["double-click-text"]);
  await click(document.querySelector('[aria-label="Toggle inspector"]'));
  viewport.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, clientX: 50, clientY: 50 }),
  );
  await settle();
  assert.equal(document.querySelector("[data-editor]").dataset.right, "closed");
  doc.toggleLocked(text.id);
  await settle();
  viewport.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, clientX: 130, clientY: 130 }),
  );
  await settle();
  assert.equal(document.querySelector("[data-editor]").dataset.right, "closed");
  doc.toggleLocked(text.id);
  await settle();
  const cover = {
    ...layer("text-cover", { x: 2, y: 2, w: 8, h: 4 }),
    order: 9999,
  };
  doc.commitLayers("create", (layers) => [...layers, cover]);
  await settle();
  viewport.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, clientX: 130, clientY: 130 }),
  );
  await settle();
  assert.equal(document.querySelector("[data-editor]").dataset.right, "closed");
  console.log(
    "PASS captured viewport double-click inspects only visible unobscured unlocked text",
  );

  await reset([a], ["a"]);
  await md(
    document.querySelector("[data-name-field]"),
    "mdChange",
    "A new name",
  );
  assert.equal(doc.layers[0].name, "A new name");
  assert.equal(document.querySelector("[data-name-field]").value, "A new name");
  console.log("PASS text control event commits and reflects");
  await md(document.querySelector('[data-geometry="w"]'), "mdChange", {
    value: 200,
  });
  assert.equal(doc.layers[0].rect.w, 10);
  assert.equal(document.querySelector('[data-geometry="w"]').value, 200);
  console.log("PASS number control updates geometry");
  const slider = document.querySelector("[data-inspector] md-slider");
  await md(slider, "mdInput", 50);
  assert.equal(doc.layers[0].opacity, 100);
  await md(slider, "mdChange", 50);
  assert.equal(doc.layers[0].opacity, 50);
  doc.undo();
  await settle();
  assert.equal(slider.value, 100);
  console.log("PASS slider preview/commit and undo reflection");
  await md(
    document.querySelector("[data-blend-select]"),
    "mdChange",
    "multiply",
  );
  assert.equal(doc.layers[0].blend, "multiply");
  console.log("PASS select custom event");
  await md(
    document.querySelector("[data-inspector] md-color-picker"),
    "mdChange",
    { value: "#123456" },
  );
  assert.equal(doc.layers[0].fill, "#123456");
  console.log("PASS color picker custom event");
  const inspectorTabs = document.querySelector("[data-inspector] md-tabs");
  await md(inspectorTabs, "mdTabChange", { index: 1 });
  assert(document.querySelector(".studio-code"));
  await md(inspectorTabs, "mdTabChange", { index: 0 });
  assert(document.querySelector("[data-name-field]"));
  console.log("PASS panel tab event changes content");
  window.dispatchEvent(new CustomEvent("pictor:insert"));
  await settle();
  await click(document.querySelector('[data-insert-component="awc:button"]'));
  assert.equal(doc.layers.at(-1).componentId, "awc:button");
  console.log("PASS live UI insertion");
  window.dispatchEvent(new CustomEvent("pictor:present"));
  await settle();
  const present = document.querySelector(".studio-presentation");
  assert(present);
  const live = [...present.querySelectorAll("md-button")].find(
    (e) => e.textContent === "Continue",
  );
  const liveButton = live ?? present.querySelector(".layer__live md-button");
  await click(liveButton);
  assert.equal(liveButton.textContent, "You made it happen!");
  await md(document.querySelector(".studio-dialog"), "mdClose", undefined);
  console.log("PASS presentation interaction and close");
  assert(doc.save());
  const saved = JSON.parse(localStorage.getItem("awc:pictor:documents:v1"));
  assert(
    saved.documents[doc.fileId].layers.some(
      (layer) => layer.name === "A new name",
    ),
  );
  console.log("PASS persisted edited document");
  router.push("/");
  await settle();
  const fileGroup = document.querySelector(".pictor-filterbar md-button-group");
  assert(fileGroup, "File filters use md-button-group");
  assert.equal(fileGroup.selectionMode, "single-select");
  assert.equal(fileGroup.required, true);
  await md(fileGroup, "mdSelectionChange", { values: ["favorites"] });
  assert.equal(fileGroup.querySelector('[value="favorites"]').selected, true);
  await md(fileGroup, "mdSelectionChange", { values: [] });
  assert.equal(fileGroup.querySelector('[value="favorites"]').selected, true);
  await md(fileGroup, "mdSelectionChange", { values: ["all"] });
  assert.equal(fileGroup.querySelector('[value="all"]').selected, true);
  console.log("PASS required single-selection file button group");

  window.dispatchEvent(new CustomEvent("pictor:commands"));
  await settle();
  const commandSearch = document.querySelector(".pictor-command-search input");
  const commandList = document.querySelector(".pictor-command-results");
  commandSearch.focus();
  commandList.getBoundingClientRect = () => ({ top: 100, bottom: 300 });
  [...commandList.querySelectorAll('[role="option"]')].forEach(
    (option, index) => {
      assert.equal(option.tabIndex, -1);
      option.getBoundingClientRect = () => ({
        top: 100 + index * 50 - commandList.scrollTop,
        bottom: 150 + index * 50 - commandList.scrollTop,
      });
    },
  );
  for (let index = 0; index < 9; index++) {
    commandSearch.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
  }
  assert.equal(
    commandSearch.getAttribute("aria-activedescendant"),
    "pictor-command-9",
  );
  assert(commandList.scrollTop > 0, "active command scrolled within results");
  assert.equal(document.activeElement, commandSearch, "search retains focus");
  for (let index = 0; index < 9; index++) {
    commandSearch.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
  }
  assert.equal(commandList.scrollTop, 0);
  commandSearch.value = "no-such-command-xyz";
  commandSearch.dispatchEvent(new Event("input", { bubbles: true }));
  commandSearch.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle();
  assert.equal(commandSearch.getAttribute("aria-activedescendant"), null);
  commandSearch.value = "";
  commandSearch.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  assert.equal(
    commandSearch.getAttribute("aria-activedescendant"),
    "pictor-command-0",
  );
  console.log(
    "PASS command keyboard scroll, retained focus, and empty result clamp",
  );
  const authoredNames = doc.layers.map((layer) => layer.name);
  module.exports.setShowcaseState({ locale: "ar", dir: "rtl" });
  await settle();
  assert.equal(
    document.querySelector("h1").textContent,
    module.exports.pictorText("ar", "Your creative workspace"),
  );
  assert.equal(
    document.querySelector(".pictor-command-dialog").getAttribute("locale"),
    "ar",
  );
  assert.equal(
    document.querySelector(".pictor-command-dialog").getAttribute("headline"),
    module.exports.pictorText("ar", "Go anywhere. Make something."),
  );
  assert.deepEqual(
    doc.layers.map((layer) => layer.name),
    authoredNames,
    "locale change preserves authored content",
  );
  assert.equal(
    fileGroup.querySelector('[value="all"]').textContent,
    module.exports.pictorText("ar", "All files"),
  );
  commandSearch.value = "مكونات";
  commandSearch.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
  assert(
    [...document.querySelectorAll(".pictor-command-item")].some((node) =>
      node.textContent.includes(
        module.exports.pictorText("ar", "Explore AWC components"),
      ),
    ),
  );
  commandSearch.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settle();
  router.push("/editor/");
  await settle();
  doc.select([
    doc.layers.find((layer) => layer.kind !== "group" && !layer.locked).id,
  ]);
  await settle();
  assert.equal(
    document.querySelector("md-number-field").getAttribute("locale"),
    "ar-u-nu-arab",
  );
  assert.equal(
    document
      .querySelector("md-number-field")
      .getAttribute("value-missing-label"),
    module.exports.pictorText("ar", "Please enter a number."),
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
    "PASS Arabic search without diacritics, bilingual Insert, translated Lens, and number-field locale",
  );
  router.push("/");
  await settle();
  module.exports.setShowcaseState({ locale: "en", dir: "ltr" });
  await settle();
  assert.equal(
    document.querySelector("h1").textContent,
    "Your creative workspace",
  );
  console.log(
    "PASS reactive locale, translated dialog/group, and authored-name preservation",
  );
  instance.unmount();
  disposeDocument();
  dom.window.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
