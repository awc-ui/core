# AWC theme runtime

`awc-theme.mjs` is the bundled browser entry from the local `@awc-ui/theme` package, version 1.0.0-beta.9 (`packages/theme/dist/index.mjs`). It includes Material Color Utilities and keeps the library's license headers. The adjacent license is the AWC package license.

The SCADA app imports its `computeTheme`, `applyThemeRoles`, and `clearThemeRoles` functions to apply complete light and dark palettes from a primary seed. This checked-in runtime keeps the static app self-contained. Refresh it from the package's successful build when updating the library.
