import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'url';
import path from 'path';



const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Storybook stories run as Vitest browser tests: each story mounts in a real
 * Chromium page and its `play()` becomes the test body.
 *
 * Replaces @storybook/test-runner, which could not start — it needs jest 30
 * while @awc-ui/core's spec suite pins jest 29, and only one of them can be the
 * hoisted root. Vitest takes jest out of the Storybook side altogether.
 */
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: path.join(dirname, '.storybook'),
      // Use an ALREADY-RUNNING Storybook rather than spawning one.
      //
      // storybookScript spawns a second full stack — including a second Stencil
      // build:watch — which cannot bind 6006 while the dev server holds it, so
      // it hangs forever and the dev Storybook appears to "load indefinitely"
      // while two watchers fight over dist.
      //
      // CI should start Storybook first (or serve storybook-static) and set
      // this URL; that keeps one server, one watcher, one owner of the port.
      storybookUrl: process.env.STORYBOOK_URL || 'http://localhost:6006',
    }),
  ],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      // Vitest 4 takes a provider FACTORY, not the old string name. The string
      // form silently resolves to a different provider than the Storybook addon
      // uses, which is what made the in-UI "Run tests" button fail with
      // ERR_CONNECTION_REFUSED while the CLI worked.
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    // Components are custom elements that hydrate asynchronously; the default
    // 5s is far too tight. 120s because the ten-million-row virtualized grid
    // packs its dataset into WASM on mount and then gets an axe pass — that
    // story sat right on a 60s ceiling and failed only when the machine was
    // busy, which is the worst kind of flake to debug.
    testTimeout: 120000,
    setupFiles: ['./.storybook/vitest.setup.ts'],
    /**
     * Coverage is DISABLED here, deliberately and at config level.
     *
     * The Vitest addon offers a "Coverage" checkbox in its panel. Ticking it
     * made the addon write an istanbul report into Storybook's cache dir and
     * serve it at /coverage/ — measuring apps/storybook (the stories, helpers
     * and i18n files, i.e. the TEST HARNESS) while reading exactly like library
     * coverage. Deleting the report was not enough: every run regenerated it.
     *
     * It cannot be made to measure the library either. The provider only
     * attributes files that reach Vite's module graph, and Stencil's lazy
     * loader fetches component chunks at runtime, so they never do. Four routes
     * were tried — include + allowExternal, aliasing the entry to the
     * custom-elements build, rebuilding that unminified with maps, and inlining
     * the maps with pre-bundling — and each reported 0/0 or attributed built
     * dist files instead of .tsx. The alias route additionally crashed the suite
     * with a stack overflow in md-text-field.
     *
     * Real library coverage is `pnpm test:coverage`, served at
     * /library-coverage/: it drives the stories in a real browser and remaps V8
     * onto packages/core/src with monocart, which follows sourceMappingURL
     * itself rather than relying on a bundler's module graph.
     */
    coverage: { enabled: false, provider: 'v8', reportsDirectory: './.vitest-coverage-unused' },


  },
});
