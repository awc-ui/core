#!/usr/bin/env node
/** Verify Angular's real signal-backed translator bridge without starting a browser. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "../shared/package.json"));
const { build } = require("esbuild");
// Never read Node's optional persistent localStorage while testing application state.
const storageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
const values = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  },
});
const scratch = await mkdtemp(join(tmpdir(), "pictor-angular-i18n-"));
try {
  const result = await build({
    stdin: {
      contents: `
        import '@angular/compiler';
        import { createEnvironmentInjector, runInInjectionContext, NgZone } from '@angular/core';
        import { Router } from '@angular/router';
        import { DomSanitizer } from '@angular/platform-browser';
        import { InsertComponent } from "./src/app/panels";
        import { CommandsComponent, LensComponent } from './src/app/workbench';
        import { StudioService } from './src/app/lib/studio.service';
        import { ShowcaseService } from './src/app/lib/showcase.service';
        import { pictorText, pictorSearchText } from '@awc-ui/pictor-model';
        export { pictorText, pictorSearchText };
        export function createStudio() {
          const injector = createEnvironmentInjector([
            StudioService, ShowcaseService,
            {provide: NgZone, useValue: {run: fn => fn()}},
            {provide: Router, useValue: {url: '/'}},
            {provide: DomSanitizer, useValue: {bypassSecurityTrustUrl: value => value}}
          ]);
          const studio = injector.get(StudioService);
          return { studio, setLocale(locale) {
            const showcase = injector.get(ShowcaseService);
            showcase.current.set({...showcase.state(), locale});
          }, createCommands: () => runInInjectionContext(injector, () => new CommandsComponent()),
            createLens: () => runInInjectionContext(injector, () => new LensComponent()),
            createInsert: () => runInInjectionContext(injector, () => new InsertComponent()), destroy: () => injector.destroy() };
        }
      `,
      resolveDir: root,
      sourcefile: "pictor-angular-i18n-check.ts",
      loader: "ts",
    },
    tsconfig: join(root, "tsconfig.app.json"),
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    target: "node22",
    logLevel: "silent",
  });
  const entry = join(scratch, "check.mjs");
  await writeFile(entry, result.outputFiles[0].text);
  const { createStudio, pictorText, pictorSearchText } = await import(
    pathToFileURL(entry).href
  );
  const {
    studio,
    setLocale,
    createCommands,
    createLens,
    createInsert,
    destroy,
  } = createStudio();
  try {
    const authored = JSON.stringify(studio.doc.layers);
    const english = studio.t;
    assert.equal(
      english,
      studio.t,
      "Repeated reads must retain callable identity",
    );
    assert.equal(english("Open {name}", { name: "Orbit" }), "Open Orbit");
    assert.equal(english("design.nav.projects"), "Projects");
    setLocale("ar");
    const arabic = studio.t;
    assert.notEqual(
      arabic,
      english,
      "Changing the dock locale must replace the translator",
    );
    assert.equal(arabic.locale, "ar");
    assert.equal(arabic.dir, "rtl");
    assert.match(
      arabic("design.nav.projects"),
      /[\u0600-\u06ff]/u,
      "Kit keys remain translated",
    );
    assert.equal(
      arabic("Open {name}", { name: "Orbit" }),
      pictorText("ar", "Open {name}", { name: "Orbit" }),
    );
    assert.equal(
      arabic.formatNumber(123),
      new Intl.NumberFormat("ar").format(123),
    );
    assert.equal(
      JSON.stringify(studio.doc.layers),
      authored,
      "Locale changes must not rewrite authored layer names or artwork",
    );
    setLocale("en");
    assert.equal(studio.t("Open {name}", { name: "Orbit" }), "Open Orbit");
    assert.equal(studio.t.dir, "ltr");
    const previous = {
      window: globalThis.window,
      document: globalThis.document,
      requestAnimationFrame: globalThis.requestAnimationFrame,
    };
    const list = {
      scrollTop: 0,
      getBoundingClientRect: () => ({ top: 10, bottom: 130 }),
      querySelectorAll: () =>
        Array.from({ length: 12 }, (_, i) => ({
          getBoundingClientRect: () => ({
            top: 10 + i * 40 - list.scrollTop,
            bottom: 50 + i * 40 - list.scrollTop,
          }),
        })),
    };
    globalThis.window = new EventTarget();
    globalThis.document = {
      getElementById: (id) => (id === "pictor-command-results" ? list : null),
    };
    globalThis.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    const commands = createCommands();
    try {
      commands.open = true;
      setLocale("ar");
      commands.query = "مكونات";
      assert(
        commands.results.some((command) => command.id === "components"),
        "Arabic search must ignore the shadda in مكوّنات",
      );
      commands.query = "  EXPORT ";
      assert(
        commands.results.some((command) => command.id === "export"),
        "Arabic mode retains source-English command search",
      );
      const lens = createLens();
      try {
        lens.entries = [
          { tag: "md-button", count: 1, markup: "<md-button></md-button>" },
          { tag: "md-slider", count: 1, markup: "<md-slider></md-slider>" },
        ];
        lens.query = "زر";
        assert.equal(
          lens.filtered[0]?.tag,
          "md-button",
          "Lens accepts a localized component type",
        );
        lens.query = "slider";
        assert.equal(
          lens.filtered[0]?.tag,
          "md-slider",
          "Lens still accepts source/API terminology",
        );
      } finally {
        lens.ngOnDestroy();
      }
      const insert = createInsert();
      insert.query = "Action button";
      assert(insert.components.some((item) => item.id === "awc:button"));
      insert.query = pictorSearchText(pictorText("ar", "Action button"));
      assert(
        insert.components.some((item) => item.id === "awc:button"),
        "Insert accepts unvowelled translated component names",
      );
      insert.query = "Orbital sculpture";
      assert.equal(insert.art[0]?.name, "Orbital sculpture");
      insert.query = pictorSearchText(pictorText("ar", "Orbital sculpture"));
      assert.equal(
        insert.art[0]?.name,
        "Orbital sculpture",
        "Artwork searches translated metadata without changing the inserted name",
      );
      commands.query = "";
      for (let i = 0; i < 10; i++)
        commands.keyboard({ key: "ArrowDown", preventDefault() {} });
      assert.equal(commands.selected, 10);
      assert(
        list.scrollTop > 0,
        "Moving through palette results must reveal offscreen options",
      );
      for (let i = 0; i < 10; i++)
        commands.keyboard({ key: "ArrowUp", preventDefault() {} });
      assert.equal(commands.selected, 0);
      assert.equal(
        list.scrollTop,
        0,
        "Returning to the first option must reveal the top of the list",
      );
      commands.query = "no-matching-command-1000";
      commands.keyboard({ key: "ArrowDown", preventDefault() {} });
      assert.equal(
        commands.active,
        0,
        "An empty result list must not select a negative index",
      );
    } finally {
      commands.ngOnDestroy();
      Object.assign(globalThis, previous);
    }
    console.log(
      "Angular checks passed: locale reactivity, interpolation, kit keys, formatters, authored data preservation and palette keyboard scrolling.",
    );
  } finally {
    destroy();
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
  if (storageDescriptor)
    Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else delete globalThis.localStorage;
}
