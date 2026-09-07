import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAssets,
  getFiles,
  getProjects,
  projectSlug,
  route,
} from "@awc-ui/showcase-kit/design";
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  dist = join(appRoot, "dist/browser"),
  source = join(dist, "index.html");
if (!existsSync(source))
  throw new Error("Build the Angular application before writing route shells.");
if (!/<awc-root[^>]*>\s*<\/awc-root>/.test(readFileSync(source, "utf8")))
  throw new Error("Route shells must be empty SPA documents.");
const routes = [
  route.editor(),
  route.assets(),
  route.profile(),
  ...getFiles().map((file) => route.file(file.id)),
  ...getProjects().map((project) => route.project(projectSlug(project))),
  ...getAssets().map((asset) => route.asset(asset.id)),
];
for (const path of routes) {
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  copyFileSync(source, join(dir, "index.html"));
}
console.log(`[fan-out] ${routes.length + 1} static route shells`);
