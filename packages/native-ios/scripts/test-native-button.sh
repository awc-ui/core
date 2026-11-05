#!/bin/sh
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/awc-native-button.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
# The shared metric cases also run in XCTest. This runner needs only macOS CLT.
# Optional SwiftPM flags, such as --scratch-path, are forwarded unchanged.
swift build --package-path "$package_dir" "$@"
library_dir=$(swift build --package-path "$package_dir" --show-bin-path "$@")
swiftc -parse-as-library -module-cache-path "$build_dir/module-cache" \
  -I "$library_dir/Modules" \
  "$package_dir/Tests/AWCUITests/NativeButtonMetricCases.swift" \
  "$package_dir/Tests/AWCUITests/NativeButtonAppearanceCases.swift" \
  "$package_dir/Tests/AWCUITests/NativeIconButtonCases.swift" \
  "$package_dir/Tests/AWCUITests/NativeButtonGroupCases.swift" \
  "$package_dir/Tests/AWCUITests/NativeFabCases.swift" \
  "$package_dir/Tests/NativeButtonMain.swift" \
  "$library_dir"/AWCUI.build/*.o -o "$build_dir/checks"
"$build_dir/checks"
