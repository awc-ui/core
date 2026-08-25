/**
 * One assignment, and the import that brings it in has to come first.
 *
 * `dist/server/server.mjs` is the compiled `src/server.ts`, and the last thing
 * that file does at module scope is `server.listen(port)` — correct for
 * `pnpm start`, which is the whole reason the Node target still exists, and
 * pointless inside a Lambda that has no port to hold. `src/server.ts` skips the
 * listen when `AWC_SSR_EMBEDDED` is set, so the flag has to be set BEFORE that
 * module initialises.
 *
 * A `process.env` assignment in `ssr.mjs`'s own body would be too late: static
 * `import`s are hoisted and their modules initialise before any statement in
 * the importing file runs. A bare import of a module that does nothing but set
 * the flag is not: ES modules initialise in the order they are imported, so
 * `import './lib/embedded.mjs'` on the line above `import { app } from
 * '../../dist/server/server.mjs'` runs first, by specification rather than by
 * luck. `@netlify/angular-runtime` uses the same shape — `polyfill.mjs`,
 * imported first — for the same reason.
 *
 * WHY THIS FILE LIVES IN `lib/` AND MUST NOT BE MOVED BACK UP. Netlify treats
 * every file at the TOP LEVEL of the functions directory as its own function.
 * While this sat at `netlify/functions/embedded.mjs` it was deployed as one:
 * `netlify dev` reported `Loaded function embedded`, bundled it into its own
 * zip, and published it at `/.netlify/functions/embedded`, where it answered
 * `500 TypeError: lambdaFunc[lambdaHandler] is not a function` — it exports no
 * handler, because it is not a function. Inside a subdirectory the rule is
 * different: only a file named after its directory (`lib/lib.mjs`) or
 * `lib/index.mjs` is an entry point, so `lib/embedded.mjs` is support code and
 * `ssr.mjs` is the only function this app deploys. Nothing about the import
 * ordering changes — a bare import of a local module is a bare import wherever
 * the module sits.
 *
 * KEEP THIS FILE SIDE-EFFECT ONLY AND IMPORT IT WITHOUT BINDINGS. esbuild, the
 * bundler Netlify runs over this directory, drops unused named imports; it does
 * not drop a bare import of a local module, and it does not treat a store into
 * `process.env` as removable.
 *
 * Failure here is quiet rather than fatal — if the flag never arrives the
 * function still answers, it has just also bound :4613 inside the sandbox, and
 * held the event loop open with it. `scripts/verify-netlify-function.mjs`
 * checks the flag explicitly after importing the handler, so the quiet failure
 * is the loud one there instead.
 */
process.env.AWC_SSR_EMBEDDED = '1';
