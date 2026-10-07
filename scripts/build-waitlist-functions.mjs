#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipFunctions } from "@netlify/zip-it-and-ship-it";

const repository = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "awc-waitlist-functions-"));
try {
  const manifestPath = join(temporary, "manifest.json");
  await zipFunctions(
    join(repository, "apps/docs/netlify/functions"),
    temporary,
    {
      basePath: repository,
      archiveFormat: "zip",
      manifest: manifestPath,
      config: { "*": { nodeBundler: "esbuild", nodeVersion: "22" } },
    },
  );
  const { functions } = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.deepEqual(functions.map((fn) => fn.name).sort(), [
    "advertising-withdraw",
    "waitlist",
    "waitlist-delivery",
    "waitlist-unsubscribe",
  ]);
  for (const fn of functions) {
    assert.equal(fn.runtimeVersion, "nodejs22.x", `${fn.name}: wrong runtime`);
    assert.equal(
      fn.buildData.runtimeAPIVersion,
      2,
      `${fn.name}: missing web Request/Response adapter`,
    );
    assert.ok(
      (await readFile(fn.path)).byteLength > 0,
      `${fn.name}: empty deployment archive`,
    );
  }
  for (const [name, route] of [
    ["advertising-withdraw", "/api/advertising/withdraw"],
    ["waitlist", "/api/waitlist"],
    ["waitlist-unsubscribe", "/api/waitlist/unsubscribe"],
  ]) {
    const fn = functions.find((item) => item.name === name);
    assert.ok(
      fn.routes?.some((item) => item.pattern === route),
      `${name}: missing API route in deployment metadata`,
    );
    assert.equal(
      fn.trafficRules?.action?.type,
      "rate_limit",
      `${name}: missing edge rate limit in deployment metadata`,
    );
    assert.ok(
      fn.trafficRules.action.config.rateLimitConfig.windowLimit > 0,
      `${name}: invalid edge rate limit`,
    );
  }
  const delivery = functions.find((item) => item.name === "waitlist-delivery");
  assert.equal(
    delivery.schedule,
    "0 * * * *",
    "Delivery recovery worker must run hourly.",
  );
  console.log(
    "Four waitlist functions bundled: Node 22, API routes, edge rate limits, and delivery schedule verified.",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
