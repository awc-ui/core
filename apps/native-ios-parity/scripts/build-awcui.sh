#!/bin/bash
# Compile packages/native-ios (AWCUI) for the iOS Simulator as a static library + testable module.
# Rebuilds only when a source is newer than the library. Usage: build-awcui.sh BUILD_DIR
set -u
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
H=$(cd "$(dirname "$0")/.." && pwd); P=$(cd "$H/../../packages/native-ios" && pwd)
B=$1/lib; mkdir -p "$B"
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path); TARGET=${AWC_IOS_TARGET:-arm64-apple-ios17.0-simulator}
if [ -f "$B/libAWCUI.a" ] && [ -z "$(find "$P/Sources/AWCUI" -name '*.swift' -newer "$B/libAWCUI.a" | head -1)" ]; then echo "AWCUI up to date"; exit 0; fi
printf 'import Foundation\nextension Foundation.Bundle { static var module: Bundle { Bundle.main } }\n' > "$B/bundle-module.swift"
start=$(date +%s)
xcrun --sdk iphonesimulator swiftc -target "$TARGET" -sdk "$SDK" -swift-version 5 -module-name AWCUI -parse-as-library \
  -enable-testing -Onone -j${AWC_IOS_JOBS:-4} -module-cache-path "$1/mcache" \
  -emit-module -emit-module-path "$B/AWCUI.swiftmodule" -emit-library -static -o "$B/libAWCUI.a" \
  $(find "$P/Sources/AWCUI" -name '*.swift' | sort) "$B/bundle-module.swift" || { echo "AWCUI build failed"; rm -f "$B/libAWCUI.a"; exit 1; }
echo "AWCUI built in $(( $(date +%s) - start ))s"
