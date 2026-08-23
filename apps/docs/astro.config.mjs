import { existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import componentsManifest from './src/data/components.json';

/**
 * Serve the staged showcase builds in DEV the way a static host serves them.
 *
 * The six framework builds are staged into `public/showcase/` by
 * `scripts/build-showcase.mjs`, and every link inside them — and the dock's own
 * framework switcher — is a DIRECTORY url: `/showcase/credit-risk/svelte/`.
 * Astro's dev server serves files out of `public/`, but it does not resolve a
 * directory to its `index.html`, so those URLs fall through to Astro's router,
 * miss every route, and render the docs 404 page. The file is right there and
 * `…/svelte/index.html` returns it; only the directory form fails.
 *
 * Production is unaffected — `astro build` copies `public/` into `dist/`, and
 * both Netlify and `scripts/serve-docs-prod.mjs` do directory-index resolution
 * — which is exactly why this is easy to miss until someone opens the app
 * locally.
 *
 * `apply: 'serve'` keeps it out of the build entirely. It only ever rewrites a
 * request when the corresponding `index.html` genuinely exists on disk, so a
 * genuinely missing page still 404s rather than being masked.
 */
function showcaseDirectoryIndex(publicDir) {
  return {
    name: 'awc:showcase-directory-index',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [path = '/', query = ''] = (req.url ?? '/').split('?');
        if (!path.startsWith('/showcase/')) return next();

        // normalize() collapses any `..` before the join, so a traversal
        // attempt resolves inside public/ rather than above it.
        const onDisk = join(publicDir, normalize(decodeURIComponent(path)));
        if (!existsSync(onDisk) || !statSync(onDisk).isDirectory()) return next();
        if (!existsSync(join(onDisk, 'index.html'))) return next();

        const slashed = path.endsWith('/') ? path : `${path}/`;
        req.url = `${slashed}index.html${query ? `?${query}` : ''}`;
        return next();
      });
    },
  };
}

const PUBLIC_DIR = fileURLToPath(new URL('./public', import.meta.url));

// Components grouped by Storybook's category taxonomy.
//
// Storybook is the source of truth for both the roster and the grouping: each
// story's `title: 'Category/Name'` supplies the category, and generate-docs.mjs
// derives components.json from it. Previously this was a flat alphabetical list
// of every directory, which mixed the 54 components in with their 25 internal
// parts and gave no sense of what belongs together.
//
// Parts (md-table-cell, md-menu-item, …) are listed alongside their parent
// rather than hidden — they are real elements people search for — and because
// their labels share the parent's prefix they sort adjacent to it inside the
// group ("Table", "Table Body", "Table Cell", …).
/** Sub-components folded into their parent's docs page (see the sidebar note). */
// Sub-components folded into a parent page, and components that have left the
// library entirely, are filtered out of the generated sidebar here.
const MERGED_INTO_PARENT = new Set([
  'accordion-item',
  'list-item',
  'table-body',
  'table-cell',
  'table-container',
  'table-expand-toggle',
  'table-foot',
  'table-head',
  'table-pagination',
  'table-row',
  'table-sort-label',
  'table-toolbar',
  'breadcrumb-item',
  'select-option',
  'menu-item',
  'menu-item-group',
  'sub-menu-item',
  'navigation-tab',
  'navigation-rail-tab',
  'step',
  'tab',
  'tab-panel',
  'tab-panels',
]);

function buildComponentSidebar() {
  const byCategory = new Map(
    componentsManifest.categories.map((c) => [c, []]),
  );

  for (const c of componentsManifest.components) {
    // Sub-components whose reference lives on their parent's page. They are
    // still in the manifest (the API data and LLM context are generated from
    // it), they just don't get their own sidebar row — the parent page carries
    // the whole story, and two rows for one component reads as two components.
    if (MERGED_INTO_PARENT.has(c.slug)) continue;
    if (!byCategory.has(c.category)) byCategory.set(c.category, []);
    byCategory.get(c.category).push({
      label: c.title,
      link: `/components/${c.slug}/`,
    });
  }

  return [...byCategory.entries()]
    .filter(([, items]) => items.length)
    .map(([label, items]) => ({
      label,
      collapsed: true,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }));
}


/**
 * Wrap every markdown <table> in a scroll container.
 *
 * Markdown gives no element to hang overflow on, so the stylesheet had to make
 * the TABLE itself `display: block; overflow-x: auto`. That bought a scrollbar
 * at the cost of width: a block-level table shrink-wraps its rows, so a table
 * whose content is narrower than the article left dead space to its right —
 * measured 43px on /components/fab-menu/ at a 2000px viewport.
 *
 * With a real wrapper the table goes back to `display: table; inline-size: 100%`
 * (full width, proper column distribution) and the wrapper owns the scrolling,
 * so wide tables still scroll instead of clipping. tabindex + role make the
 * scrollable region reachable by keyboard, which an overflow container needs.
 */
function rehypeWrapTables() {
  return (tree) => {
    const visit = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        visit(child);
        if (child.type === 'element' && child.tagName === 'table') {
          return {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['md-table-scroll'],
              tabindex: '0',
              role: 'region',
              'aria-label': 'Scrollable table',
            },
            children: [child],
          };
        }
        return child;
      });
    };
    visit(tree);
  };
}

export default defineConfig({
  // The accordion-item reference was folded into the accordion page; keep the
  // old URL alive rather than 404ing anyone who bookmarked or linked it.
  redirects: {
    '/components/breadcrumb-item/': '/components/breadcrumbs/#md-breadcrumb-item',
    '/components/select-option/': '/components/select/#md-select-option',
    '/components/menu-item/': '/components/menu/#md-menu-item',
    '/components/menu-item-group/': '/components/menu/#md-menu-item-group',
    '/components/sub-menu-item/': '/components/menu/#md-sub-menu-item',
    '/components/navigation-tab/': '/components/navigation-bar/#md-navigation-tab',
    '/components/navigation-rail-tab/': '/components/navigation-rail/#md-navigation-rail-tab',
    '/components/step/': '/components/stepper/#md-step',
    '/components/tab/': '/components/tabs/#md-tab',
    '/components/tab-panel/': '/components/tabs/#md-tab-panel',
    '/components/tab-panels/': '/components/tabs/#md-tab-panels',
    '/components/accordion-item/': '/components/accordion/#the-item--md-accordion-item',
    '/components/list-item/': '/components/list/#the-row--md-list-item',
    '/components/table-body/': '/components/table/#md-table-body',
    '/components/table-cell/': '/components/table/#md-table-cell',
    '/components/table-container/': '/components/table/#md-table-container',
    '/components/table-expand-toggle/': '/components/table/#md-table-expand-toggle',
    '/components/table-foot/': '/components/table/#md-table-foot',
    '/components/table-head/': '/components/table/#md-table-head',
    '/components/table-pagination/': '/components/table/#md-table-pagination',
    '/components/table-row/': '/components/table/#md-table-row',
    '/components/table-sort-label/': '/components/table/#md-table-sort-label',
    '/components/table-toolbar/': '/components/table/#md-table-toolbar',
  },
  markdown: {
    rehypePlugins: [rehypeWrapTables],
  },
  site: 'https://awc-ui.dev',
  integrations: [
    starlight({
      title: 'AWC UI',
      description: 'Advanced Web Components UI — Material Design 3 Web Components built with Stencil.js',
      logo: {
        light: './src/assets/md3-logo-light.svg',
        dark: './src/assets/md3-logo-dark.svg',
        replacesTitle: false,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/awc-ui/core' },
      ],
      // Override Starlight's <Head> so every page registers the AWC UI custom
      // elements. Without this nothing upgrades and all component previews
      // render as empty boxes — see src/components/Head.astro.
      components: {
        Head: './src/components/Head.astro',
      },
      customCss: [
        '@awc-ui/tokens/tokens.css',
        './src/styles/custom.css',
      ],
      head: [
        // SEO — Starlight already emits title, canonical, description, the
        // og:title/type/url/locale/description/site_name set, twitter:card,
        // and a sitemap (auto-injected @astrojs/sitemap → /sitemap-index.xml,
        // referenced from public/robots.txt). What it does NOT provide is a
        // social-share image or theme-color, so only those are added here.
        // og.png is a static 1200×630 card in public/ (rendered from the logo
        // mark; regenerate with sharp if the branding changes). The URL must
        // be absolute — scrapers don't resolve relative og:image paths.
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://awc-ui.dev/og.png' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:alt',
            content: 'AWC UI — Material Design 3 Web Components',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: 'https://awc-ui.dev/og.png' },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image:alt',
            content: 'AWC UI — Material Design 3 Web Components',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'theme-color',
            media: '(prefers-color-scheme: light)',
            content: '#FEF7FF',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'theme-color',
            media: '(prefers-color-scheme: dark)',
            content: '#141218',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.googleapis.com',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'preconnect',
            href: 'https://fonts.gstatic.com',
            crossorigin: '',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
          },
        },
        // Rounded is NOT interchangeable with Outlined: components whose glyph
        // stack asks for `Material Symbols Rounded` first (md-rating's stars)
        // silently fell back to Outlined here — pointier corners than the same
        // component in Storybook, which loads both. Keep this in step with
        // apps/storybook/.storybook/preview-head.html.
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
          },
        },
        // Story 2.4 AC: open search with `/` (in addition to the default
        // Ctrl+K / Cmd+K that Starlight already wires). Skip when the user
        // is typing into a form field — `/` is a valid keystroke there.
        {
          tag: 'script',
          content: `
            document.addEventListener('keydown', (e) => {
              if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
              const t = e.target;
              if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                  t.tagName === 'SELECT' || t.isContentEditable)) return;
              const btn = document.querySelector('site-search button[data-open-modal]');
              if (btn) { e.preventDefault(); btn.click(); }
            });
          `,
        },
        // ----------------------------------------------------------
        // TOC scrollspy: bottom-of-page edge case.
        //
        // Starlight's <starlight-toc> uses an IntersectionObserver
        // with a ~53px active band near the top of the viewport.
        // A short section at the bottom of the page can never scroll
        // into that band (there isn't enough content below it), so
        // the last TOC link never gets aria-current="true" and the
        // previously-active link stays highlighted.
        //
        // The naive fix (manipulate aria-current directly) breaks
        // because <starlight-toc> keeps a *private* \`_current\`
        // reference and only ever clears the attribute from that
        // reference; touching the DOM behind its back leaves it
        // stale, producing the "two TOC items both highlighted"
        // bug. We instead call Starlight's own setter
        // (\`toc.current = lastLink\`) — \`protected\` is only a
        // TypeScript compile-time check, so the setter is a
        // perfectly normal property at runtime. The setter does
        // all the bookkeeping, so when the user scrolls back up
        // the next IO transition cleanly hands off without
        // leaving a stale aria-current behind.
        // ----------------------------------------------------------
        {
          tag: 'script',
          content: `
            (function () {
              const BOTTOM_THRESHOLD = 80;
              let raf = 0;
              function setLastTocActive() {
                document.querySelectorAll('starlight-toc').forEach((toc) => {
                  const links = toc.querySelectorAll('a[href^="#"]');
                  if (!links.length) return;
                  const last = links[links.length - 1];
                  // Use Starlight's own setter so its internal
                  // \`_current\` stays synchronised with the DOM.
                  // The setter itself early-returns if \`last\`
                  // is already current, so no-op when redundant.
                  try {
                    toc.current = last;
                  } catch {
                    // Defensive: if Starlight ever locks the setter,
                    // fall back to setting aria-current manually so
                    // the user still gets visual feedback.
                    if (last.getAttribute('aria-current') !== 'true') {
                      links.forEach((l) => l.removeAttribute('aria-current'));
                      last.setAttribute('aria-current', 'true');
                    }
                  }
                });
              }
              function onScroll() {
                if (raf) return;
                raf = requestAnimationFrame(() => {
                  raf = 0;
                  const doc = document.documentElement;
                  const atBottom =
                    window.innerHeight + window.scrollY >=
                    doc.scrollHeight - BOTTOM_THRESHOLD;
                  if (atBottom) setLastTocActive();
                });
              }
              window.addEventListener('scroll', onScroll, { passive: true });
              window.addEventListener('resize', onScroll, { passive: true });
              window.addEventListener('load', onScroll, { once: true });
              document.addEventListener('astro:page-load', onScroll);
            })();
          `,
        },
      ],
      sidebar: [
        // Top-of-sidebar quick tool — promoted above the content nav so the
        // theme generator is immediately discoverable rather than buried
        // under every category. Renders as a flat one-row entry, badge-free.
        // (The former "For AI Agents" and "Storybook" rows were removed;
        // /llm/ stays reachable from every page's AI/LLM Context section.)
        {
          label: 'Theme Generator',
          link: '/theme-generator/',
        },
        {
          label: 'Getting Started',
          autogenerate: { directory: 'getting-started' },
        },
        {
          label: 'Theming',
          autogenerate: { directory: 'theming' },
        },
        // Global, attribute-driven switches that apply library-wide from a
        // single element (usually <html>): density rungs, text direction,
        // and the two M3 Expressive toggles. Grouped separately from
        // Theming because they change *behaviour*, not colour/shape values,
        // and from Guides because each is a one-attribute setting rather
        // than a technique.
        {
          label: 'Global Behaviour',
          autogenerate: { directory: 'behaviour' },
        },
        // Complete, runnable screens — the docs-site face of main-llm.md §8.
        // Ordered by how often evaluators ask for them (data-heavy first),
        // not alphabetically; autogenerate would lose that ranking.
        {
          label: 'Recipes',
          collapsed: true,
          items: [
            { label: 'App shell (SSR-ready)', link: '/recipes/app-shell/' },
            { label: 'KPI overview', link: '/recipes/kpi-overview/' },
            { label: 'Data grid console', link: '/recipes/data-grid-console/' },
            { label: 'Charts gallery', link: '/recipes/charts-gallery/' },
            { label: 'Server fleet status', link: '/recipes/server-fleet-status/' },
            { label: 'Release health drilldown', link: '/recipes/release-health-drilldown/' },
            { label: 'CSV import wizard', link: '/recipes/csv-import-wizard/' },
            { label: 'Role & permission assignment', link: '/recipes/role-permission-assignment/' },
            { label: 'Org chart explorer', link: '/recipes/org-chart-explorer/' },
            { label: 'Moderation queue', link: '/recipes/moderation-queue/' },
            { label: 'Checkout wizard', link: '/recipes/checkout-wizard/' },
            { label: 'Two-factor verification', link: '/recipes/two-factor-verification/' },
            { label: 'Appointment booking', link: '/recipes/appointment-booking/' },
            { label: 'Survey with NPS', link: '/recipes/survey-nps/' },
            { label: 'Notification preferences', link: '/recipes/notification-preferences/' },
            { label: 'Inbox with reading pane', link: '/recipes/inbox-shell/' },
            { label: 'Mobile filter sheet', link: '/recipes/mobile-filter-sheet/' },
            { label: 'Product reviews', link: '/recipes/product-reviews/' },
            { label: 'Order tracking', link: '/recipes/order-tracking/' },
            { label: 'Portfolio & markets', link: '/recipes/portfolio-markets/' },
            { label: 'Pricing page', link: '/recipes/pricing-page/' },
            { label: 'Async feedback patterns', link: '/recipes/async-feedback-patterns/' },
          ],
        },
        // Full applications, each shipped in every supported framework and
        // mounted under /showcase/<app>/<framework>/ on the deployed site.
        // Ordered deliberately: the gallery index first, then one page per app.
        {
          label: 'Showcase',
          collapsed: true,
          items: [
            { label: 'Overview', link: '/showcase/' },
            { label: 'Credit Risk Console', link: '/showcase/credit-risk/' },
          ],
        },
        {
          label: 'Compare',
          collapsed: true,
          autogenerate: { directory: 'compare' },
        },
        {
          label: 'Components',
          items: [
            // Browsable, filterable overview of the whole component set —
            // pinned above the flat alphabetical list so it's the first
            // thing under the Components group.
            { label: 'Overview', link: '/components/' },
            ...buildComponentSidebar(),
          ],
        },
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'Contributing',
          autogenerate: { directory: 'contributing' },
        },
      ],
    }),
  ],
  vite: {
    plugins: [showcaseDirectoryIndex(PUBLIC_DIR)],
    optimizeDeps: {
      exclude: ['@awc-ui/core'],
      // Pre-bundle the theme generator's color engine at startup instead of
      // letting Vite discover it lazily. Rebuilding @awc-ui/core restarts Vite
      // and re-runs the optimizer, which stranded this dep behind a 504
      // "Outdated Optimize Dep". That killed the @awc-ui/theme import, which
      // killed the generator's whole page script -- no palette, and none of its
      // preview components ever registered.
      include: ['@material/material-color-utilities'],
    },
  },
});
