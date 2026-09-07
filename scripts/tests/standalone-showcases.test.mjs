import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { STANDALONE_SHOWCASES } from "../lib/standalone-showcases.mjs";
import { verifyStandaloneShowcases } from "../verify-standalone-showcases.mjs";

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), "awc-showcases-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function file(path, content = "") {
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  for (const app of STANDALONE_SHOWCASES) {
    await file(
      `showcase/${app.id}/index.html`,
      app.frameworks
        .map(
          (framework) =>
            `<a href="/showcase/${app.id}/${framework}/">Open ${app.title}</a>`,
        )
        .join(""),
    );
    for (const framework of app.frameworks) {
      const path = `showcase/${app.id}/${framework}`;
      await file(
        `${path}/index.html`,
        '<script src="./assets/app-123.js" type="module"></script><link rel="stylesheet" href="./assets/styles-123.css">',
      );
      for (const name of [
        "assets/app-123.js",
        "assets/styles-123.css",
        ...app.required,
        ...(app.extra?.[framework] ?? []),
      ]) {
        await file(`${path}/${name}`);
      }
    }
  }
  return { root, file };
}

test("all advertised standalone builds have separate docs and complete entry assets", async (t) => {
  const { root } = await fixture(t);
  assert.equal(await verifyStandaloneShowcases(root), 8);
});

test("fails if staging overwrites the overview instead of preserving the app subdirectory", async (t) => {
  const { root, file } = await fixture(t);
  await file("showcase/medflow/index.html", '<script src="app.js"></script>');
  await assert.rejects(
    verifyStandaloneShowcases(root),
    /documentation does not link to \/showcase\/medflow\/html/,
  );
});

test("fails if a bundled runtime or theme helper is missing", async (t) => {
  const { root } = await fixture(t);
  await rm(resolve(root, "showcase/scada/html/vendor/awc-theme.mjs"));
  await assert.rejects(
    verifyStandaloneShowcases(root),
    /Missing showcase output: showcase\/scada\/html\/vendor\/awc-theme.mjs/,
  );
});

test("checks generated Vite asset names and rejects root-relative app URLs", async (t) => {
  const { root, file } = await fixture(t);
  await rm(resolve(root, "showcase/metro-monitor/react/assets/app-123.js"));
  await assert.rejects(
    verifyStandaloneShowcases(root),
    /Missing showcase output: showcase\/metro-monitor\/react\/assets\/app-123.js/,
  );
  await file(
    "showcase/metro-monitor/react/index.html",
    '<script type="module" src="/assets/app-123.js"></script>',
  );
  await assert.rejects(
    verifyStandaloneShowcases(root),
    /App asset escapes its showcase path/,
  );
});
