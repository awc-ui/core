import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const req = createRequire(join(root, "packages/core/package.json"));
const { build } = req("esbuild");
const { angularOutputTarget } = req("@stencil/angular-output-target");
const out = await mkdtemp(join(tmpdir(), "awc-angular-generation-"));
try {
  await build({
    entryPoints: [join(root, "packages/angular/stencil-output-target.ts")],
    outfile: join(out, "target.mjs"),
    bundle: true,
    format: "esm",
    platform: "node",
  });
  const { withAngularSsrAccessors } = await import(
    pathToFileURL(join(out, "target.mjs"))
  );
  const files = new Map();
  const fs = {
    async readFile(path) {
      return readFile(path, "utf8");
    },
    async writeFile(path, source) {
      await Promise.resolve();
      files.set(path, source);
    },
  };
  const target = withAngularSsrAccessors(
    angularOutputTarget({
      componentCorePackage: "@awc-ui/core",
      outputType: "standalone",
      directivesProxyFile: "../angular/src/directives/proxies.ts",
      valueAccessorConfigs: [
        {
          elementSelectors: [
            "md-text-field",
            "md-autocomplete",
            "md-otp-field",
          ],
          event: "mdInput",
          targetAttr: "value",
          type: "text",
        },
        {
          elementSelectors: ["md-select", "md-date-picker", "md-time-picker"],
          event: "mdChange",
          targetAttr: "value",
          type: "select",
        },
        {
          elementSelectors: ["md-checkbox"],
          event: "mdChange",
          targetAttr: "checked",
          type: "boolean",
        },
        {
          elementSelectors: ["md-number-field", "md-slider", "md-rating"],
          event: "mdChange",
          targetAttr: "value",
          type: "number",
        },
      ],
    }),
  );
  const config = {
    rootDir: join(root, "packages/core"),
    sys: {
      async copy() {},
      glob() {},
      readFile: (path) => readFile(path, "utf8"),
    },
  };
  target.validate(config);
  const context = {
    components: [
      {
        tagName: "md-text-field",
        properties: [
          { name: "value", attribute: "value" },
          { name: "readOnly", attribute: "read-only" },
        ],
      },
      {
        tagName: "md-side-sheet",
        properties: [{ name: "sheetAriaLabel", attribute: "aria-label" }],
      },
      {
        tagName: "md-multi-select",
        properties: [
          { name: "value" },
          { name: "options", attribute: "options" },
          { name: "countFormatter" },
        ],
      },
    ].map((component) => ({
      ...component,
      events: [],
      methods: [],
      properties: component.properties.map((property) => ({
        ...property,
        docs: { text: "", tags: [] },
        complexType: { original: "string", resolved: "string", references: {} },
      })),
    })),
    createTimeSpan() {
      return { finish() {} };
    },
  };
  for (let run = 0; run < 2; run++) {
    await target.generator(config, { fs }, context);
    const proxies = [...files].find(([path]) =>
      path.endsWith("/proxies.ts"),
    )?.[1];
    assert.match(proxies, /from '\.\/ssr-inputs'/);
    assert.match(proxies, /initializeSsrInputs\(this\)/);
    assert.match(proxies, /ssrAttributes: \{"sheetAriaLabel":"aria-label"\}/);
    assert.match(
      proxies,
      /ssrAttributes: \{"value":\[null,"values"\],"options":\["options","json"\],"countFormatter":false\}/,
    );
    assert.doesNotMatch(
      proxies,
      /"readOnly":"read-only"|"value":"value"/,
      "default kebab-case metadata must not inflate the client bundle",
    );
    for (const kind of ["text", "select", "boolean", "number"]) {
      const source = [...files].find(([path]) =>
        path.endsWith(`/${kind}-value-accessor.ts`),
      )?.[1];
      assert.match(
        source,
        /from '\.\/ssr-value-accessor'/,
        `${kind}: actual upstream generator must retain the hand-owned SSR base`,
      );
      assert.doesNotMatch(source, /from '\.\/value-accessor'/);
      if (kind === "boolean")
        assert.match(
          source,
          /this\.writeHostProperty\('checked', this\.lastValue/,
        );
    }
    assert.match(
      [...files].find(([path]) =>
        path.endsWith("/text-value-accessor.ts"),
      )?.[1],
      /\(mdInput\)/,
    );
  }
  console.log(
    "Angular generation: four upstream accessors preserve server serialization across repeated asynchronous generation.",
  );
} finally {
  await rm(out, { recursive: true, force: true });
}
