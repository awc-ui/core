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
