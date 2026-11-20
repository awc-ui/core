---
title: 'Select family: accessibility findings and the autocomplete preview failure'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '6-7-select-family-accessibility-and-autocomplete-preview'
epic: 6
model: 'sonnet'
wave: 2
lanes: 'mac lane d4 · android lane a4 (emulator-5562) · simulator AWC-d4'
lab: 'work/n2-lab (lab/g4 accessibility patches, tree work/n2-full; copy it to work/s67-tree, never edit it)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** tools/ax compare still has 15 open findings for md-select and 26 for md-multi-select. Separately, `test-preview-presentation` fails on the canonical Laboratory binary on an md-autocomplete row click (seen by story 1-3).

**Approach:** Group the ax findings by cause against the Web tree; fix names, roles, states and Tab order in the renderers; add a reviewed expectation only for a platform convention, as md-autocomplete already has in `tools/ax/expectations.mjs`. Reproduce the preview failure on canonical, find the cause, fix it. Deliver anchored patch scripts, not an install: story 6-1 integrates and installs.

## Boundaries & Constraints

**Always:** Work in `work/s67-tree`. Test-first per group. Deliver to `work/n2-lab/lab/g6/ax/` with an `apply.sh` that checks pre-images against `work/n2-full`. The rules in project-context.md apply.

**Never:** No blanket expectations. Do not touch timing code (story 6-6) or the Android stress and press-wave work (story 6-1). Do not install.

</intent-contract>

## Code Map

- Story 6-1 Dev Agent Record (ax counts, g4 accessibility patches)
- `tools/ax/*`, `tools/ax/expectations.mjs` (md-autocomplete entries), `docs/native-parity/accessibility.md`
- The Laboratory test `test-preview-presentation` under `apps/native-playground`

## Tasks & Acceptance

**Execution:**
- [x] Run tools/ax compare for md-select, md-select-option and md-multi-select on macOS, iOS and Android on your tree; group the findings by cause here
- [x] Fix each group in SwiftUI and Compose; record a reviewed expectation only for a named platform convention
- [x] tools/ax: 0 open for the three tags on Web, macOS, iOS and Android; paint and states of select and multi-select unchanged on macOS and Android
- [x] Reproduce the md-autocomplete `test-preview-presentation` failure on canonical, find the cause, fix it with the test passing ten times
- [x] Deliver `work/n2-lab/lab/g6/ax/` (patch scripts, apply.sh, evidence list) and a dated note in story 6-1's Handover

**Acceptance Criteria:**
- Given tools/ax on all platforms, when compared with Web for the three tags, then names, roles, states and Tab order match or carry a reviewed expectation with its reason
- Given `test-preview-presentation`, when it runs ten times on the patched Laboratory build, then it passes ten times
- Given the delivered patches, when `apply.sh --check` runs against `work/n2-full`, then every pre-image matches

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE (session 1): all tasks. tools/ax 0 open for md-select (5 cases), md-select-option (0 cases: no own cases), md-multi-select (3 cases) on Web, macOS, iOS, Android (job 011). Preview test passes 10/10 on the patched build.
- Delivered: work/n2-lab/lab/g6/ax/ (apply.sh [--check] <tree>, 6 patch scripts, _lib.py, EVIDENCE.md). `bash apply.sh work/n2-full --check` matches every pre-image (n2-full = canonical + g4); applied to work/s67-tree.
- Not installed (story 6-1 integrates). Dated note written in story 6-1 Handover.
- Open for reviewers: the reviewed expectations (see below) are for gate 7 to accept; pre-existing flakes seen again: macOS multi paint 1220/1222 (chips wrap, story 6-6), multi states pointer loss (KNOWN-CAUSES 9) and select-all flat pixels 871/872.
- Next step (6-1): `bash work/n2-lab/lab/g4/apply-all.sh <tree> && bash work/n2-lab/lab/g6/ax/apply.sh <tree>` then install job.

## Dev Agent Notes
- Baseline (job 001, s67-tree = n2-full): md-select 10 open (open case: macOS 4, iOS 1, Android 5), md-multi-select 26 open (all 3 cases, all native platforms), md-select-option has no cases of its own.
- Groups by cause and fix:
  1. Count status "N selected" (multi: text-missing x3 platforms x3 cases; Android extra status + ATF RedundantDescription): Web's part=live-region is a role=status whose text is the count. Fixed in SwiftUI (1 pt clear Text overlay, no pixels) and Compose (transparent 1 px Text in a polite live region, no contentDescription): patch-multi-count-status.
  2. macOS Tab stayed in the field (multi chips case: textbox, textbox, textbox vs Web textbox, clear, remove): the host's Tab used selectNextKeyView; md-multi-select now takes the application key path like md-autocomplete / md-otp-field: patch-host-tab-multi (LiveRenderer/main.swift, shared file, anchored one-token edit).
  3. Filter input (Web combobox, expanded, controls listbox): Android expanded state and collapse action fixed (patch-search-expanded-kt). Reviewed expectations (patch-ax-expectations-select), per platform and case, same conventions as md-autocomplete: role combobox to textbox (macOS, iOS, Android: no combobox role in SwiftUI TextField / UIKit / BasicTextField); macOS expanded (AXExpanded not settable on SwiftUI TextField; replacing it with the field representable would change the verified paint, so a reviewer may prefer that route); macOS extra group and aria-controls relation (no listbox role, no linked elements API); Android extra dialog (menu popup window); Android ATF TouchTargetSize 40-47 dp (source geometry 44 px, as date-picker, number-field, toolbar).
  4. tools/ax Web capture (new finding): md-select's Web `open` case lost its listbox in every run after the baseline (6/6; md-select reported open, its md-menu had open=false). Probes 007/008 show the DOM open state without the menu; applying `open` in a second step after load fixes it (patch-ax-web-open-deferred, 3/3 runs in job 010 then in 011). Cause of the earlier success unknown (timing); the fix removes the dependence.
  5. test-preview-presentation (task 4): reproduced on the canonical binary (job 002 probe + real test): md-autocomplete click at (160,174) gives mdChange 'paris'. Cause: test defect. The test clicks every option control at y=174, the first row of the selects (below their filter header); md-autocomplete has no header and its field sits at y 44-100 (AWCMenuScope padding 12), so y=174 is the second row. A second defect behind it: autocomplete's mdClose comes after the menu exit motion, not in the click frame. Test now targets the first row from the inspected container and reads mdClose from a frame 600 ms later (patch-test-preview-autocomplete-row). No renderer change.
- Failing-first record: job 002 (canonical binary) shows the failing assertion before the fix; job 003 shows the second assertion (mdClose) failing with the first fix; 004 and 011 pass.
- Paint and states unchanged (006, 011, A001): macOS select paint 1577/1577, multi paint 1220/1222 (same two chip-position cases as at the start, story 6-6), select states 1030/1030, multi states 872/872 (011 rerun 1), 871/872 (011 rerun 2, select-all flat pixels worst 4.0, a flake present before the patches), 837/859 in 006 (all multi-pointer-rtl pointer picks: KNOWN-CAUSES 9, clean on rerun); Android paint 2/2, host 6/6, states 2/2.
- KNOWN-CAUSES: no new timing/focus cause; the Web open-case capture finding is a tools/ax capture race, noted in KNOWN-CAUSES as entry 14.

EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-011-final-macos-pp-ax | macOS | test-preview-presentation (patched test and build, 10 runs) | 10/10
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-011-final-macos-pp-ax | web+macOS+iOS+Android | tools/ax compare md-select (5 cases with 0 open) | 5/5
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-011-final-macos-pp-ax | web+macOS+iOS+Android | tools/ax compare md-multi-select (3 cases with 0 open) | 3/3
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-011-final-macos-pp-ax | macOS | NativeMultiSelectStatesIntegration rerun 1 | 872/872
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-011-final-macos-pp-ax | macOS | NativeMultiSelectStatesIntegration rerun 2, explained: select-all flat pixels worst 4.0, flake present before the patches | 871/872
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-006-macos-select-suites | macOS | NativeSelectPaintIntegration | 1577/1577
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-006-macos-select-suites | macOS | NativeSelectStatesIntegration | 1030/1030
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-006-macos-select-suites | macOS | NativeMultiSelectPaintIntegration, explained: chip-position top/left chips box, same two cases as before the patches (story 6-6) | 1220/1222
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-A001-android-select-suites | Android | NativeSelectPaintTest + NativeMultiSelectPaintTest | 2/2
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-A001-android-select-suites | Android | LivePreviewSelectHostTest + LivePreviewSelectionHostTest | 6/6
EVIDENCE | 6-7-select-family-accessibility-and-autocomplete-preview-A001-android-select-suites | Android | NativeSelectStatesTest + NativeMultiSelectStatesTest | 2/2

## Review Triage Log

