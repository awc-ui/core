#!/bin/sh
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
playground_dir="$package_dir/../../apps/native-ios-playground"
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/awc-preview-checks.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
swift build --package-path "$playground_dir" "$@"
library_dir=$(swift build --package-path "$playground_dir" --show-bin-path "$@")
swiftc -parse-as-library -module-cache-path "$build_dir/module-cache" -I "$library_dir/Modules" \
  "$package_dir/Tests/AWCUITests/NativePreviewSlotCases.swift" "$package_dir/Tests/NativePreviewSlotsMain.swift" \
  "$library_dir"/AWCUI.build/*.o -o "$build_dir/slots"
"$build_dir/slots"
swiftc -parse-as-library -module-cache-path "$build_dir/module-cache" -I "$library_dir/Modules" \
  "$package_dir/Tests/NativePreviewPresentationIntegration.swift" "$library_dir"/AWCUI.build/*.o -o "$build_dir/presentation"
"$build_dir/presentation"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-preview-presentation.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-button-group.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-fab.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-fab-menu.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-badge.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-segmented.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-split-button.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-loading-indicator.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-meter.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-progress.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-skeleton.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-snackbar.mjs"
AWC_NATIVE_LIVE_RENDERER="$library_dir/AWCLivePreview" node "$playground_dir/scripts/test-live-tooltip.mjs"
