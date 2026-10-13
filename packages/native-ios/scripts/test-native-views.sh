#!/bin/sh
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/awc-native-views.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
# Optional SwiftPM flags, such as --scratch-path, are forwarded unchanged.
swift build --package-path "$package_dir" "$@"
library_dir=$(swift build --package-path "$package_dir" --show-bin-path "$@")
for fixture in NativeBehaviorViewIntegration NativeFocusViewIntegration NativeButtonAppearanceViewIntegration; do
  swiftc -parse-as-library -module-cache-path "$build_dir/module-cache" \
    -I "$library_dir/Modules" "$package_dir/Tests/$fixture.swift" \
    "$library_dir"/AWCUI.build/*.o -o "$build_dir/$fixture"
  "$build_dir/$fixture"
done
