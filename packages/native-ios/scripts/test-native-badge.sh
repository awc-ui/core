#!/bin/sh
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/awc-native-badge.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
swift build --package-path "$package_dir" "$@"
library_dir=$(swift build --package-path "$package_dir" --show-bin-path "$@")
module_cache_dir=${AWC_NATIVE_TEST_MODULE_CACHE:-"$package_dir/.build/native-view-module-cache"}
mkdir -p "$module_cache_dir"
swiftc -parse-as-library -module-cache-path "$module_cache_dir" \
  -I "$library_dir/Modules" "$package_dir/Tests/NativeBadgeViewIntegration.swift" \
  "$package_dir/Tests/AWCUITests/NativeBadgeCases.swift" \
  "$library_dir"/AWCUI.build/*.o -o "$build_dir/checks"
"$build_dir/checks" "$package_dir/Tests/Fixtures/BadgeWebGeometry.json" "${AWC_BADGE_MEASUREMENTS:-/tmp/awc-badge-swift-measurements.json}"
