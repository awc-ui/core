# AWC Component Studio

A local playground for all 81 AWC components, built with AWC controls. Explore the
original web components, edit their properties, copy framework examples, inspect
test evidence, and compare them with live SwiftUI and Jetpack Compose adapters.

## Run

Install the workspace dependencies, then run from the repository root:

```sh
node packages/native-compiler/src/cli.mjs build
node apps/native-playground/build-studio-theme.mjs
node apps/native-playground/server.mjs
```

Open <http://127.0.0.1:4177>. `PORT` changes the port; the server binds only to
`127.0.0.1`. `pnpm native:playground` also starts the server. Component URLs are
shareable, for example <http://127.0.0.1:4177/?platform=ios#md-chip>.

The studio and web previews require the core web build in `packages/core/dist`.
Build it with the core package's existing build command, or use another local
build:

```sh
AWC_WEB_DIST=/absolute/path/to/core/dist node apps/native-playground/server.mjs
```

The generated native catalog supplies adapter support metadata. If that artifact
is missing, the studio falls back to the core custom elements manifest.
Refresh after regeneration.
Native previews additionally require the platform hosts described below.

## Explore components

The left catalog groups and searches all source tags; `/` focuses search. The
right configuration panel separates **Properties** and **CSS variables** into
tabs with declaration counts. Properties provides typed scalar, boolean, enum
and JSON editors, reset, and a property search. Mixed literal unions retain their actual types,
including values such as `false`. Info controls explain source types, defaults,
usage and native support. Hover, focus or tap for help; use Escape or click
outside to dismiss it.

Studio panels use AWC cards; API groups use AWC accordions. Event handler examples
and payload type definitions appear in compact cards with titles and descriptions.
Coverage source links use AWC lists.

The web preview runs in a dedicated same-origin iframe. Responsive, 360 px,
768 px and 1024 px widths change its actual viewport, so media queries respond
to the preview width. Canvas controls offer RTL, an 8 px grid with 64 px rulers,
and a live measurement inspector. The inspector reads rendered web geometry,
computed padding/margins/gaps, font size, line height, weight and direction;
hover inspection can select internal shadow parts without blocking clicks.
RTL changes start/end layout and icon order; centered text-only controls can
look identical in both directions.

Expanded studio keeps the canvas and editable Properties panel together, with
an explicit exit control and Escape support. When browser fullscreen is
unavailable, the same workspace expands inside the page. Native previews support
RTL; grid and measurement controls are enabled only in Web mode. Native pt/dp
dimensions and source resolution remain available in the preview diagnostics.

**Usage & API**, below the preview, has copyable HTML, React, Angular, Vue, Svelte,
SwiftUI and Android examples. Selecting a code language is independent of the
preview platform. Examples update from current properties and slot text, retain
composed children, and omit unchanged defaults unless the fixture or an explicit
edit supplies them. Web framework examples use the repository's public AWC
packages; native examples use `AWCNativeView`/`AWCNode` and `AWCComponent`.
Generated examples use inert recipe markup, never hydrated preview markup.

Code examples, payload types, theme code, Markdown instructions and test commands use local Shiki syntax
highlighting in light and dark mode. Copy preserves the original source exactly.
The checked-in bundle contains only the required grammars; rebuild it from the
existing workspace dependencies with `node apps/native-playground/build-syntax-highlighting.mjs`.

API sections document events and payloads, slots, methods, CSS parts, and
data/callback types. CSS variables are editable in their own tab in the right
configuration panel. Slot text and CSS edits update the relevant
examples and the live Web preview. Public web methods accept JSON argument
arrays. Native fixtures keep their own children; editing documentation slots does
not rewrite those fixtures. Native snippets preserve AWC children and slot text,
while HTML layout CSS and recipe setup callbacks require native layout or state
in the consuming app. Callbacks and object references remain application code.

Event entries explain `event.detail`, list source-declared fields with their
types and descriptions, and show handler examples alongside full type definitions
in compact detail cards. Info popovers stay open while the pointer moves onto
their content, so longer explanations can be read and scrolled.

**Events** displays recorded Web and native events. Member help and property
controls show per-platform support, including unsupported native members.
SwiftUI and Android examples remain available under **Usage & API**.

**AI instructions** provides a Markdown guide for every component. It preserves
the component's original Web README and appends separate iOS/SwiftUI and
Android/Jetpack Compose integration sections from the current native catalog,
generated public wrappers and each platform's own support policy. The guide
includes Swift and Kotlin examples, package/module setup, property support,
state and events, child slots, unsupported methods, native replacements and
verification limits. It distinguishes the local macOS SwiftUI preview from an
iOS Simulator or device run and documents the Android module's actual SDK and
build requirements. A generated field does not imply native adapter support.

Use **Copy** to copy the complete Markdown guide, **Download .md** to save
`md-component.md`, or **Refresh** to reread the local source files. Guides are
generated on demand through `GET /api/ai-instructions/<tag>`; the server does not
rewrite source READMEs or keep 81 duplicate Markdown files. The response contains
`filename`, `markdown` and repository-relative `sources` for provenance.

## Theme studio

The theme panel uses the actual `@awc-ui/theme` engine from `packages/theme`,
including its Material Color Utilities HCT computation. A primary seed derives
secondary and tertiary palettes automatically. Disable Auto to supply either
seed independently; light/dark mode and contrast regenerate both color schemes.
The panel includes role swatches, copyable setup code and CSS export.

Theme configuration persists in local storage when storage is available. The
studio and web iframe receive the computed color tokens. Native sessions receive
the same selected palette through the adapters' supported theme roles; changing
colors restarts the native preview. This updates native palette inputs, not
arbitrary CSS or every browser styling hook. Typography and component dimensions
remain defined by their respective renderers.

The browser theme bundle is generated from local workspace dependencies, with
its licenses included under `theme-vendor/`. Rebuild it after theme-engine changes
and verify it without modifying files:

```sh
node apps/native-playground/build-studio-theme.mjs
node apps/native-playground/build-studio-theme.mjs --check
node apps/native-playground/build-syntax-highlighting.mjs --check
```

## Test evidence

**Test coverage** has four tabs: **Unit**, **Component**, **End-to-end** and
**Accessibility**. Each lists matching source files, static declaration counts,
configuration evidence and copyable local test commands. Component evidence
includes Storybook and framework tests; accessibility evidence includes relevant
axe, ARIA, keyboard and focus checks and configured Storybook checks.

The panel reads saved reports; it never runs tests. LCOV and Istanbul reports
provide component-specific line, branch, function and, when available, statement
coverage. The latest report supplies percentages, progress bars and covered/total
counts. Alternative formats and separate runs are not added together.

Jest, Vitest and Playwright result reports supply executed pass/fail/skip counts
separately from code coverage. Accessibility results include only matching checks,
not every test in a file that happens to contain an axe scan. Planned tests without
execution results do not count as passed. Shared-file results are identified.

Each result links to its source report and shows when that file was saved; this
does not prove the run matches the current source revision. Without a matching
report, the panel retains source declaration counts and labels the missing data.
Declaration counts do not expand parameterized cases. Whole-library totals are
never substituted for the selected component. Accessibility results describe
automated checks, not WCAG conformance.

Generate reports with the repository's supported Node version and installed
Chromium browser:

```sh
pnpm --filter @awc-ui/core test:spec:coverage
node apps/native-playground/scripts/coverage/run-browser.mjs md-button
```

The unit command saves coverage and Jest outcomes in `packages/core/coverage-spec`.
The browser collector runs the existing Stencil and React tests with source maps,
writing reports to `packages/core/coverage-e2e` and
`apps/test-react/coverage-native`. Its isolated build leaves the studio's live
component distribution untouched. Failed assertions remain failed in the saved
report and produce a nonzero exit code. Use **Refresh** in Test coverage after a run.
The browser command accepts another component tag when matching suites exist;
append `--list` to inspect its scope without running tests or replacing reports.

## Live native previews

For SwiftUI, build the local host on macOS with the Swift/macOS SDK:

```sh
swift build --package-path apps/native-ios-playground
```

The browser's iOS/SwiftUI preview runs an actual **macOS SwiftUI view**, not an iOS
simulator. Each session owns a local `AWCLivePreview` process and retains native
state between inputs. Full iOS device validation still requires the native
playground and the appropriate Apple toolchain.

For Android, start a dedicated API 26+ emulator and install the debug playground:

```sh
export ANDROID_HOME=/absolute/path/to/android-sdk
export AWC_ANDROID_SERIAL=emulator-5554
cd apps/native-android-playground
./gradlew :app:assembleDebug
"$ANDROID_HOME/platform-tools/adb" -s "$AWC_ANDROID_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
cd ../..
node apps/native-playground/server.mjs
```

Open <http://127.0.0.1:4177/?platform=android#md-button>.
`AWC_ANDROID_SERIAL` is optional with exactly one connected emulator;
`AWC_ANDROID_ADB` can override the ADB executable. The transport does not select
physical devices, download SDKs, start emulators or install APKs. Hardware
emulator graphics (`-gpu host`) can improve animation performance.

Compose renders into an app-owned private Presentation at two physical pixels
per logical dp, independent of the emulator screen width. PixelCopy captures
that native GPU window after committed draws. Both platforms send lossless PNG
frames over a bounded NDJSON stream; the browser presents decoded frames with
`requestAnimationFrame`. Source resolution is available in the preview diagnostics. Android sends cached
heartbeats while idle, without recapturing or re-encoding the same surface.
Achievable animation speed depends on the host, component size and tab visibility.
SwiftUI Retina output is converted to sRGB.

Read-only `data-frame-metrics` on the native preview separates received frames,
fresh captures and image replacements. Android capture diagnostics include the
sequence, capture/encoding durations, source scale and dropped captures. Its
timestamp uses Android's monotonic clock, not the browser clock.

Clicks, text and supported keys operate the native view. Button press, release,
cancel and hover forwarding expose actual native press animations, including
keyboard activation. The Events inspector receives native adapter events;
JavaScript does not simulate component selection or text state. Focus the preview
to send keys; Escape returns keyboard control to the browser.

Changing initial props, theme, direction or viewport width starts a new native session. Grid and bounds inspection are available in Web mode. Navigation
closes the previous session, hidden tabs close their frame stream, and idle
sessions expire after 60 seconds. SwiftUI allows at most two sessions; Android
uses one per emulator. Reconnect creates a fresh view after expiry or an error.
Slow consumers retain the latest picture and a bounded event batch instead of
accumulating animation latency.

General dragging, scrolling, separate native windows and system menus are not
fully validated by this transport. Android Popup/Dialog windows are outside the
Activity capture, and long content is limited to the visible emulator surface.
Streamed pixels do not expose the native accessibility tree to browser assistive
technology. Use the native apps for complete platform interaction and
accessibility testing. Text rasterization remains platform-dependent; a working
preview does not establish full web/native parity.

For `md-button`, platform portability cards link to three native behavior demos:

- **HTML_FORM**: automatic field registration, validation, Enter/Submit, reset to
  initial values, encoded local form data and cancelable button/form actions.
- **DOM_GLOBAL / CANCELABLE_EVENT**: local navigation contexts, history and
  capture/target/bubble event propagation with cancellation controls.
- **Focus & accessibility**: Tab entry, horizontal arrow/Home/End group navigation
  without selection, and Enter/Space activation.

Demo links never open external pages or submit data over the network. Native
contexts, event scopes and accessibility roles are explicit native equivalents,
not browser DOM or window implementations. Selecting Button again restores its
normal component preview.

`AWC_NATIVE_LIVE_RENDERER` can select another built live executable.
`AWC_NATIVE_RENDERER` selects the standalone snapshot executable. The snapshot
endpoint remains available for tooling; the browser uses Live mode and does not
silently fall back to screenshots.

## Local boundary and checks

The server does not upload code or trigger builds. It serves a narrow set of
studio assets, documentation/test evidence, compiler artifacts and native source
files. Native endpoints accept bounded JSON and fixed commands without a shell;
input stays inside the host's own native window. Foreign origins, traversal and
symlink escapes are rejected. Only the dedicated preview document permits
same-origin framing. Snapshots use the ignored `.cache/native-playground/renders`
directory; live frames travel in memory.

Android uses the debug APK's authenticated loopback host and a temporary ADB
forward. Cleanup closes its Activity and removes only the owned forward, leaving
the emulator and ADB server running. The live host is absent from release builds.

```sh
node --test apps/native-playground/*.test.mjs
node apps/native-playground/build-studio-theme.mjs --check
node apps/native-playground/build-syntax-highlighting.mjs --check
```

Tests cover server boundaries, native request/session handling, documentation
state, typed property editors, all component recipes, framework snippet
syntax/templates and prop types, safe literals, theme computation and coverage
provenance. Native build and interaction suites live in the separate platform
projects; inspect their results independently of source evidence shown here.
