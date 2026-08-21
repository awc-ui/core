// One-shot generator: docs page per showcase app, from the build reports.
// Run from repo root: node scripts/gen-showcase-pages.mjs <results.json>
import fs from 'node:fs';

const APPS = {
  'showcase-fieldstone': { title: 'Fieldstone Ops', fw: 'Next.js', tagline: 'Logistics admin console — the flagship internal-tools showcase: big data table, transfer-list permissions, org chart, and audit log, all server-rendered.' },
  'showcase-lumen': { title: 'Lumen Bank', fw: 'Next.js', tagline: 'Retail banking: sparkline balances, spending breakdown, an OTP-confirmed transfer flow, and budget meters — mobile-first.' },
  'showcase-relaymesh': { title: 'Relaymesh', fw: 'Next.js', tagline: 'API observability console in dark theme: service health, latency charts, request log, incident timeline.' },
  'showcase-pulseboard': { title: 'Pulseboard', fw: 'SvelteKit', tagline: 'Product analytics SaaS: KPI tiles, DAU/adoption charts, funnels, and a skeleton-loading events explorer.' },
  'showcase-cairn': { title: 'Cairn', fw: 'SvelteKit', tagline: 'Lightweight project tracker: board/list toggle, side-sheet task detail, sprint burndown, quick-create FAB menu.' },
  'showcase-merrow': { title: 'Merrow & Co', fw: 'Astro', tagline: 'Homewares storefront: near-zero-JS catalog and product pages with a stepper checkout — the SEO-first SSR story.' },
  'showcase-caduceus': { title: 'Caduceus Health', fw: 'Angular SSR', tagline: 'Patient portal: OTP sign-in, appointment booking with both pickers, lab results with reference-range meters, vitals trends.' },
  'showcase-tessellate': { title: 'Tessellate Academy', fw: 'Nuxt', tagline: 'Online course platform: catalog, accordion syllabus, progress dashboard, and a stepper-driven quiz.' },
  'showcase-hearthwise': { title: 'Hearthwise', fw: 'Plain HTML (no build step)', tagline: 'Smart-home control where the color picker literally re-tints the app theme — script tags only, zero tooling.' },
  'showcase-copperplate': { title: 'Copperplate', fw: 'Plain HTML (no build step)', tagline: 'Touch-first restaurant POS: register, tender dialog, end-of-day report — 48px targets throughout.' },
};

const results = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = 'apps/docs/src/content/docs/showcase';

for (const app of results.apps) {
  const meta = APPS[app.app];
  if (!meta) continue;
  const slug = app.app.replace('showcase-', '');
  const screens = app.screens.map((s) => `- ${s.replaceAll('<', '\\<')}`).join('\n');
  const comps = [...new Set(app.components)].sort();
  const compLinks = comps
    .map((c) => {
      const base = c.replace(/^md-/, '');
      return `[\`${c}\`](/components/${base}/)`;
    })
    .join(' · ');
  const page = `---
title: "${meta.title}"
description: "${meta.tagline}"
---

**${meta.fw} · \`apps/${app.app}\` in the repository.** ${meta.tagline}

## Screens

${screens}

## Components exercised (${comps.length})

${compLinks}

## Run it

\`\`\`bash
git clone https://github.com/awc-ui/core
cd core && pnpm install
pnpm --filter @awc-ui/${app.app} dev
\`\`\`

The app's \`README.md\` documents its structure and any framework-specific
wiring. Like every showcase app, it is styled exclusively with \`--md-sys-*\`
tokens — retheme it by changing one seed in the
[theme generator](/theme-generator/).
`;
  fs.writeFileSync(`${outDir}/${slug}.mdx`, page);
  console.log('wrote', slug);
}
