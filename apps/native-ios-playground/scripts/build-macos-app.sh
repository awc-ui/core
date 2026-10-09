#!/bin/sh
set -eu
# Optional arguments: destination .app path; SwiftPM scratch path.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
APP_DEST=${1:-"$PACKAGE_DIR/.build/AWC Native Playground.app"}
BUILD_ROOT=${2:-"$PACKAGE_DIR/.build/macos"}
swift build --package-path "$PACKAGE_DIR" --scratch-path "$BUILD_ROOT" --product AWCPlayground
BIN_DIR=$(swift build --package-path "$PACKAGE_DIR" --scratch-path "$BUILD_ROOT" --show-bin-path)
mkdir -p "$APP_DEST/Contents/MacOS" "$APP_DEST/Contents/Resources"
cp "$BIN_DIR/AWCPlayground" "$APP_DEST/Contents/MacOS/AWCPlayground"
ditto "$BIN_DIR/AWCUI_AWCUI.bundle" "$APP_DEST/Contents/Resources/AWCUI_AWCUI.bundle"
cat > "$APP_DEST/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>AWCPlayground</string>
<key>CFBundleIdentifier</key><string>dev.awcui.nativeplayground.macos</string>
<key>CFBundleName</key><string>AWC Native Playground</string>
<key>CFBundleDisplayName</key><string>AWC Native Playground</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$APP_DEST"
printf '%s\n' "$APP_DEST"
