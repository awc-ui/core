import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { appRoot, coreRoot } from "./paths.mjs";
const dist = resolve(appRoot, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(appRoot, "src"), dist, { recursive: true });
await cp(resolve(appRoot, "public"), dist, { recursive: true });
await cp(resolve(coreRoot(), "packages/core/dist/md3"), resolve(dist, "awc"), {
  recursive: true,
  filter: (path) => !path.endsWith(".map"),
});
await mkdir(resolve(dist, "vendor"), { recursive: true });
await cp(
  resolve(coreRoot(), "packages/theme/dist/index.mjs"),
  resolve(dist, "vendor/theme.js"),
);
console.log("Medflow built successfully → dist/");
