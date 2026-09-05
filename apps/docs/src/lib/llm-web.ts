// @ts-ignore — Vite resolves ?raw at build time.
import mainLlmRaw from "../../../../main-llm.md?raw";

/**
 * Rewrite repository-relative component manuals for the hosted copy.
 *
 * The source remains useful in a clone, while /llm/ and /llms-full.txt need
 * links an agent can fetch from anywhere. The installed npm copy has a separate
 * rewrite for its node_modules layout in scripts/build-package-docs.mjs.
 */
export const mainLlmWeb = mainLlmRaw
  .replace(
    /(?:\.\/)?packages\/core\/src\/components\/md-([a-z0-9-]+)\/readme\.md/g,
    "https://awc-ui.dev/components/$1/readme.md",
  )
  .replace(
    /(?:\.\/)?packages\/core\/src\/components\/<tag>\/readme\.md/g,
    "https://awc-ui.dev/components/<tag-without-md-prefix>/readme.md",
  );
