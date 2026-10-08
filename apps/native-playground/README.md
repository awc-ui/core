# AWC native compiler lab

A dependency-free browser workbench for the AWC native compiler. It presents the
original web components as an interactive **web reference**, alongside the actual
SwiftUI and Jetpack Compose output and explicit portability coverage. On macOS,
the SwiftUI tab also displays real native snapshots rendered by the local
`AWCSnapshots` executable.

## Run

From the repository root, install the workspace dependencies and generate the
native sources:

```sh
node packages/native-compiler/src/cli.mjs build
swift build --package-path apps/native-ios-playground --product AWCSnapshots
node apps/native-playground/server.mjs
```

Open <http://127.0.0.1:4177>. `PORT` overrides the port; the server always binds to
`127.0.0.1`.
Use <http://127.0.0.1:4177/?platform=ios#md-chip> to open Chip directly in the
SwiftUI preview. The selected platform is preserved in the URL when switching tabs.

The web reference requires `packages/core/dist`. Build it using the existing core
package build, or point at an existing AWC build:

```sh
AWC_WEB_DIST=/absolute/path/to/core/dist node apps/native-playground/server.mjs
```

The native inspector works without the web build. If generated output is missing,
the component browser falls back to the core custom elements manifest and clearly
marks compiler output as unavailable. Refresh after regenerating native sources.

The Swift build is optional for source inspection and requires macOS with the
Swift/macOS SDK. It enables native images for all 81 components. The renderer
merges inspector properties into each native example, preserving that example's
children, then renders with SwiftUI and AppKit. Editing properties or the theme
requests a new image; identical requests are cached until the executable changes.
`AWC_NATIVE_RENDERER` can point at an executable built in another directory.

These are **macOS SwiftUI snapshots**, not iOS simulator screenshots. They are
static images: interact through the inspector, or launch a native playground for
direct control interaction. Web slots and event behavior are not translated into
the snapshots. The Android tab still provides source inspection and launch
directions for its native playground. Existing API gaps remain visible.

## Included

- All 81 source custom elements, grouped and searchable, with shareable hash URLs.
- Explicit web examples for every element, including table, menu, navigation,
  select, tabs, stepper, and accordion children composed in their parent context.
- Live scalar, boolean, enum and JSON property editing, plus reset. Mixed literal
  unions preserve boolean and numeric values (for example, `multiline=false`).
- Light/dark themes, locally served fonts and icons, responsive layout, and the
  `/` keyboard shortcut for search.
- Native SwiftUI snapshots with loading/error states, retry, and cancellation of
  stale results when navigating or changing the inspector.
- Web event capture, contract metadata, compiler IR, actual generated source
  excerpts, complete-file links, and native runtime source links.
- Per-platform supported and unsupported property/event/method/slot coverage.
  Navigation findings combine static diagnostics and native API gaps.
  Static findings, adapter implementation and native parity are kept distinct.
- Launch directions for the separate native iOS and Android playgrounds.

No code is uploaded and no build is triggered by this server. It serves the
workbench assets, selected native source directories, generated compiler artifacts,
core manifest, fonts, the configured web build and generated PNGs. Its local
`POST /api/native-render` endpoint accepts bounded JSON requests for known tags
and invokes a fixed native executable without a shell. It rejects foreign origins,
traversal and symlink escapes, and uses a same-origin content policy. All other
routes support GET/HEAD only. Generated images live in the ignored
`.cache/native-playground/renders` directory.

## Checks

```sh
node --test apps/native-playground/*.test.mjs
```

The tests cover route traversal, private-file exposure, symlink escape handling,
external web build roots, intentional reference recipes for every current
manifest element, typed render payloads, stale-result cancellation, render request
validation, caching, process failures, mixed literal value round-trips and
coverage-only findings. Native builds and interaction tests belong to the separate
platform projects; snapshots do not establish native parity.
