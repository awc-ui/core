#!/bin/sh
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/awc-native-behavior.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
swiftc -parse-as-library -D AWC_STANDALONE -module-cache-path "$build_dir/module-cache" \
  "$package_dir/Sources/AWCUI/Models.swift" \
  "$package_dir/Sources/AWCUI/NativeBehavior.swift" \
  "$package_dir/Tests/AWCUITests/NativeBehaviorContractCases.swift" \
  "$package_dir/Tests/NativeBehaviorMain.swift" -o "$build_dir/checks"
"$build_dir/checks"
