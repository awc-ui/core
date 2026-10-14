# AWC UI Laboratory

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
Native previews additionally require the platform hosts described below. The
header uses the library’s inline `md-status-dot`: a live pulse indicates the Web
runtime and native catalog are connected; reduced-motion preferences are respected.

## Explore components

The left catalog uses AWC’s expanded `md-navigation-rail` and its destination
components. Its 56 entries, eight groups, titles and order come directly from
Astro Docs (`apps/docs/astro.config.mjs` and `apps/docs/src/data/components.json`),
including the same exclusions for parts documented with their parent. All 81
source contracts remain available by direct component URL. `/` focuses search;
search matches documented titles, tags and groups.

The right configuration panel separates **Properties** and **Styles** into
tabs with declaration counts. Styles groups every declared public CSS hook into
surface, text, icons, layout, interaction and motion sections, with readable labels,
search and Reset styles. CSS values retain units and variable expressions; invalid
edits keep the last valid preview. Clearing an override restores its fixture value.
Properties provides typed scalar, boolean, enum
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
Menu, dialog, sheet and snackbar launch/close handlers are included in copied Web
examples. Opening a picker or overlay expands the Web canvas and closing it
restores the compact preview. Native framework tabs also provide complete content,
state and theme examples for each component, using its actual adapter policy.

Code examples, payload types, theme code, Markdown instructions and test commands use local Shiki syntax
highlighting in light and dark mode. Copy preserves the original source exactly.
The checked-in bundle contains only the required grammars; rebuild it from the
existing workspace dependencies with `node apps/native-playground/build-syntax-highlighting.mjs`.

API sections document events and payloads, slots, methods, CSS parts, and
data/callback types. CSS variables are editable in their own tab in the right
configuration panel. `md-button` also has a shared appearance
editor with 22 color, typography, spacing, icon, loader and interaction fields.
Edits apply to the current button; blank fields use component defaults.
Reset style clears these local overrides. The former Studio-wide appearance
defaults are retired, including their saved browser values. Web CSS overrides remain in a separate accordion.
Shared edits update all three previews and their usage code. Native apps use
`AWCButtonAppearance` with SwiftUI’s `.awcButtonAppearance(...)` or Compose’s
`AWCButtonAppearanceScope`; CSS selectors stay Web-only. Android typography uses
scalable sp; the Swift adapter uses fixed point sizes.

Slot text and Web CSS edits update the relevant
examples and the live Web preview. Public web methods accept JSON argument
arrays with source-backed sample arguments. Text editors are offered only for
plain-content slots; structural, icon and action slots keep their child components.
Supported text edits also update the native previews, including empty content.
The transport bounds each slot to 4096 UTF-8 bytes and preserves literal markup
as text. Native snippets preserve AWC children and supported slot text,
while HTML layout CSS and recipe setup callbacks require native layout or state
in the consuming app. Callbacks and object references remain application code.

API examples follow the chosen HTML, React, Angular, Vue, Svelte, SwiftUI or
Android framework. Each event, slot, method and part has a copyable recipe or an
explicit support boundary. Event entries show framework handlers; Web payload
fields remain readable, with full TypeScript definitions in optional disclosures.
Native examples use actual callbacks, content APIs and appearance equivalents. Info popovers stay open while the pointer moves onto
their content, so longer explanations can be read and scrolled.

**Events** displays recorded Web and native events. Member help and property
controls show per-platform support, including unsupported native members.
SwiftUI and Android examples remain available under **Usage & API**.

**AI instructions** provides a Markdown guide for every component. It preserves
the component's original Web README and appends separate iOS/SwiftUI and
Android/Jetpack Compose integration sections from the current native catalog,
generated public wrappers and each platform's own support policy. The guide
includes Swift and Kotlin examples, package/module setup, property support,
state and events, per-member native recipes, child slots, unsupported methods, native replacements and
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
configuration evidence and copyable local test commands below compact coverage
cards. Library `md-meter` components use the existing Istanbul/Monocart bands:
red below 50%, amber from 50% to below 80%, green from 80%. These colors describe
coverage, not whether tests passed. Missing measurements stay neutral.
Accessibility has no measured code-coverage percentage, so its tab says so rather
than converting audit outcomes into one. These reports describe the Web library,
not native-device test coverage.

The panel reads saved reports; it never runs tests. LCOV and Istanbul reports
provide component-specific line, branch, function and, when available, statement
coverage. Each runner has its own latest run, percentages and covered/total counts.
Unit/mock-DOM, Stencil browser, Storybook and framework-project results remain
separate; their instrumentation can produce different executable denominators.
Alternative formats and separate runs are not added together.
Source coverage can come from initialization or use inside another component's
tests. The evidence model retains that attribution. The panel does not present
the percentage as behavioral validation or invent a component pass count.

Jest, Vitest and Playwright result reports supply executed pass/fail/skip counts
separately from code coverage. Accessibility results include only matching checks,
not every test in a file that happens to contain an axe scan. Planned tests without
execution results do not count as passed. Shared-file results are identified.
Storybook records the configured axe hook's actual reports. A passing story does
not make its axe audit pass: nonblocking violations, incomplete findings and
audit errors retain their own outcomes. Related test cases are not audit counts.
The React, Vue and Svelte component-test project labels identify their actual
harness; a project name alone does not establish framework-wrapper coverage.

The collectors create `run-evidence.json` before execution and seal it afterward
with a run ID, command, intended test files, start/completion times, exit code,
input-file fingerprints and SHA-256 hashes of the generated reports. The reader
links coverage and outcomes only when the saved artifact contents match that run.
It also compares captured inputs with the current checkout and checks whether
inputs changed during execution. Git revision is recorded for context; it is not
used as a substitute for checking uncommitted inputs. Changed test definitions
cannot be used to reattribute historical cases through today's source.

Raw reports and run records remain saved on disk, with provenance and test
outcomes available through `/api/coverage/:tag`. They are omitted from the compact
coverage cards. Missing output and altered report contents cannot become passing
results. Legacy reports without a content manifest remain unverified, even if
modification times are close. The panel retains a concise notice for unverified
measurements or changed inputs. File-update and run-completion timestamps remain
distinct in the evidence model, along with measured source paths.
Failed or incomplete runner attempts with no case output are labeled separately
from component test results. A build failure does not establish a failed component
assertion or an executed test suite.
Declaration counts do not expand parameterized cases. Whole-library totals are
never substituted for the selected component. A case checking multiple components
can appear under each, so per-component case totals are not additive.
Accessibility results describe automated checks, not WCAG conformance.

Generate reports with the repository's supported Node version and installed
Chromium browser:

```sh
pnpm native:coverage
```

This runs unit coverage, the existing browser suites across the full catalog,
and the existing Storybook stories, play assertions and configured axe audits. Each independent stage
still runs when another stage has assertion failures; the command returns a
failure if any stage fails. Storybook requires a successful fresh isolated core
build from the browser stage. To run a stage separately:

```sh
node apps/native-playground/scripts/measure-tests.mjs --unit
node apps/native-playground/scripts/coverage/run-browser.mjs --all
node apps/storybook/scripts/laboratory-coverage.mjs
```

The unit collector saves paired coverage, Jest outcomes and run evidence in
`packages/core/coverage-spec`. Running the underlying Jest command directly does
not create a new Laboratory run record.
The browser collector runs the existing Stencil and React tests with source maps,
writing reports to `packages/core/coverage-e2e/scopes/all` and
`apps/test-react/coverage-native/scopes/all`. Its isolated build leaves the studio's live
component distribution untouched. Failed assertions remain failed in the saved
report and produce a nonzero exit code. Use **Refresh** in Test coverage after a run.
Replace `--all` with a component tag to measure its existing browser suites. That
run is saved under `scopes/md-component`, preserving reports for other tags.
Append `--list` to inspect scope without running tests or replacing reports.
Storybook writes outcomes and source-mapped library coverage to
`apps/storybook/coverage-stories`. Incidental controls in another component's
test file do not acquire that component's test outcomes. Structural children may
have measured code coverage through their parents without owning a story suite.
The isolated build records its inputs before compilation and hashes its output
files. Browser and Storybook collectors verify that evidence, including the
copied Storybook runtime, before and after execution. Stale build inputs or
changed compiled files cannot be reported as unchanged tested inputs. Storybook
resolves both component registration and public core utilities from that verified
runtime. Run records retain the build ID and runtime fingerprint.
Browser coverage includes unexecuted components using their verified compiled
JavaScript and source maps. Those sources have zero hits against an executable
denominator; they are not presented as passing tests or missing measurements.

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

The hosts wrap native content in `AWCPreviewScope` so dialogs, sheets and option
menus stay inside the captured surface. SwiftUI preview date, time and color
controls also render in that surface. Production apps retain their native
presentation behavior unless they explicitly opt into the preview scope.
Initial recipe properties and supported plain text are shared with the Web
fixture, including when a native component URL is opened directly.

General dragging, scrolling, separate system windows and OS menu placement are
not fully validated by this transport. Preview menus are centered and sheets
use a bounded viewport; long content is limited to the visible surface.
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
