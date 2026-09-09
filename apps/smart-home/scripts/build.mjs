import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { appRoot, awcDist } from "./paths.mjs";
const dist = resolve(appRoot, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(appRoot, "src"), dist, { recursive: true });
await cp(resolve(appRoot, "public"), dist, { recursive: true });
await cp(awcDist(), resolve(dist, "awc"), {
  recursive: true,
  filter: (path) => !path.endsWith(".map"),
});
console.log("Habitat built successfully → dist/");
