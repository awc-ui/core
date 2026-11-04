#!/bin/bash
# Build one macOS parity fixture into the simulator host app and run it.
# Usage: run-fixture.sh <FixtureName|path/to/Fixture.swift> [KEY=VALUE ...]
#   KEY=VALUE pairs become the app's environment (SIMCTL_CHILD_*), e.g. AWC_SWITCH_PAINT_OUTPUT=/tmp/x.json
# Env: AWC_IOS_BUILD (build dir), AWC_IOS_DEVICE (simulator UDID), AWC_IOS_CAPTURE (tile|hierarchy|layer),
#      WITH_TIMEOUT (timeout wrapper: <secs> cmd...), AWC_IOS_RUN_TIMEOUT (seconds, default 1800),
#      AWC_IOS_EXTRA_SOURCES (support sources), AWC_IOS_SWIFT_FLAGS (e.g. -D AWC_STANDALONE),
#      AWC_IOS_ARGS (fixture command-line arguments; @BUNDLE@ expands to the app bundle path at launch).
set -u
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
H=$(cd "$(dirname "$0")/.." && pwd); P=$(cd "$H/../../packages/native-ios" && pwd)
B=${AWC_IOS_BUILD:-$H/.build}; DEV=${AWC_IOS_DEVICE:-615C2511-56C4-415C-9D46-73AA1287D240}
TO=${WITH_TIMEOUT:-}; [ -n "$TO" ] || TO="perl -e alarm(shift);exec(@ARGV)"
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path); TARGET=${AWC_IOS_TARGET:-arm64-apple-ios17.0-simulator}
case "$1" in *.swift) SRC=$1 ;; *) SRC=$P/Tests/$1.swift ;; esac; shift
F=$(basename "$SRC" .swift); W=$B/fixtures/$F; APP=$W/AWCParity.app
"$H/scripts/build-awcui.sh" "$B" || exit 2
rm -rf "$W/src" "$APP"; mkdir -p "$W/src" "$APP/Tests/Fixtures" "$APP/AWCUI_AWCUI.bundle/Fonts"
python3 "$H/scripts/transform.py" "$SRC" "$W/src" "$P/Tests/Fixtures" || exit 3
# Support sources compiled with the fixture (e.g. Tests/AWCUITests/*Cases.swift), relative to packages/native-ios or absolute.
EXTRA=(); for e in ${AWC_IOS_EXTRA_SOURCES:-}; do case "$e" in /*) es=$e ;; *) es=$P/$e ;; esac
  python3 "$H/scripts/transform.py" --support "$es" "$W/src" "$P/Tests/Fixtures" || exit 3; EXTRA+=("$W/src/$(basename "$es")"); done
xcrun --sdk iphonesimulator swiftc -target "$TARGET" -sdk "$SDK" -swift-version 5 -parse-as-library -O -module-cache-path "$B/mcache" \
  -I "$B/lib" -L "$B/lib" -lAWCUI -framework SwiftUI -framework UIKit -framework CoreText -framework QuartzCore \
  ${AWC_IOS_SWIFT_FLAGS:-} "$H/Shim/AppKitShim.swift" "$H/Shim/TouchSynthesis.swift" "$H/Host/HarnessApp.swift" "$W/src/$F.swift" ${EXTRA[@]+"${EXTRA[@]}"} -o "$APP/AWCParity" > "$W/compile.log" 2>&1 \
  || { grep -E "error:" "$W/compile.log" | sort -u | head -40; echo "fixture compile failed"; exit 4; }
while read -r f; do [ -n "$f" ] && cp -R "$P/Tests/Fixtures/$f" "$APP/Tests/Fixtures/"; done < "$W/src/fixtures.txt"
cp "$P/Sources/AWCUI/Resources/Fonts/"*.woff2 "$APP/AWCUI_AWCUI.bundle/Fonts/"
cat > "$APP/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>dev.awc.native.parity</string><key>CFBundleExecutable</key><string>AWCParity</string>
<key>CFBundleName</key><string>AWCParity</string><key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleVersion</key><string>1</string>
<key>CFBundleSupportedPlatforms</key><array><string>iPhoneSimulator</string></array><key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer><integer>2</integer></array><key>UILaunchScreen</key><dict/>
<key>UIRequiresFullScreen</key><true/><key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string></array>
<key>UIApplicationSupportsIndirectInputEvents</key><true/>
</dict></plist>
PLIST
codesign --force --sign - --timestamp=none "$APP" >/dev/null 2>&1
$TO 120 xcrun simctl boot "$DEV" >/dev/null 2>&1; $TO 300 xcrun simctl bootstatus "$DEV" -b >/dev/null 2>&1
xcrun simctl ui "$DEV" appearance light >/dev/null 2>&1
$TO 30 xcrun simctl terminate "$DEV" dev.awc.native.parity >/dev/null 2>&1
# Install from outside ~/Documents: CoreSimulator has no TCC grant for it and would block on a prompt.
STAGE=${AWC_IOS_STAGE:-/tmp/awc-ios/stage}; rm -rf "$STAGE/AWCParity.app"; mkdir -p "$STAGE"; cp -R "$APP" "$STAGE/"
$TO 180 xcrun simctl install "$DEV" "$STAGE/AWCParity.app" || { echo "install failed"; exit 5; }
for kv in "$@"; do export "SIMCTL_CHILD_$kv"; done
[ -n "${AWC_IOS_CAPTURE:-}" ] && export SIMCTL_CHILD_AWC_IOS_CAPTURE=$AWC_IOS_CAPTURE
# The iOS 26.3 simulator runtime's font cache names System/Library/Fonts/Core/AppleColorEmoji.ttc, which that runtime
# does not ship (it ships the same face as CoreAddition/AppleColorEmoji-160px.ttc), so emoji fall back to LastResort.
# Shim/AWCFontRedirect.c maps that one path to the runtime's own file; inserted into the fixture app only, from the
# staging directory (CoreSimulator cannot read ~/Documents). AWC_IOS_FONT_REDIRECT=off disables it.
if [ "${AWC_IOS_FONT_REDIRECT:-on}" != off ]; then
  FR="$B/libawcfontredirect.dylib"
  if [ ! -f "$FR" ] || [ "$H/Shim/AWCFontRedirect.c" -nt "$FR" ]; then
    xcrun --sdk iphonesimulator clang -target "$TARGET" -dynamiclib -O2 -o "$FR" "$H/Shim/AWCFontRedirect.c" && codesign --force --sign - --timestamp=none "$FR" >/dev/null 2>&1
  fi
  cp "$FR" "$STAGE/libawcfontredirect.dylib" && export SIMCTL_CHILD_DYLD_INSERT_LIBRARIES="$STAGE/libawcfontredirect.dylib"
fi
$TO ${AWC_IOS_RUN_TIMEOUT:-1800} xcrun simctl launch --console --terminate-running-process "$DEV" dev.awc.native.parity ${AWC_IOS_ARGS:-} > "$W/console.log" 2>&1; code=$?
grep -E "^AWC-IOS-|passed|FAIL|PASS|Fatal error|[Cc]rash" "$W/console.log" | grep -v "^FAIL" | tail -6 | cut -c1-400
echo "fails: $(grep -c '^FAIL' "$W/console.log")"; grep '^FAIL' "$W/console.log" | head -${AWC_IOS_SHOW_FAILS:-15} | cut -c1-300
echo "launch exit $code; console $W/console.log"
