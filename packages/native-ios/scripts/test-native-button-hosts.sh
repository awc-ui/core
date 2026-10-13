#!/bin/sh
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
playground_dir="$package_dir/../../apps/native-ios-playground"
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/awc-button-hosts.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
swift build --package-path "$playground_dir" "$@"
library_dir=$(swift build --package-path "$playground_dir" --show-bin-path "$@")
swiftc -parse-as-library -module-cache-path "$build_dir/module-cache" \
  "$package_dir/Tests/NativeButtonAppearanceHostIntegration.swift" -o "$build_dir/checks"
"$build_dir/checks" "$library_dir"
