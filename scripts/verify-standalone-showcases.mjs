import { access, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDALONE_SHOWCASES } from "./lib/standalone-showcases.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));

/** Fail deployment when a documented app or one of its entry assets is absent. */
export async function verifyStandaloneShowcases(
  directory = resolve(repo, "apps/docs/dist"),
) {
  const root = resolve(directory);
  let builds = 0;
  async function requireFile(path) {
    try {
      await access(path);
    } catch {
      throw new Error(`Missing showcase output: ${relative(root, path)}`);
    }
  }
  for (const app of STANDALONE_SHOWCASES) {
    const parent = resolve(root, "showcase", app.id);
    await requireFile(resolve(parent, "index.html"));
    const docs = await readFile(resolve(parent, "index.html"), "utf8");
    for (const framework of app.frameworks) {
      const route = `/showcase/${app.id}/${framework}/`;
      if (!docs.includes(route))
        throw new Error(`Showcase documentation does not link to ${route}`);
      const build = resolve(parent, framework);
      const index = resolve(build, "index.html");
      await requireFile(index);
      const html = await readFile(index, "utf8");
      if (!/<script\b[^>]*\bsrc=/i.test(html))
        throw new Error(`No app script in ${route}`);
      for (const file of [...app.required, ...(app.extra?.[framework] ?? [])]) {
        await requireFile(resolve(build, file));
      }
      // Vite emits hashed JavaScript/CSS paths. Check actual entry references,
      // including fonts and icons, instead of hard-coding generated filenames.
      for (const match of html.matchAll(
        /<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi,
      )) {
        const url = new URL(match[1], `https://showcase.invalid${route}`);
        if (url.origin !== "https://showcase.invalid") continue;
        if (!url.pathname.startsWith(route)) {
          throw new Error(
            `App asset escapes its showcase path: ${route} → ${match[1]}`,
          );
        }
        await requireFile(
          resolve(root, `.${decodeURIComponent(url.pathname)}`),
        );
      }
      builds += 1;
    }
  }
  return builds;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  verifyStandaloneShowcases(process.argv[2]).then(
    (count) =>
      console.log(
        `Verified ${count} standalone showcase builds and their documentation/assets.`,
      ),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
