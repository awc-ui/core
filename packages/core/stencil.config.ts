import { Config } from '@stencil/core';
import { angularOutputTarget } from '@stencil/angular-output-target';
import { reactOutputTarget } from '@stencil/react-output-target';
import { vueOutputTarget } from '@stencil/vue-output-target';

export const config: Config = {
  namespace: 'md3',
  sourceMap: true,
  minifyJs: true,
  minifyCss: true,
  // NOTE: no `globalStyle`. With it set, Stencil embedded the full 14 kB token
  // stylesheet as a JS string inside the custom-elements runtime chunk — while
  // every consumer ALSO imports the same tokens as real CSS
  // ('@awc-ui/core/css/tokens.css'), i.e. the tokens shipped twice (~2.7 kB gz
  // of pure waste per app). Tokens are CSS custom properties: they inherit
  // through shadow boundaries from the document, so per-shadow-root injection
  // was redundant. dist/md3/md3.css (the "./css/tokens.css" export target) is
  // now produced by scripts/emit-tokens-css.mjs in the build chain, and the
  // www dev server gets the sheet via the copy task on the www target below.
  outputTargets: [
    reactOutputTarget({
      // react-output-target 1.x: SSR-capable wrappers. `hydrateModule` turns on
      // server rendering (generates components.server.ts alongside the client
      // components.ts); `clientModule` is where the server wrappers import the
      // client components from for hydration.
      outDir: '../react/src',
      stencilPackageName: '@awc-ui/core',
      hydrateModule: '@awc-ui/core/hydrate',
      clientModule: '@awc-ui/react',
    }),
    angularOutputTarget({
      componentCorePackage: '@awc-ui/core',
      // `standalone`: each generated component is standalone and statically
      // imports + registers its own custom element from the tree-shakable
      // dist-custom-elements build. Consumers add components to `imports: []`
      // and bundle only what they use; the lazy-loader bootstrap
      // (provideAwcUi()/defineCustomElements) is no longer required, though it
      // remains harmless — element definition is idempotent.
      outputType: 'standalone',
      customElementsDir: 'dist/components',
      directivesProxyFile: '../angular/src/directives/proxies.ts',
      directivesArrayFile: '../angular/src/directives/index.ts',
      // ControlValueAccessor directives, so [(ngModel)] and formControlName bind
      // to these controls. Without them Angular has no way to read or write a
      // custom element's value, and reactive forms — the default in most Angular
      // apps — simply do not work, however well the element behaves natively.
      //
      // `event` is the one the accessor listens on to push values INTO the form
      // model, so it must be the COMMIT event, not the keystroke one: mdChange
      // everywhere, and mdInput only for the text-like controls where Angular
      // expects per-keystroke updates.
      //
      // `targetAttr` is the property the accessor writes back. Note md-switch
      // uses `selected`, NOT `checked` like checkbox/radio — writing `checked`
      // there would silently no-op, since it is not a property the component
      // defines.
      valueAccessorConfigs: [
        {
          elementSelectors: ['md-text-field', 'md-autocomplete', 'md-otp-field'],
          event: 'mdInput',
          targetAttr: 'value',
          type: 'text',
        },
        {
          elementSelectors: ['md-select', 'md-multi-select', 'md-date-picker', 'md-time-picker'],
          event: 'mdChange',
          targetAttr: 'value',
          type: 'select',
        },
        {
          // md-switch is deliberately NOT here. Two configs sharing a `type`
          // are MERGED into one generated directive, which can only carry one
          // targetAttr — the result hardcoded writeValue to `.checked` while
          // reading `.selected`, breaking both controls. md-switch uses
          // `selected`, so it gets its own hand-written accessor in
          // ../angular/src/directives/switch-value-accessor.ts.
          elementSelectors: ['md-checkbox'],
          event: 'mdChange',
          targetAttr: 'checked',
          type: 'boolean',
        },
        {
          elementSelectors: ['md-radio'],
          event: 'mdChange',
          targetAttr: 'checked',
          type: 'radio',
        },
        {
          elementSelectors: ['md-rating', 'md-slider', 'md-number-field'],
          event: 'mdChange',
          targetAttr: 'value',
          type: 'number',
        },
      ],
    }),
    vueOutputTarget({
      componentCorePackage: '@awc-ui/core',
      proxiesFile: '../vue/lib/components.ts',
      // Per-component static registration from the tree-shakable
      // dist-custom-elements build. The previous `includeDefineCustomElements`
      // mode called the lazy loader's defineCustomElements() at module top
      // level, registering all components the moment anything was imported —
      // unshakeable by construction. Now each proxy imports and defines only
      // its own element, so consumers bundle exactly what they use.
      includeImportCustomElements: true,
      customElementsDir: 'dist/components',
    }),
    {
      type: 'dist',
      isPrimaryPackageOutputTarget: true,
    },
    {
      // SSR / server-render entry: generates `hydrate/` with renderToString,
      // streamToString and hydrateDocument — a Node-safe DOM-mock renderer that
      // emits Declarative Shadow DOM for the (all-shadow) component set.
      type: 'dist-hydrate-script',
      dir: 'hydrate',
    },
    {
      type: 'dist-custom-elements',
      customElementsExportBehavior: 'auto-define-custom-elements',
      generateTypeDeclarations: true,
      // Required by the react-output-target 1.x SSR wrappers: bundle each
      // component's runtime so the generated React components are self-contained.
      externalRuntime: false,
    },
    // docs-readme is DELIBERATELY DISABLED. It rewrites every component's
    // readme.md below the `<!-- Auto Generated Below -->` marker on each build,
    // and the readmes are hand-owned: they carry the LLM-first material (when
    // to use, decision cues, behavioural contract, M3-sourced do/don't,
    // anti-patterns) that the AI manifest is built from.
    //
    // Nothing consumes the generated half, so turning it off costs no accuracy:
    //   - the docs site's API tables come from scripts/generate-docs.mjs, which
    //     parses the TSX/CSS directly, never the readme;
    // Re-enable temporarily if you want the API tables in the readmes
    // refreshed, then review the diff before committing.
    // { type: 'docs-readme' },
    {
      type: 'www',
      serviceWorker: null,
      // index.html links /build/md3.css; with `globalStyle` gone (see above)
      // the dev server gets the token sheet via a plain copy instead.
      copy: [{ src: '../node_modules/@awc-ui/tokens/src/tokens.css', dest: 'build/md3.css' }],
    },
  ],
  testing: {
    browserHeadless: 'new',
  },
};
