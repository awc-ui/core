# Pie chart native implementation plan (md-pie-chart)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract: [md-pie-chart-source-review.md](md-pie-chart-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-pie-chart/web-oracle-cloud/`. Recapture it on the
  Mac (Chrome 153) with the fixed build before any native parity diff.

## Current adapters — NOT YET READ

The Mac bridge dropped before the adapters could be read, so this section is
open. To fill it, read and record (as the other Gate 1 plans do):

```sh
cd work/awc-native/packages
grep -n '"chart"\|case "md-pie-chart"\|pie' native-ios/Sources/AWCUI/AWCNativeView.swift
grep -rln 'pie\|Pie' native-ios/Sources/AWCUI
grep -rln 'md-pie-chart\|PieChart' native-android --include=*.kt | grep -v /build/
```

For each platform note: dispatch path, drawing primitive, which props are
read, events emitted, accessibility, motion, and what is not wired. Then
complete the two "now" columns below.

## Gap analysis (Web target; native columns pending)

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Data model | Tree flattened depth-first; one index space for events, legend, keyboard, table | ? | ? |
| Shapes | pie, donut, semi, arc via inner/outer radius and start/end angles (90/-270 default, clockwise) | ? | ? |
| Gaps / corners | 1px surface gap, `paddingAngle`, corner radius 4 | ? | ? |
| Nested rings | Children subdivide the parent arc; `ringWidths`; inner ring 1.45× | ? | ? |
| Labels | Inside value labels with contrast colour; leader labels "Name · value" when no legend; `labelMode` | ? | ? |
| Palette | Harmonic ramp; child = parent mixed to surface; `monochrome`; `gradient` | ? | ? |
| Legend | 9 anchors + none, mirrored under RTL; dropped for 1 slice; chips toggle visibility, survive re-feed | ? | ? |
| Hover | Rim band 7 @ 3px, others fade 62%, family spared; 260ms expressive tween in and out | ? | ? |
| Card | "value (share%)" one decimal in `locale`; `tooltipRenderer` | ? | ? |
| Selection | `selected` explodes 12px (300ms); press ripple 450ms α 0.16 | ? | ? |
| Keyboard | Drawn slices only; arrows (RTL-aware), Home/End, Escape, Enter/Space → `mdSliceClick`; cursor re-sync on data change | ? | ? |
| Announcement | Polite live region from `labelPoint`; share of visible siblings | ? | ? |
| SR table | Depth-first rows, path names, per-ring shares as % in `locale` | ? | ? |
| Empty / loading | `labelEmpty` / `empty` slot; `loading` overlay `role=status` | ? | ? |
| Motion | Entrance 700ms (6 presets), drill 520ms, all off under reduced motion | ? | ? |
| Sizing | Square by aspect ratio, min max(140, 200+12d), padding/shape max(8, 16+2d), 12 hooks | ? | ? |
| Events | `mdSliceClick` (flat index, datum, native event), `mdLegendClick {dataIndex, selected}`, `mdReady` | ? | ? |

## Native requirements (from the Web contract)

1. One flattened slice list (depth-first) as the single index space.
2. Geometry from the same layout rules: angles in degrees, clockwise from
   `startAngle` toward `endAngle`, padding split evenly, ring weights,
   explode offset 12, hover rim 7 / gap 3. Compare against the oracle's
   `engine.scene.slices` (cx, cy, innerR, outerR, start/end angle, colour).
3. Accessibility: one focusable chart element with an adjustable/keyboard
   model over drawn slices, the `labelPoint` announcement, and the table
   content exposed as an accessibility list (VoiceOver rotor / TalkBack
   collection) — iOS `accessibilityChartDescriptor` is the natural fit.
4. Shares localised with one decimal on the card, up to one in the
   announcement; values through `valueFormatter` or `locale`.
5. Motion: entrance 700ms, hover 260ms both ways, select 300ms, ripple
   450ms; all instant under Reduce Motion.
6. Events with the Web payloads and order (press → `mdSliceClick`; legend →
   `mdLegendClick`).

## Order of work

1. Read the adapters (above) and complete the gap table.
2. Recapture the oracle on the Mac; diff against the cloud capture.
3. Implement geometry + paint, then semantics/keyboard, then motion; diff
   each against the oracle cases named in its README.
