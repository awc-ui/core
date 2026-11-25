// Requires built @awc-ui/core and @awc-ui/angular. Uses their public exports.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripLightDomAnnotations } from "../../../scripts/lib/html-comments.mjs";

// The tarball and workspace contain distinct proxy classes. Run the pack check
// separately so Angular only sees one library per process.
execFileSync(process.execPath, [fileURLToPath(new URL("./public-package.mjs", import.meta.url))], {
  stdio: "inherit",
});

const root = fileURLToPath(new URL("../../../", import.meta.url)).replace(
  /\/$/,
  "",
);
const angular = createRequire(root + "/apps/test-angular/package.json");
const ssr = createRequire(root + "/apps/example-angular-ssr/package.json");
const req = createRequire(root + "/package.json");
const core = createRequire(root + "/packages/core/package.json");
const { build } = core("esbuild");
const { default: puppeteer } = await import(req.resolve("puppeteer"));
const out = await mkdtemp(join(tmpdir(), "awc-angular-ssr-forms-"));
let source = `import 'zone.js';import '@angular/compiler';import {Component,ApplicationRef,NgZone} from '@angular/core';import {CommonModule} from '@angular/common';import {bootstrapApplication} from '@angular/platform-browser';import {FormControl,FormGroup,ReactiveFormsModule} from '@angular/forms';import {AwcUiModule} from '@awc-ui/angular';
class Probe {
 form=new FormGroup({text:new FormControl('Initial'),checked:new FormControl(true),selected:new FormControl(true),amount:new FormControl(3),country:new FormControl('ro'),many:new FormControl(['a']),plan:new FormControl('pro')});
 changes=[];shown=true;label='Initial';choice=true;sheetLabel='Details';values=['a'];empty=[];options=[{value:'a',label:'Alpha'},{value:'b',label:'Beta'}];formatter=values=>String(values.length);actions=0;
 updateInputs(){this.label='Updated';this.choice=false;this.sheetLabel='Updated details';this.values=['b'];}
 ngOnInit(){if(typeof window!=='undefined')window.probe=this;this.form.valueChanges.subscribe(value=>this.changes.push(value));}
 reset(){this.form.reset();} disable(){this.form.disable();} enable(){this.form.enable();}
 patch(){this.form.patchValue({text:'Patched',checked:true,selected:true,amount:7,country:'pt',many:['b'],plan:'basic'});}
}
Component({selector:'probe-root',standalone:true,imports:[CommonModule,ReactiveFormsModule,AwcUiModule],template:\`
<button id="reset" (click)="reset()">reset</button><button id="patch" (click)="patch()">patch</button><button id="disable" (click)="disable()">disable</button><button id="enable" (click)="enable()">enable</button><button id="toggle" (click)="shown=!shown">toggle</button>
<button id="update-inputs" (click)="updateInputs()">update ordinary inputs</button>
<form id="plain-form">
<md-text-field id="bound-text" [label]="label" [value]="label" [readOnly]="choice" [focusBorderWidth]="2"></md-text-field>
<md-switch id="bound-on" name="enabled" value="yes" [selected]="choice" [disabled]="false" (mdChange)="actions=actions+1"></md-switch>
<md-switch id="bound-off" [selected]="!choice"></md-switch>
<md-switch id="bound-disabled" name="disabled" value="no" [selected]="true" [disabled]="true"></md-switch>
</form>
<md-multi-select id="bound-multi" [options]="options" [value]="values" [countFormatter]="formatter"></md-multi-select>
<md-multi-select id="bound-empty" [options]="options" [value]="empty"></md-multi-select>
<md-autocomplete id="bound-auto" multiple [options]="options" [value]="values"></md-autocomplete>
<md-side-sheet id="bound-sheet" [sheetAriaLabel]="sheetLabel">Details</md-side-sheet>
<form id="reactive-form" [formGroup]="form" *ngIf="shown">
<md-text-field id="text" formControlName="text" label="Name"></md-text-field>
<md-checkbox id="checkbox" formControlName="checked">Check</md-checkbox>
<md-switch id="switch" formControlName="selected"></md-switch>
<md-number-field id="number" formControlName="amount" label="Amount"></md-number-field>
<md-select id="select" formControlName="country" label="Country"><md-select-option value="ro">Romania</md-select-option><md-select-option value="pt">Portugal</md-select-option></md-select>
<md-multi-select id="multi" formControlName="many" label="Many"><md-select-option value="a">A</md-select-option><md-select-option value="b">B</md-select-option></md-multi-select>
<md-radio id="basic" name="plan" value="basic" formControlName="plan">Basic</md-radio><md-radio id="pro" name="plan" value="pro" formControlName="plan">Pro</md-radio>
</form><pre id="model">{{form.value|json}}</pre>\`})(Probe);
bootstrapApplication(Probe).then(app=>{window.app=app;window.zone=app.injector.get(NgZone);window.done=true;}).catch(error=>{window.failure=error.message;console.error(error)});`;
const component = source.slice(
  0,
  source.indexOf("bootstrapApplication(Probe)"),
);
const serverSource =
  component.replace("import 'zone.js';", "import 'zone.js/node';") +
  `import {renderApplication,provideServerRendering} from '@angular/platform-server';import {provideClientHydration} from '@angular/platform-browser';
export const html=await renderApplication(context=>bootstrapApplication(Probe,{providers:[provideServerRendering(),provideClientHydration()]},context),{document:'<!doctype html><html><head></head><body><probe-root></probe-root></body></html>',url:'http://localhost/',allowedHosts:['localhost']});`;
const serverJs = (
  await build({
    stdin: { contents: serverSource, resolveDir: root + "/apps/test-angular" },
    bundle: true,
    format: "esm",
    write: false,
    platform: "node",
    plugins: [
      {
        name: "public-angular-packages",
        setup(b) {
          b.onResolve({ filter: /^[^./]/ }, (args) => ({
            path: (args.path === "@angular/platform-server"
              ? ssr
              : angular
            ).resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  })
).outputFiles[0].text;
await writeFile(join(out, "server.mjs"), serverJs);
const { html } = await import(pathToFileURL(join(out, "server.mjs")));
const { JSDOM } = core("jsdom");
const raw = new JSDOM(html);
assert.equal(
  raw.window.document.getElementById("bound-on").hasAttribute("disabled"),
  false,
  "disabled=false must not disable FACE even before Core renders",
);
assert.equal(
  raw.window.document.getElementById("bound-disabled").hasAttribute("disabled"),
  true,
);
assert.equal(
  raw.window.document
    .getElementById("bound-multi")
    .hasAttribute("count-formatter"),
  false,
  "property-only callbacks must never become attributes",
);
raw.window.close();
const { renderToString } = core("./hydrate/index.js");
const rendered = await renderToString(html, {
  fullDocument: true,
  serializeShadowRoot: "declarative-shadow-dom",
  removeScripts: false,
  removeHtmlComments: false,
});
assert.deepEqual(
  rendered.diagnostics.filter((d) => d.level === "error"),
  [],
);
const css = await readFile(root + "/packages/core/dist/md3/md3.css", "utf8");
const document = stripLightDomAnnotations(rendered.html)
  .replace("</head>", `<style>${css}</style></head>`)
  .replace("</body>", '<script src="/app.js" defer></script></body>');
source =
  component +
  `import {provideClientHydration} from '@angular/platform-browser';import {preserveSsrClasses} from '@awc-ui/core/ssr/classes';
const finish=preserveSsrClasses();bootstrapApplication(Probe,{providers:[provideClientHydration()]}).then(async app=>{window.app=app;window.zone=app.injector.get(NgZone);await app.whenStable();finish();window.done=true;}).catch(error=>{window.failure=error.stack ?? error.message;console.error(error)});`;
const js = (
  await build({
    stdin: { contents: source, resolveDir: root + "/apps/test-angular" },
    bundle: true,
    format: "iife",
    write: false,
    platform: "browser",
    loader: { ".map": "json" },
  })
).outputFiles[0].text;
let releaseScripts;
const scriptGate = new Promise((resolve) => (releaseScripts = resolve));
const server = createServer(async (request, response) => {
  if (request.url === "/app.js") {
    await scriptGate;
    return response
      .writeHead(200, { "Content-Type": "text/javascript" })
      .end(js);
  }
  if (request.url === "/favicon.ico") return response.writeHead(204).end();
  response.writeHead(200, { "Content-Type": "text/html" }).end(document);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const staticPage = await browser.newPage();
  await staticPage.setJavaScriptEnabled(false);
  await staticPage.goto(origin);
  assert.deepEqual(
    await staticPage.evaluate(() => ({
      text: document.getElementById("text").shadowRoot.querySelector("input")
        .value,
      checkbox: document
        .getElementById("checkbox")
        .getAttribute("aria-checked"),
      switch: document.getElementById("switch").getAttribute("aria-checked"),
      number: document.getElementById("number").getAttribute("value"),
      select: document.getElementById("select").getAttribute("value"),
      many: document
        .getElementById("multi")
        .getAttribute("data-awc-initial-values"),
      radios: [
        document.getElementById("basic").getAttribute("aria-checked"),
        document.getElementById("pro").getAttribute("aria-checked"),
      ],
    })),
    {
      text: "Initial",
      checkbox: "true",
      switch: "true",
      number: "3",
      select: "ro",
      many: '["a"]',
      radios: ["false", "true"],
    },
    "SSR form values must be correct without JavaScript",
  );
  assert.deepEqual(
    await staticPage.evaluate(() => ({
      label: document.getElementById("bound-text").getAttribute("label"),
      value: document
        .getElementById("bound-text")
        .shadowRoot.querySelector("input").value,
      readOnly: document
        .getElementById("bound-text")
        .shadowRoot.querySelector("input").readOnly,
      border: document
        .getElementById("bound-text")
        .getAttribute("focus-border-width"),
      on: document.getElementById("bound-on").getAttribute("aria-checked"),
      off: document.getElementById("bound-off").getAttribute("aria-checked"),
      disabled: [
        document.getElementById("bound-on").hasAttribute("disabled"),
        document.getElementById("bound-disabled").hasAttribute("disabled"),
      ],
      sheet: document.getElementById("bound-sheet").getAttribute("aria-label"),
      values: ["bound-multi", "bound-empty", "bound-auto"].map((id) =>
        document.getElementById(id).getAttribute("data-awc-initial-values"),
      ),
      options: JSON.parse(
        document.getElementById("bound-multi").getAttribute("options"),
      ),
    })),
    {
      label: "Initial",
      value: "Initial",
      readOnly: true,
      border: "2",
      on: "true",
      off: "false",
      disabled: [false, true],
      sheet: "Details",
      values: ['["a"]', "[]", '["a"]'],
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
    },
    "ordinary public Angular Inputs must survive SSR with aliases, false values and bounded arrays",
  );
  await staticPage.close();
  const navigation = page.goto(origin);
  void navigation.catch(() => {});
  await page.waitForFunction(
    () => document.getElementById("switch")?.shadowRoot,
  );
  await page.evaluate(() => {
    window.serverHosts = [
      "text",
      "checkbox",
      "switch",
      "number",
      "select",
      "multi",
      "basic",
      "pro",
      "bound-text",
      "bound-on",
      "bound-off",
      "bound-disabled",
      "bound-multi",
      "bound-empty",
      "bound-auto",
    ].map((id) => document.getElementById(id));
    window.serverShadows = serverHosts.map((el) => el.shadowRoot);
    window.startup = { changes: [], motion: [], wrongState: 0, stop: false };
    for (const host of serverHosts) {
      for (const event of ["mdInput", "mdChange"])
        host.addEventListener(event, (e) => startup.changes.push(e.type));
      for (const event of ["animationstart", "transitionrun"])
        host.shadowRoot.addEventListener(
          event,
          (e) => {
            if (!startup.stop)
              startup.motion.push(e.animationName ?? e.propertyName);
          },
          true,
        );
    }
    const sample = () => {
      if (startup.stop) return;
      if (
        document.getElementById("switch").getAttribute("aria-checked") !==
          "true" ||
        document.getElementById("checkbox").getAttribute("aria-checked") !==
          "true" ||
        serverHosts.some(
          (el) =>
            !el.isConnected || getComputedStyle(el).visibility !== "visible",
        )
      )
        startup.wrongState++;
      requestAnimationFrame(sample);
    };
    sample();
  });
  releaseScripts();
  await navigation;
  await page.waitForFunction(() => window.done || window.failure);
  assert.equal(
    await page.evaluate(() => window.failure),
    undefined,
    errors.join("\n"),
  );
  await page.waitForFunction(() =>
    [
      "text",
      "checkbox",
      "switch",
      "number",
      "select",
      "multi",
      "basic",
      "pro",
    ].every((id) =>
      document.getElementById(id)?.hasAttribute("data-awc-motion-ready"),
    ),
  );
  assert.deepEqual(
    await page.evaluate(() => {
      startup.stop = true;
      return {
        identity: serverHosts.every(
          (el, index) =>
            el === document.getElementById(el.id) &&
            el.shadowRoot === serverShadows[index],
        ),
        changes: startup.changes,
        motion: startup.motion,
        wrongState: startup.wrongState,
      };
    }),
    { identity: true, changes: [], motion: [], wrongState: 0 },
    "Angular forms must adopt their initial state without events or entrance transitions",
  );
  const initial = await page.evaluate(() => ({
    model: probe.form.getRawValue(),
    changes: probe.changes.length,
    checked: document.getElementById("checkbox").checked,
    selected: document.getElementById("switch").selected,
    radios: [
      document.getElementById("basic").checked,
      document.getElementById("pro").checked,
    ],
  }));
  assert.deepEqual(initial, {
    model: {
      text: "Initial",
      checked: true,
      selected: true,
      amount: 3,
      country: "ro",
      many: ["a"],
      plan: "pro",
    },
    changes: 0,
    checked: true,
    selected: true,
    radios: [false, true],
  });
  assert.deepEqual(
    await page.evaluate(() =>
      Array.from(new FormData(document.getElementById("plain-form")).entries()),
    ),
    [["enabled", "yes"]],
    "native FACE FormData includes disabled=false and excludes disabled=true",
  );
  assert.deepEqual(
    await page.evaluate(() =>
      ["bound-multi", "bound-empty", "bound-auto"].map(
        (id) => document.getElementById(id).value,
      ),
    ),
    [["a"], [], ["a"]],
  );
  assert.equal(await page.evaluate(() => probe.actions), 0);
  await page.click("#update-inputs");
  await page.waitForFunction(
    () =>
      document.getElementById("bound-text").shadowRoot.querySelector("input")
        .value === "Updated" &&
      document.getElementById("bound-on").getAttribute("aria-checked") ===
        "false" &&
      document.getElementById("bound-off").getAttribute("aria-checked") ===
        "true",
  );
  assert.deepEqual(
    await page.evaluate(() => ({
      label: document.getElementById("bound-text").label,
      originalAttribute: document
        .getElementById("bound-text")
        .getAttribute("label"),
      readOnly: document.getElementById("bound-text").readOnly,
      sheet: document.getElementById("bound-sheet").sheetAriaLabel,
      values: document.getElementById("bound-multi").value,
      auto: document.getElementById("bound-auto").value,
      actions: probe.actions,
    })),
    {
      label: "Updated",
      originalAttribute: "Initial",
      readOnly: false,
      sheet: "Updated details",
      values: ["b"],
      auto: ["b"],
      actions: 0,
    },
    "client input setters remain property-only and produce no actions",
  );
  await page.click("#bound-on");
  await page.waitForFunction(() => probe.actions === 1);
  const input = await page.evaluateHandle(() =>
    document.getElementById("text").shadowRoot.querySelector("input"),
  );
  await input.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await page.waitForFunction(() => probe.form.value.text === "Initial!");
  assert.equal(
    await page.evaluate(() => probe.changes.length),
    1,
    "first text input writes model once",
  );
  await page.click("#switch");
  await page.waitForFunction(() => probe.form.value.selected === false);
  assert.equal(
    await page.evaluate(() => probe.changes.length),
    2,
    "first switch change writes model once",
  );
  await page.click("#checkbox");
  await page.waitForFunction(() => probe.form.value.checked === false);
  assert.equal(
    await page.evaluate(() => probe.changes.length),
    3,
    "first checkbox change writes model once",
  );
  await page.click("#basic");
  await page.waitForFunction(() => probe.form.value.plan === "basic");
  assert.equal(
    await page.evaluate(() => probe.changes.length),
    4,
    "first radio change writes model once",
  );
  assert.deepEqual(
    await page.evaluate(() => [
      document.getElementById("basic").checked,
      document.getElementById("pro").checked,
    ]),
    [true, false],
  );
  // Real focusout from a shadow input marks its Angular control touched.
  assert.equal(
    await page.evaluate(() => probe.form.controls.text.touched),
    true,
  );
  await page.click("#patch");
  await page.waitForFunction(
    () =>
      document.getElementById("text").shadowRoot.querySelector("input")
        .value === "Patched" &&
      document.getElementById("switch").selected &&
      document.getElementById("number").value === 7,
  );
  assert.deepEqual(
    await page.evaluate(() => ({
      country: document.getElementById("select").value,
      many: document.getElementById("multi").value,
      plan: probe.form.value.plan,
    })),
    { country: "pt", many: ["b"], plan: "basic" },
  );
  await page.click("#reset");
  await page.waitForFunction(
    () =>
      document.getElementById("text").shadowRoot.querySelector("input")
        .value === "" &&
      !document.getElementById("checkbox").checked &&
      !document.getElementById("switch").selected,
  );
  const reset = await page.evaluate(() => ({
    model: probe.form.getRawValue(),
    many: document.getElementById("multi").value,
    radios: [
      document.getElementById("basic").checked,
      document.getElementById("pro").checked,
    ],
    amount: document.getElementById("number").value,
    touched: probe.form.touched,
  }));
  assert.deepEqual(reset.model, {
    text: null,
    checked: null,
    selected: null,
    amount: null,
    country: null,
    many: null,
    plan: null,
  });
  assert.deepEqual(reset.many, []);
  assert.deepEqual(reset.radios, [false, false]);
  assert.equal(reset.touched, false);
  await page.click("#disable");
  await page.waitForFunction(
    () =>
      document.getElementById("switch").disabled &&
      document.getElementById("text").disabled,
  );
  const beforeDisabled = await page.evaluate(() => probe.changes.length);
  await page.click("#switch");
  await page.click("#checkbox");
  assert.equal(
    await page.evaluate(() => probe.changes.length),
    beforeDisabled,
    "disabled user actions must not write model",
  );
  await page.click("#enable");
  await page.click("#pro");
  await page.waitForFunction(() => probe.form.value.plan === "pro");
  await page.click("#toggle");
  assert.equal(await page.$("#reactive-form"), null);
  await page.click("#toggle");
  await page.waitForFunction(() => document.getElementById("pro")?.checked);
  await page.click("#basic");
  await page.waitForFunction(() => probe.form.value.plan === "basic");
  assert.deepEqual(
    await page.evaluate(() => [
      document.getElementById("basic").checked,
      document.getElementById("pro").checked,
    ]),
    [true, false],
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        angular: "20.3.33",
        initial,
        reset,
        firstChanges: "text/switch/checkbox/radio exactly once",
        programmatic: "patch/reset/disabled/reenabled/touched/remount PASS",
      },
      null,
      2,
    ),
  );
} finally {
  releaseScripts();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(out, { recursive: true, force: true });
}
