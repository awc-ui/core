# AWC native compiler lab

A dependency-free browser workbench for the AWC native compiler. It presents the
original web components as an interactive **web reference**, alongside the actual
SwiftUI and Jetpack Compose output and explicit portability coverage. On macOS,
the SwiftUI tab connects to a persistent native view through the local
`AWCLivePreview` executable. The browser displays native frames and forwards clicks
and text input to that view. `AWCSnapshots` also provides a static preview mode.
The Android tab connects to a debug playground Activity on a dedicated Android
emulator. Jetpack Compose renders its window; PixelCopy captures the real frames.

## Run

From the repository root, install the workspace dependencies and generate the
native sources:

```sh
node packages/native-compiler/src/cli.mjs build
swift build --package-path apps/native-ios-playground
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

For live Android, start a dedicated emulator (API 26+) and install the debug app:

```sh
export ANDROID_HOME=/absolute/path/to/android-sdk
export AWC_ANDROID_SERIAL=emulator-5554
cd apps/native-android-playground
./gradlew :app:assembleDebug
"$ANDROID_HOME/platform-tools/adb" -s "$AWC_ANDROID_SERIAL" install -r app/build/outputs/apk/debug/app-debug.apk
cd ../..
node apps/native-playground/server.mjs
```

Open <http://127.0.0.1:4177/?platform=android&preview=live#md-button>.
`AWC_ANDROID_SERIAL` is optional when exactly one emulator is connected. Physical
devices are not selected by this transport. `AWC_ANDROID_ADB` can override the
ADB executable. The server never downloads SDKs, starts emulators, or installs
APKs automatically. Android offers live preview and source inspection.
Use hardware graphics for the emulator where available (`-gpu host`); software
graphics can limit animation frame rate even when idle streaming reaches 60 fps.

The native inspector works without the web build. If generated output is missing,
the component browser falls back to the core custom elements manifest and clearly
marks compiler output as unavailable. Refresh after regenerating native sources.

The Swift build is optional for source inspection and requires macOS with the
Swift/macOS SDK. Each live session hosts an actual SwiftUI view in a separate
local process. Its native state survives between input commands and frames.
The Events inspector displays events emitted by the native AWC adapter. The
browser does not simulate the component's selection or text state in JavaScript.

The renderer merges inspector properties into each native example while
preserving its example children. Changing these initial properties or the theme
starts a new session. Focus the preview to send text and supported keys; Escape
releases browser focus. Navigation closes the previous session, hidden tabs stop
polling, and idle sessions expire after 60 seconds. At most two native sessions
can run at once on SwiftUI; Android has one session per emulator. Retry starts a
fresh native view after an error or expiry.

Live previews run on **macOS SwiftUI**, not an iOS simulator. Clicks and typing are
supported. `md-button` also forwards separate press/release/cancel commands, so
holding the pointer keeps its actual SwiftUI pressed state. Frame polling speeds
up while pressed and during release animation when using the polling fallback.
Button hover and pointer position are forwarded too. General dragging, scrolling, separate native windows, sheets and system
menus are not validated by this transport. Browser accessibility does not expose
the native accessibility tree. Use the native app for full platform interaction
and accessibility testing. Web slot content is not translated into the native
fixture. Android supports the same view-local clicks, button press/release/hover,
text and keys on its Compose Activity. Separate Android Popup/Dialog windows
are not composited into the Activity capture. Long content is limited to the
visible emulator surface; its reported logical bounds reflect the captured area.
Existing adapter API gaps remain visible.

Native frames are pushed over one bounded NDJSON connection at a target 60 fps,
independently of input acknowledgments. The browser presents decoded frames on
`requestAnimationFrame`; the live status reports the measured presentation rate.
Hidden tabs close their frame stream. Slow consumers retain only the latest
picture plus a bounded event batch instead of building up animation latency.
PNGs stay lossless; each native renderer draws its own animation. SwiftUI Retina
frames are converted to sRGB. Android fits the requested logical width to the
emulator display without stretching the component layout.
Achievable frame rate depends on the host, component size and tab visibility.

The web reference uses the same generated light/dark tokens as the native view.
The Button examples share their label, size and preview canvas. Native Button
matches the source variant palettes, density rules, fonts and press shape timing;
its ripple follows the pointer position and its native loader uses the source
polygon keyframes and easing. Text rasterization remains platform-dependent.

Snapshot mode renders one image per property/theme change and caches identical
requests until the executable changes. `AWC_NATIVE_RENDERER` and
`AWC_NATIVE_LIVE_RENDERER` can point at executables built in another directory.

## Included

- All 81 source custom elements, grouped and searchable, with shareable hash URLs.
- Explicit web examples for every element, including table, menu, navigation,
  select, tabs, stepper, and accordion children composed in their parent context.
- Live scalar, boolean, enum and JSON property editing, plus reset. Mixed literal
  unions preserve boolean and numeric values (for example, `multiline=false`).
- Light/dark themes, locally served fonts and icons, responsive layout, and the
  `/` keyboard shortcut for search.
- Persistent SwiftUI previews with clicks, text input, native events, explicit
  session lifecycle and static snapshot fallback.
- Persistent Compose previews with authenticated emulator streaming, native
  input/events and one bounded live session.
- Web and native event capture, contract metadata, compiler IR, actual generated source
  excerpts, complete-file links, and native runtime source links.
- Per-platform supported and unsupported property/event/method/slot coverage.
  Navigation findings combine static diagnostics and native API gaps.
  Static findings, adapter implementation and native parity are kept distinct.
- Launch directions for the separate native iOS and Android playgrounds.

No code is uploaded and no build is triggered by this server. It serves the
workbench assets, selected native source directories, generated compiler artifacts,
core manifest, fonts, the configured web build and generated PNGs. Its local
`POST /api/native-render` and `/api/native-live/*` endpoints accept bounded JSON
requests and invoke fixed native executables without a shell. Live sessions accept
only allowlisted input commands, scoped to their own native window; they do not
inject global OS input. It rejects foreign origins, traversal and symlink escapes,
and uses a same-origin content policy. Other routes support GET/HEAD only.
Snapshot images live in the ignored `.cache/native-playground/renders` directory;
live frames travel in memory as PNG data URLs.

Android uses only the debug APK's loopback HTTP host, a random token per session,
and a temporary ADB forward. Every host request requires bearer authentication.
Session cleanup closes its Activity and removes only its own forward; it does
not stop the emulator or ADB server. The live host is absent from release builds.

## Checks

```sh
node --test apps/native-playground/*.test.mjs
```

The tests cover route traversal, private-file exposure, symlink escape handling,
external web build roots, intentional reference recipes for every current
manifest element, typed render payloads, stale-result cancellation, render request
validation, caching, process failure/timeout cleanup, bounded native sessions,
input serialization, mixed literal value round-trips and coverage-only findings.
Native builds and full interaction tests belong to the separate platform projects;
a working remote preview does not establish native parity.

### Native behavior equivalents

The Portability inspector retains the original web-source findings and displays
SwiftUI and Compose replacements next to each one. `Native replacement` is scoped
to that source use in the selected component; `Partial replacement` indicates
that relevant native behavior still needs an adapter. Both statuses document
remaining differences from a browser. API-gap counts and compiler strict checks
are unchanged by this metadata.

For `md-button`, choose **Example → Form & cancellation** in either native Live
preview. The native Name field registers automatically and supports required and
length validation. Press Enter or Submit to see the encoded form data, or Reset
to restore initial values. **Cancel actions** vetoes button activation; the
separate form-event switch vetoes submit/reset after activation but before form
effects. Toggle and Link actions remain available. Form data is encoded locally
without making a network request, and the router records links without opening
an external URL. Observe native form and component events in the Events inspector.
The HTML_FORM coverage cards link directly to each platform's demo. Examples
require Live mode; Component remains the standard visual preview.

Choose **Example → Navigation & events** to inspect native navigation contexts,
route history, and event propagation. Links resolve inside the demo; they do not
open external pages. Cancellation prevents the link's default action, while
stopping propagation only changes which listeners receive it. The native trace
shows capture, target, and bubble phases. The DOM_GLOBAL and CANCELABLE_EVENT
coverage cards link to this example on each platform. Native contexts and event
scopes replace those component behaviors without providing a browser DOM or
browser windows.
