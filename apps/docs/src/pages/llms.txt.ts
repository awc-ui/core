/**
 * /llms.txt
 *
 * A compact, curated map for coding agents and retrieval systems. This is a
 * compatibility surface, not a claim that search engines require a special AI
 * file: the HTML site remains the canonical, fully linked source of truth.
 */

import type { APIRoute } from "astro";
import componentsManifest from "../data/components.json";

const origin = "https://awc-ui.dev";

function link(path: string, label: string, description: string): string {
  return `- [${label}](${origin}${path}): ${description}`;
}

function buildManifest(): string {
  const lines = [
    "# AWC UI",
    "",
    "> Accessible, open-source Material Design 3 Web Components for React, Angular, Vue, Svelte, or plain HTML, with Next.js SSR, Angular SSR, Nuxt SSR, SvelteKit SSR, RTL, theming, forms, and charts.",
    "",
    "AWC UI (Advanced Web Components UI) is a Stencil-built component library. The HTML documentation is canonical; the links below expose the same guidance in concise, machine-readable form.",
    "",
    "## Start here",
    "",
    link(
      "/getting-started/quick-start/",
      "Quick start",
      "Build a first AWC UI page in under five minutes.",
    ),
    link(
      "/getting-started/installation/",
      "Installation",
      "Install and configure the core library or a typed framework integration.",
    ),
    link(
      "/llm/awc-ui.main-llm.md",
      "Complete LLM specification",
      "Decision protocol, component matrix, tokens, recipes, accessibility contracts, and anti-patterns in Markdown.",
    ),
    link(
      "/llms-full.txt",
      "Full single-file context",
      "The complete LLM specification served from the conventional root filename.",
    ),
    "- [npm: @awc-ui/core](https://www.npmjs.com/package/@awc-ui/core): Published core Web Components package and README.",
    "- [GitHub: awc-ui/core](https://github.com/awc-ui/core): Source, issues, releases, examples, and contribution history.",
    "",
    "## Core guidance",
    "",
    link(
      "/components/",
      "Component index",
      "All public components grouped by purpose.",
    ),
    link(
      "/guides/accessibility/",
      "Accessibility",
      "Keyboard, focus, semantics, screen reader, and WCAG guidance.",
    ),
    link(
      "/theming/overview/",
      "Theming overview",
      "MD3 system tokens, component tokens, light/dark themes, and customization.",
    ),
    link(
      "/behaviour/rtl/",
      "RTL behavior",
      "Right-to-left layout, icon mirroring, and logical properties.",
    ),
    "- [Server-side rendering reference apps](https://github.com/awc-ui/core/tree/main/apps): Validated Next.js, Nuxt, SvelteKit, Astro, and Angular SSR implementations.",
    link(
      "/recipes/app-shell/",
      "Application recipes",
      "Start with the SSR-ready app shell, then follow its links to complete production-shaped examples.",
    ),
    link(
      "/compare/",
      "Comparisons",
      "Evidence-based comparisons with adjacent component libraries.",
    ),
    link(
      "/theme-generator/",
      "Theme generator",
      "Generate and validate Material Design 3 palettes and downloadable CSS tokens.",
    ),
    "",
    "## Framework packages",
    "",
    link(
      "/frameworks/web-components/",
      "Web Components",
      "Framework-agnostic custom elements for HTML and every major framework.",
    ),
    link(
      "/frameworks/react/",
      "React components and Next.js SSR",
      "Typed React 18+ components with a dedicated server-rendering entry.",
    ),
    link(
      "/frameworks/angular/",
      "Angular components and Angular SSR",
      "Angular 17+ directives, forms, standalone setup, and server rendering.",
    ),
    link(
      "/frameworks/vue/",
      "Vue components and Nuxt SSR",
      "Typed Vue 3 components, plugin registration, and Nuxt server rendering.",
    ),
    link(
      "/frameworks/svelte/",
      "Svelte components and SvelteKit SSR",
      "Svelte 4/5 custom elements and SvelteKit server rendering.",
    ),
    link(
      "/frameworks/ssr/",
      "Web Components SSR",
      "Declarative Shadow DOM architecture and framework support matrix.",
    ),
    "- [@awc-ui/react](https://www.npmjs.com/package/@awc-ui/react): Typed React 18+ components with Next.js and React SSR.",
    "- [@awc-ui/angular](https://www.npmjs.com/package/@awc-ui/angular): Angular 17+ components, forms directives, and Angular SSR.",
    "- [@awc-ui/vue](https://www.npmjs.com/package/@awc-ui/vue): Typed Vue 3 components with Nuxt SSR.",
    "- [@awc-ui/svelte](https://www.npmjs.com/package/@awc-ui/svelte): Svelte 4/5 components with SvelteKit SSR.",
    "- [@awc-ui/tokens](https://www.npmjs.com/package/@awc-ui/tokens): Framework-agnostic Material Design 3 CSS design tokens.",
    "- [@awc-ui/theme](https://www.npmjs.com/package/@awc-ui/theme): Seed-color theme generation and CSS output.",
    "",
    "## Component Markdown references",
    "",
    "Each file below is the component-owned manual: selection guidance, API, accessibility contract, examples, and anti-patterns.",
  ];

  for (const category of componentsManifest.categories) {
    const components = componentsManifest.components.filter(
      (component) => component.category === category,
    );
    if (!components.length) continue;
    lines.push("", `### ${category}`, "");
    for (const component of components) {
      lines.push(
        link(
          `/components/${component.slug}/readme.md`,
          `${component.title} (${component.tag})`,
          `Canonical ${component.tag} component manual.`,
        ),
      );
    }
  }

  lines.push(
    "",
    "## Optional",
    "",
    link(
      "/storybook/",
      "Storybook",
      "Interactive states, visual examples, and behavior scenarios for every component.",
    ),
    link(
      "/contributing/",
      "Contributing",
      "Repository architecture, tests, release expectations, and ways to help.",
    ),
    "",
  );

  return lines.join("\n");
}

export const GET: APIRoute = () =>
  new Response(buildManifest(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
