/**
 * Every showcase vertical, and the builds each one ships.
 *
 * WHY THIS EXISTS. The showcase was written when there was exactly one
 * vertical, so `credit-risk` was spelled into `build-showcase.mjs`, both
 * verification scripts and the SSR harness. A second vertical could not be
 * added without editing all of them, and the failure mode is the quiet kind: a
 * script that still passes while silently measuring only the first vertical.
 * The list lives here now, and everything reads it.
 *
 * NEW VERTICALS SHIP FIVE BUILDS: html, react, vue, angular, svelte — the
 * plain-HTML build plus the four single-page applications. That is a deliberate
 * limit, not an accident of what has been written so far.
 *
 * NO SSR IN A NEW VERTICAL, and the reason is cost rather than taste. A static
 * build is free to host: `build-showcase.mjs` stages it into
 * `apps/docs/public/showcase/<vertical>/<framework>/` and the existing
 * awc-ui.dev site serves it, no extra infrastructure of any kind. A
 * server-rendered build needs its own Netlify site, its own function, its own
 * deploy, and its own proxy rule in `apps/docs/netlify.toml` — four moving
 * parts per build, permanently.
 *
 * `credit-risk` keeps its ten. Its four SPA/SSR pairs are the evidence that
 * these components server-render at all, which is a claim the library makes and
 * has to be able to show. That evidence only needs to exist once.
 */

/** `@awc-ui/showcase-<vertical>-<framework>` — the one naming rule. */
export const packageFor = (vertical, framework) => `@awc-ui/showcase-${vertical}-${framework}`;

/** Where a vertical's builds are staged for the docs site to serve. */
export const stagedPathFor = (vertical, framework) => `showcase/${vertical}/${framework}`;

/** The public path a build is compiled against, and answers on. */
export const basePathFor = (vertical, framework) => `/showcase/${vertical}/${framework}`;

/**
 * The five builds a new vertical ships.
 *
 * `output` is where that toolchain writes, and it is the only thing that
 * differs between them — Angular's builder nests a `browser/` directory, the
 * rest write `dist/`. Spread this into a vertical's `builds` and add nothing
 * unless there is a reason that survives being asked about.
 */
export const SPA_BUILDS = Object.freeze([
  { framework: 'html', output: 'dist' },
  { framework: 'react', output: 'dist' },
  { framework: 'vue', output: 'dist' },
  { framework: 'angular', output: 'dist/browser' },
  { framework: 'svelte', output: 'dist' },
]);

/**
 * Builds that render per request. `server: true` and no `output`, because there
 * is nothing to stage: the build product is the input to a Node process, not a
 * servable directory. See the `server` branch in `build-showcase.mjs`.
 */
const CREDIT_RISK_SSR = Object.freeze([
  { framework: 'next', server: true },
  { framework: 'nuxt', server: true },
  { framework: 'angular-ssr', server: true },
  { framework: 'sveltekit', server: true },
]);

/**
 * The verticals.
 *
 * `builds` is in DOCK DISPLAY ORDER, and for credit-risk that order is load
 * bearing: each SSR build sits directly after the SPA it mirrors, because the
 * adjacency is the point — same screens, same components, differing only in
 * where the first render happened.
 */
export const VERTICALS = Object.freeze([
  {
    id: 'credit-risk',
    title: 'Aurelia Bank — Credit Risk Console',
    /* The only vertical with SSR, and the only one that ever will be unless
       the decision above is revisited. */
    builds: Object.freeze([
      { framework: 'html', output: 'dist' },
      { framework: 'astro', output: 'dist' },
      { framework: 'react', output: 'dist' },
      { framework: 'next', server: true },
      { framework: 'vue', output: 'dist' },
      { framework: 'nuxt', server: true },
      { framework: 'angular', output: 'dist/browser' },
      { framework: 'angular-ssr', server: true },
      { framework: 'svelte', output: 'dist' },
      { framework: 'sveltekit', server: true },
    ]),
    /* The build every other one in this vertical is compared against. */
    reference: 'react',
    /* The two that route locale through the URL rather than client state, so a
       comparison has to look one path segment deeper. */
    localeRouted: Object.freeze(['html', 'astro']),
  },
  {
    id: 'wealth',
    title: 'Kestrel Private Bank — Wealth Management Console',
    /* Five builds, no SSR — the decision at the top of this file. The order is
       the dock's, and it matches FRAMEWORKS in the kit's wealth routes. */
    builds: Object.freeze([...SPA_BUILDS]),
    /* The build the other four are compared against, same as credit-risk. */
    reference: 'react',
    /* Only the plain-HTML build puts the locale in the path — it writes a page
       per locale at build time. The four SPAs hold locale in client state. */
    localeRouted: Object.freeze(['html']),
  },
  {
    id: 'banking',
    title: 'Vela — Money & Investing',
    /* Five builds, no SSR. This one is behind a login by premise, so there is
       no anonymous first paint a server render would improve. */
    builds: Object.freeze([...SPA_BUILDS]),
    reference: 'react',
    localeRouted: Object.freeze(['html']),
  },
  {
    id: 'social',
    title: 'Lyra — Photos & People',
    /*
     * ONE BUILD SO FAR, and this list says so rather than promising five.
     *
     * The vertical is headed for the same five as the two above — no SSR, for
     * the same reason: a personal feed has no anonymous first paint to
     * server-render. `builds` is what the deploy's pre-flight, the parity check
     * and the a11y check all read, so an entry was added here only as each port
     * landed — listing one that does not exist yet turns every one of those
     * red on a build that is simply not written. All five are here now.
     */
    builds: Object.freeze([
      { framework: 'react', output: 'dist' },
      { framework: 'vue', output: 'dist' },
      { framework: 'angular', output: 'dist/browser' },
      { framework: 'svelte', output: 'dist' },
      { framework: 'html', output: 'dist' },
    ]),
    reference: 'react',
    /*
     * `localeRouted` MUST NEVER NAME A FRAMEWORK `builds` DOES NOT, and that
     * had to be learned rather than reasoned: naming `html` here while `builds`
     * still held only `react` sent verify-showcase-a11y at
     * `/showcase/social/html/ar/`, which 404s — and three assertions then
     * failed against the "not found" page rather than skipping. The two moved
     * together when the HTML port landed.
     */
    localeRouted: Object.freeze(['html']),
  },
]);

export const verticalById = (id) => VERTICALS.find((v) => v.id === id);

/** Every build across every vertical, flattened, each carrying its vertical. */
export const allBuilds = () =>
  VERTICALS.flatMap((v) =>
    v.builds.map((b) => ({
      ...b,
      vertical: v.id,
      pkg: packageFor(v.id, b.framework),
    })),
  );

/** The builds that produce a servable directory — the ones staged for the docs site. */
export const staticBuilds = (verticalId) =>
  allBuilds().filter((b) => !b.server && (!verticalId || b.vertical === verticalId));

/** The builds that need a live process, and so are deployed and proxied separately. */
export const serverBuilds = (verticalId) =>
  allBuilds().filter((b) => b.server && (!verticalId || b.vertical === verticalId));

export { CREDIT_RISK_SSR };
