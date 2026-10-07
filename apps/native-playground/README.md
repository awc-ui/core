# AWC native compiler lab

A dependency-free browser workbench for the AWC native compiler. It presents the
original web components as an interactive **web reference**, alongside the actual
SwiftUI and Jetpack Compose output and explicit portability coverage. The browser
never claims to render native UI.

## Run

From the repository root, install the workspace dependencies and generate the
native sources:

```sh
node packages/native-compiler/src/cli.mjs build
node apps/native-playground/server.mjs
```

Open <http://127.0.0.1:4177>. `PORT` overrides the port; the server always binds to
`127.0.0.1`.

The web reference requires `packages/core/dist`. Build it using the existing core
package build, or point at an existing AWC build:

```sh
AWC_WEB_DIST=/absolute/path/to/core/dist node apps/native-playground/server.mjs
```

The native inspector works without the web build. If generated output is missing,
the component browser falls back to the core custom elements manifest and clearly
marks compiler output as unavailable. Refresh after regenerating native sources.

## Included

- All 81 source custom elements, grouped and searchable, with shareable hash URLs.
- Explicit web examples for every element, including table, menu, navigation,
  select, tabs, stepper, and accordion children composed in their parent context.
- Live scalar, boolean, enum and JSON property editing, plus reset. Mixed literal
  unions preserve boolean and numeric values (for example, `multiline=false`).
- Light/dark themes, locally served fonts and icons, responsive layout, and the
  `/` keyboard shortcut for search.
- Web event capture, contract metadata, compiler IR, actual generated source
  excerpts, complete-file links, and native runtime source links.
- Per-platform supported and unsupported property/event/method/slot coverage.
  Navigation findings combine static diagnostics and native API gaps.
  Static findings, adapter implementation and native parity are kept distinct.
- Launch directions for the separate native iOS and Android playgrounds.

No code is uploaded and no build is triggered by this server. It only serves the
workbench assets, selected native source directories, generated compiler artifacts,
core manifest, fonts and the configured web build. It rejects traversal and
symlink escapes, supports only GET/HEAD, and uses a same-origin content policy.

## Checks

```sh
node --test apps/native-playground/server.test.mjs
```

The tests cover route traversal, private-file exposure, symlink escape handling,
external web build roots, intentional reference recipes for every current
manifest element, mixed literal value round-trips, and coverage-only findings. Native builds and interaction tests belong to the separate
platform projects; browser rendering does not establish native parity.
