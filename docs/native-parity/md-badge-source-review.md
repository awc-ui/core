# Badge source review

Status: source reviewed and measured; see the [migration checkpoint](md-badge.md) for current implementation and verification evidence.

The six source properties are `variant` (small/large), `value`, `max` (999), `icon`, `shape` (rect/circle) and `density` (0 to −4). There is one named icon slot, two parts (label/icon), ten appearance hooks, and no events or methods. The host is a noninteractive status with implicit polite announcements; a small badge is named “notification”, otherwise the displayed value takes precedence over the fallback icon name.

## Source behavior that the current adapters miss

`shape` describes the parent anchor, not the badge radius. Both rect and circle badges retain the full corner token unless the appearance hook overrides it. Rect pins the badge's right/top edges to the parent's physical top-right corner; circle uses 14.6447% of the parent width/height as right/top insets. Default translation is +50% of the badge's own width and −50% of its own height. These physical coordinates deliberately do not reverse in RTL. Internal content order still follows direction.

Large height/minimum width is `max(12, 16 + density)`, with default horizontal padding `max(2, 4 + density × 0.5)`. Empty content removes padding. Small size is `max(4, 6 + density × 0.5)`. Icon size is `max(8, 10 + density × 0.5)`; text is Roboto medium, `max(9, 11 + density × 0.5)`, line-height 1 and tracking 0.5. There is no icon/label gap. A tall authored icon or label overflows a shorter authored container; the renderer must not silently enlarge the explicit height.

Numeric overflow uses JavaScript `Number(value)` and a finite check before comparison with `max`. Otherwise the source takes four UTF-16 code units. Thus hex/binary/octal values can overflow, `Infinity` becomes `Infi`, and `ABC😀` renders `ABC�` after its fourth code unit splits the surrogate. The overflow text itself is not truncated: max 99999 produces `99999+`. Whitespace is retained and can parse as zero for a negative maximum.

An authored icon element, even empty, replaces the fallback while still counting as content. Multiple authored elements remain composed. The source forces each slotted element's width, height, font size and color to the icon hooks. The `icon` CSS part belongs to the fallback element; custom authored slot content remains separately inspectable.

## Appearance and native API design

The ten hooks map to containerColor, labelColor, cornerRadius, iconColor, iconSize, offsetX, offsetY, largeHeight, largePadding and smallSize. Offset values need both an absolute native length and a fraction of the badge's own dimension; replacing the source percentage with a fixed offset would break changing labels. Padding needs four physical sides, not only a single horizontal number.

A public native anchor composition must measure its actual parent and badge. A standalone native badge supplies its own intrinsic visual size; the anchor composition supplies the CSS containing-block equivalent. Icon-button badge composition must reuse the same placement rules. Native equivalents use resolved colors/lengths instead of evaluating arbitrary CSS strings.

## Reference evidence

The Web suite passed 64 tests. A dedicated browser fixture measured 75 hydrated cases: both variants and all densities, empty and overflow values, numeric-string edge cases, UTF-16 truncation, rect/circle anchors in LTR and RTL, fallback and authored icon slots, all ten style hooks, fractional/absolute offsets, overflowing contents and hidden state. Six follow-up fixtures exercise asymmetric RTL, collapsed/preserved whitespace and suppressed small-variant slots.

Workspace artifacts include the original `web-geometry.json` and `web-evidence.json`, the expanded `web-geometry-75.json` and `web-evidence-75.json`, `web-tests.log`, the reproducible `web-reference` fixture and the archived `web-reference-69`. Current native and generated-example results are recorded in the migration checkpoint.
