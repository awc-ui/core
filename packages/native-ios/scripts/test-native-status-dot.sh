#!/bin/sh
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/awc-native-status-dot.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM
swift build --package-path "$package_dir" "$@"
library_dir=$(swift build --package-path "$package_dir" --show-bin-path "$@")
module_cache_dir=${AWC_NATIVE_TEST_MODULE_CACHE:-"$package_dir/.build/native-view-module-cache"}
mkdir -p "$module_cache_dir"
swiftc -parse-as-library -module-cache-path "$module_cache_dir" \
  -I "$library_dir/Modules" "$package_dir/Tests/NativeStatusDotViewIntegration.swift" \
  "$package_dir/Tests/AWCUITests/NativeStatusDotCases.swift" \
  "$library_dir"/AWCUI.build/*.o -o "$test_dir/checks"
"$test_dir/checks" "${AWC_STATUS_DOT_MEASUREMENTS:-/tmp/awc-status-dot-swift-measurements.json}"
