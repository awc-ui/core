/**
 * The server-rendered showcase builds, in one place.
 *
 * Two scripts need this list — `verify-ssr.mjs`, which proves each build renders
 * on the server, and `verify-ssr-adoption.mjs`, which proves the browser then
 * KEEPS that render — and `showcase-preview.mjs` proxies to them. A second copy
 * of a list like this is not a theoretical hazard: three of these builds each
 * kept a private copy of the framework list while their ids were new, and every
 * one of them drifted the moment another build was added.
 *
 * WHICH BUILDS ARE HERE IS NO LONGER TYPED OUT. It is `serverBuilds()` from
 * `showcase-verticals.mjs`, the registry every showcase script now reads. Today
 * that is credit-risk's four and nothing else, which is correct: a new vertical
 * ships five static builds and no SSR, because a static build is free to host
 * and a server-rendered one needs its own Netlify site, function, deploy and
 * proxy rule. The difference is that these harnesses are now credit-risk-only
 * BECAUSE THE REGISTRY SAYS SO. If that decision is ever revisited and some
 * vertical adds a server build, it appears here — and therefore in both
 * verifications — without anyone remembering to edit this file.
 *
 * WHAT IS STILL WRITTEN DOWN is what the registry cannot know: the port each app
 * is started on locally and the arguments that start it. Those are facts about
 * this machine and this toolchain, not about the showcase.
 */
import { basePathFor as basePathForBuild, serverBuilds } from './showcase-verticals.mjs';

/**
 * Ports and start arguments, per build — the local half of an app.
 *
 * `start` must run a REAL server. A static file server would pass the first
 * script's "did it arrive without a browser" question and correctly fail its
 * "was it rendered for this request" one.
 *
 * `start` is per app because these commands are not one shape. Each app's own
 * `server.mjs` already defaults to the port beside it here and takes `$PORT`
 * ahead of that, which is what `showcase-preview.mjs` sets; `next` is
 * additionally handed its port on the command line, where the `-p` is inert —
 * `server.mjs` reads the bare number — and survives from when that script was
 * `next start`. Left exactly as it was: it works, and rewriting a working start
 * command is not what generalising this file is for.
 *
 * The ports are PINNED rather than derived for the same reason: they are the
 * numbers these apps have always answered on, the ones each `server.mjs`
 * defaults to, and the ones the four READMEs quote.
 */
const LOCAL = {
  'credit-risk': {
    next: { port: 4610, start: ['start', '--', '-p', '4610'] },
    nuxt: { port: 4611, start: ['start'] },
    sveltekit: { port: 4612, start: ['start'] },
    'angular-ssr': { port: 4613, start: ['start'] },
  },
};

/**
 * A server build the registry has and `LOCAL` does not still has to run, so it
 * gets the first free port at or above the floor, in registry order, and the
 * plain `pnpm start`. That is a working default rather than a guess dressed up
 * as configuration — it exists so that adding a vertical with SSR does not
 * silently drop out of the verifications, and it deliberately cannot move an
 * existing app: every port named in `LOCAL` is claimed before any is handed out.
 */
const PORT_FLOOR = 4610;
const DEFAULT_START = ['start'];

const claimed = new Set(
  Object.values(LOCAL).flatMap((byFramework) => Object.values(byFramework).map((l) => l.port)),
);
let scan = PORT_FLOOR;
const allocatePort = () => {
  while (claimed.has(scan)) scan++;
  claimed.add(scan);
  return scan;
};

/**
 * The server-rendered builds: registry membership and order, local ports.
 *
 * The order is the registry's — the dock order, where each SSR build sits
 * beside the SPA it mirrors — which is also the order the proxy rules appear in
 * `apps/docs/netlify.toml`, and therefore the order `showcase-preview.mjs`
 * claims to mirror. Nothing here depends on it: each server is started, probed
 * and stopped before the next one begins.
 */
export const SSR_APPS = serverBuilds().map((build) => {
  const local = LOCAL[build.vertical]?.[build.framework];
  return {
    /* Frameworks are unique across server builds while credit-risk is the only
       vertical with any, so the bare framework name is still the id the CLI
       takes. `vertical` is carried so that stops being an assumption the moment
       it needs to. */
    id: build.framework,
    vertical: build.vertical,
    dir: `apps/showcase/${build.vertical}/${build.framework}`,
    /* The registry already named the package; nothing here rebuilds that string. */
    pkg: build.pkg,
    base: basePathForBuild(build.vertical, build.framework),
    port: local?.port ?? allocatePort(),
    start: local?.start ?? DEFAULT_START,
  };
});

/* A `LOCAL` entry for a build the registry does not have is dead weight that
   reads like configuration — the exact drift this file exists to prevent, only
   pointing the other way. Ports are never invented for builds that do not
   exist, so say so loudly rather than carrying it. */
for (const [vertical, byFramework] of Object.entries(LOCAL)) {
  for (const framework of Object.keys(byFramework)) {
    if (!SSR_APPS.some((a) => a.vertical === vertical && a.id === framework)) {
      throw new Error(
        `[ssr-apps] LOCAL has a port for ${vertical}/${framework}, which is not a server ` +
          `build in scripts/lib/showcase-verticals.mjs. Remove it, or add the build there.`,
      );
    }
  }
}

/* And the assumption the ids rest on, checked rather than trusted: both CLIs
   select an app by framework name, so two verticals shipping the same
   server-rendered framework would have one of them quietly stand in for the
   other. Fail here instead, where the fix is obvious. */
const duplicated = SSR_APPS.map((a) => a.id).filter((id, i, all) => all.indexOf(id) !== i);
if (duplicated.length) {
  throw new Error(
    `[ssr-apps] two verticals both ship a server-rendered "${duplicated[0]}" build. Ids are ` +
      `framework names, so these harnesses can no longer tell them apart: give the apps ` +
      `vertical-qualified ids before adding the second one.`,
  );
}

/**
 * The build whose hydration behaviour the others are measured against.
 *
 * NOT the registry's `reference` for credit-risk, which is `react`: that one is
 * the baseline for the static parity comparison, and a client-rendered SPA has
 * no server render for anything here to be measured against. This is a fact
 * about the SSR harness, so it lives with the harness.
 */
export const REFERENCE = 'next';

/**
 * Every screen, so a defect confined to one of them cannot hide.
 *
 * These are credit-risk's routes, and they are not in the registry because they
 * are not the registry's business — it records which builds exist, not what is
 * inside them. That is safe precisely as long as credit-risk is the only
 * vertical with server builds; a second one would need its own screen list
 * here, keyed by vertical, before these paths were probed against it.
 */
export const SCREENS = [
  '',
  'watchlist/',
  'stress/',
  'sectors/energy/',
  'counterparties/cp-01/',
  'facilities/fac-001/',
];

const appById = (id) => {
  const app = SSR_APPS.find((a) => a.id === id);
  if (!app) throw new Error(`[ssr-apps] no server build with id "${id}"`);
  return app;
};

/* Both derived from the registry now, via the app itself. They take a bare id
   because that is what callers hold — the harnesses and the preview server all
   identify an app by the framework name the CLI accepts. */
export const packageFor = (id) => appById(id).pkg;
export const basePathFor = (id) => appById(id).base;
