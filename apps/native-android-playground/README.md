# AWC Android playground

A native Android application containing a searchable catalog of all generated AWC components, theme switching, realistic sample data, JSON property editing and a live event log.

## Build and run

1. Generate native contracts from the repository root using the native compiler command documented there.
2. Install Android SDK platform 36, build-tools 36.0.0 and JDK 17 or newer supported by Gradle 8.13.
3. Set `ANDROID_HOME` or create an untracked `local.properties` with `sdk.dir=/absolute/path/to/android-sdk`.
4. From this directory:

```sh
./gradlew :app:assembleDebug :native-ui:testDebugUnitTest
./gradlew :app:installDebug
```

Open **AWC Native** on an Android device/emulator (API 26+). Build output is `app/build/outputs/apk/debug/app-debug.apk`. For interaction tests use `./gradlew :app:connectedDebugAndroidTest` with a running device.

The pinned Gradle 8.13 wrapper JAR has SHA-256 `81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f`, verified against Gradle's official wrapper checksum. Distribution verification is enforced through `distributionSha256Sum`.

## Reviewing a component

Search for a source tag, open its preview, interact with native controls and inspect event names/payloads. Edit any source property in the JSON editor and press **Apply properties**. Quick controls toggle common booleans. Overlay entries have an explicit open button. Reset restores fixture values and clears events.

The catalog presents native adapters, not a declaration of full migration parity. See `packages/native-android/support.json` and the compiler's coverage report for supported source behavior and remaining gaps.

## Live browser preview

The debug APK includes `LivePreviewActivity`, used by the browser playground's
Android tab. After installing it on a dedicated emulator, run the browser server
with `ANDROID_HOME` and optionally `AWC_ANDROID_SERIAL=emulator-5554`, then open
<http://127.0.0.1:4177/?platform=android&preview=live#md-button>.

The Activity owns a private Presentation that renders the same native AWC
fixtures at 2× resolution, independently of the emulator's screen width.
PixelCopy captures its GPU window after committed draws; lossless PNG encoding
runs off the UI thread. Idle heartbeats reuse the last capture, while animation
frames follow native drawing. The emulator's global display settings stay unchanged.
Clicks, held button presses, hover, text and keys are dispatched only to its
own view. Its loopback HTTP server requires a random session token for every
request and is exposed to the host through a temporary ADB forward. The Activity
and server are debug-only and absent from release builds.

One Android session runs at a time. Separate popup/dialog windows and off-screen
content are outside this capture. Frame rate depends on emulator performance,
component size and browser visibility. The browser displays source resolution
and exposes fresh capture/encoding measurements in `data-frame-metrics`.

After installing the APK, verify the live transport with:

```sh
node apps/native-android-playground/scripts/test-live-stream.mjs
```

Run this from the repository root with the same Android environment variables.
It checks held/released/canceled native input and reports measured frame rate
and input acknowledgement latency. `AWC_NATIVE_PERF_MIN_FPS` optionally sets a
local performance threshold. Close other Android previews before running it.

Verify theme changes and rapid session replacement with the same environment:

```sh
node apps/native-android-playground/scripts/test-live-reconnect.mjs
```

This runs eight sessions at a 426dp viewport, alternating light and dark
themes. It aborts each stream before closing, includes pending pointer-leave
requests, and varies reconnection gaps between 0, 75, 100 and 125 milliseconds.
Each session must produce fresh native pixels and a working button with reset
toggle state and correctly ordered `mdClick`/`mdChange` events.

For capture profiling, launch the debug Activity with the additional ADB intent
extra `--ez profile true`; `AWCNativePerf` logcat entries report capture time,
PNG encode time and frame bytes without logging the session token.
