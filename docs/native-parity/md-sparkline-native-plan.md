# Sparkline native implementation plan (md-sparkline)

Status: preparation only, at Gate 1. No native code has changed.

* The verified Web contract: [md-sparkline-source-review.md](md-sparkline-source-review.md).
* The oracle is the **provisional** cloud capture in
  `outputs/native-parity/md-sparkline/web-oracle-cloud/`. Recapture it on the
  Mac (Chrome 153) before any native parity diff.

## Current adapters — NOT YET READ

The Mac bridge dropped before the Swift `chart` adapter and the Android
equivalent could be read. To fill this section:

```sh
cd work/awc-native/packages
grep -n '"chart"\|sparkline' native-ios/Sources/AWCUI/AWCNativeView.swift
grep -rln 'sparkline\|Sparkline' native-ios/Sources/AWCUI
grep -rln 'md-sparkline\|Sparkline' native-android --include=*.kt | grep -v /build/
```

Record the dispatch path, the drawing primitive (Swift Charts / Path /
Canvas; Compose Canvas), props read, events, accessibility and motion.

## Gap analysis (Web target; native columns pending)

| Contract | Web | iOS now | Android now |
|---|---|---|---|
| Size | Inline-block 28px tall, full width, min 32; `height` and 3 hooks | ? | ? |
| Variants | line / area (fill 0.45) / bar (gap 0.2, radius 2); bar swaps engine | ? | ? |
| Colour | MD3 role or CSS colour; invalid → palette | ? | ? |
| Curves | 6 curves (line/area) | ? | ? |
| Gaps | Lines/areas connect across `null`; bars leave the slot empty | ? | ? |
| Marks | none / extremes (default) / edges / all; `markSize`, `lineWidth` | ? | ? |
| Reference bands | Index windows, line/area only; opaque → 18%, translucent as given, default line colour 12% | ? | ? |
| Scale | Auto per sparkline; `min` / `max` fixed | ? | ? |
| RTL | x mirrored | ? | ? |
| Tooltip | On by default; header = label or 0-based index (open decision); none on gaps | ? | ? |
| Click | `mdSparkClick {dataIndex, value}` on a hit; pointer only | ? | ? |
| Semantics | `role=img`, English summary "Sparkline, latest …, range … to …." + highlighted labels | ? | ? |
| Motion | Entrance ≈ 700ms once; none under reduced motion / `no-animation` | ? | ? |

## Native requirements

1. Treat it as an image: one accessibility element whose label is the
   summary (same wording; localisation pending the open decision).
2. Geometry from the oracle's `engine.scene` (`lines[].points`, `areas`,
   `bars`, `markers`, band `bars` with their rgba colours).
3. Band colours with the same alpha rule as Web (S1).
4. Tooltip and click only on a pointer hit; no focus stop.

## Order of work

1. Read the adapters and complete the gap table.
2. Recapture the oracle on the Mac; diff against the cloud capture.
3. Implement paint, then the tooltip/click, then motion.
