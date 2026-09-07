import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { en } from "@awc-ui/showcase-kit/i18n";
import {
  FRAMEWORKS,
  REPORTING_DATE,
  SHOWCASE_BASE,
} from "@awc-ui/showcase-kit/design";
import { serveSiblingFrameworks } from "../../../../scripts/lib/serve-sibling-frameworks.mjs";

const FRAMEWORK = "vue";
const BASE_PATH = `${SHOWCASE_BASE}/${FRAMEWORK}`;

function showcaseHead(): Plugin {
  const tokens: Record<string, string> = {
    __AWC_REPORTING_DATE__: REPORTING_DATE,
    __AWC_TITLE__: `${en["design.app.brand"]} — ${en["design.app.title"]}`,
    __AWC_DESCRIPTION__: en["design.screen.projects.subtitle"],
    __AWC_BASE__: BASE_PATH,
  };
  return {
    name: "awc-showcase-head",
    transformIndexHtml: {
      order: "pre",
      // A function replacer, so nothing in the substituted text is read as a
      // `$1`-style backreference.
      handler: (html) =>
        html.replace(/__AWC_[A-Z_]+__/g, (match) => tokens[match] ?? match),
    },
  };
}

function externalHeadScripts(): Plugin {
  return {
    name: "awc-external-head-scripts",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html
          .replace(
            "<!--__AWC_PREBOOT_SCRIPT__-->",
            `<script src="${BASE_PATH}/preboot.js"></script>`,
          )
          .replace(
            "<!--__AWC_RUNTIME_SCRIPT__-->",
            `<link rel="modulepreload" href="${BASE_PATH}/awc-runtime/md3/md3.esm.js">`,
          ),
    },
  };
}

function stripHtmlComments(): Plugin {
  return {
    name: "awc-strip-html-comments",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html
          // NON-greedy, so two adjacent comments do not collapse into one match
          // that swallows the markup between them.
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/\n\s*\n+/g, "\n"),
    },
  };
}

const siblings = () =>
  serveSiblingFrameworks({
    repoRoot: fileURLToPath(new URL("../../../../", import.meta.url)),
    vertical: "design",
    framework: FRAMEWORK,
    siblings: FRAMEWORKS,
  });

export default defineConfig({
  base: `${BASE_PATH}/`,
  plugins: [
    showcaseHead(),
    externalHeadScripts(),
    stripHtmlComments(),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) =>
            tag.startsWith("md-") || tag.startsWith("awc-"),
        },
      },
    }),
    siblings(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Ten above Lyra's 4367, which is ten above banking's 4357 — one band per
    // vertical, so every build of every vertical can run at
    // once during a comparison.
    port: 4378,
  },
  build: {
    assetsInlineLimit: 0,
    // One entry, one chunk — Vite's default, and left alone deliberately. The
    // six screens share almost every import (the kit's fixture and selectors,
    // the shell, the tables, the chart wrappers), so splitting them per route
    // would trade one request for six heavily overlapping ones, and each
    // in-app navigation would then wait on a network round trip that it does
    // not wait on now.
    sourcemap: false,
  },
});
