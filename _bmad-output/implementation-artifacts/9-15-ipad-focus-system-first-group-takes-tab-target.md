---
title: 'iPad focus bridge: the focus system's first-group entry takes first responder from the Tab target (C910-01)'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-15-ipad-focus-system-first-group-takes-tab-target'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane d5 · no Android lane · simulators AWC-d5-ipad (iPad 26.3) and AWC-d5 (iPhone 26.3) (create them as PARALLEL.md describes if they do not exist)'
lab: 'work/s915-lab (create it; private tree work/s915-tree = a copy of canonical; the measurements of story 9-10 are in work/s910-lab)'
depends_on: ['9-10-ios-shim-key-await-regression-and-install']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 9-10 found a product race on iPad (DEFECTS.md C910-01, KNOWN-CAUSES.md row 32). On every Tab in the md-table keyboard cases the UIKit focus system first moves focus to the first focus group (`NativeFocusBridge.swift`, `didUpdateFocus`, about lines 301 to 305: the first responder becomes key-view index 0, logged as `become sys=true`), and 1 to 3 ms later the AWC Tab key command moves it to the real target (`become explicit=true`). With the canonical test shim, which waits 30 ms after each key, the order is always the same and `NativeTableStatesIntegration` passes on iPad (0 failures in 4 + 3 rounds). With the corrected shim of story 9-10 (the key await ends when UIKit has delivered the key) the order is sometimes inverted: the key-view loop at Tab-10 finds index 0 as first responder 270 ms after Tab-9 had made index 10 first responder, and the Tab order restarts from the top. The Tab-10 to Tab-17 focus names and the sort icon opacity (0.6 against 0.38) then fail, 8 to 16 checks per round. A floor of 30 ms after each key hides it (0 failures in 3 of 3 rounds); a floor of 0 fails 14, 8 and 14 checks, and a floor of 15 fails 13, 8 and 0. A user with a hardware keyboard has no such floor, so this is a product defect. The shim install of story 9-10 waits for the fix, and stories 6-2 and 1-2 wait for that install.

**Approach:** Reproduce first with the measurements of story 9-10: apply its shim (`work/s910-lab`, file `shim.after5.swift`; the Dev Agent Record of story 9-10 says how it is applied and how the floor is set) to your private tree only, and run the iPad Table states suite three rounds with the `FOC` and `KVL` log lines of its jobs 029 and 031. Then answer two questions with a capture. First: why does the focus system move focus at all on a Tab that the AWC key command handles (the key command may not take priority over the system behaviour, or the focus system may react to the same key through another path)? Second: which of the two moves owns the first responder? In the Web source one Tab moves focus once, to the next stop of the table's own order. After the fix the native result must be the same in either order of the two callbacks: either the system's focus move does not happen for a Tab that AWC handles, or `didUpdateFocus` does not take the first responder away from the target that the AWC Tab handler chose for the same key. Do not solve it with time. The bridge is shared by every component, so keep the change as small as the cause allows and install it as an anchored patch (story 9-11 changed the same file on 2026-11-16 for macOS; read its Dev Agent Record).

## Boundaries & Constraints

**Always:** `NativeTableStatesIntegration` on iPad 26.3 with the 9-10 shim fails the Tab-10 to Tab-17 checks before the change (three rounds at floor 0) and has 0 failures in five rounds at floor 0 and five rounds at floor 15 after it. With the canonical shim the suite passes before and after. The rules in project-context.md apply.

**Never:** Do not add a delay, a floor, a retry or a debounce window. Do not install or change the test shim in canonical (story 9-10 owns it; you use its shim in your private tree only). Do not change the table's Tab order or the suite's expectations. Do not touch the macOS branch of the bridge that story 9-11 changed, unless a macOS run shows that your change needs it. Do not run artificial CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- C910-01; `work/claude-runner/KNOWN-CAUSES.md` rows 6, 24 and 32
- the Dev Agent Record of story `9-10` (jobs 029-kvl2, 030-floor and 031-foc: how the shim is applied, how the rounds are run, where the `FOC` and `KVL` lines come from) and `work/s910-lab/out/029-C3/`, `work/s910-lab/out/031/`
- `NativeFocusBridge.swift` (`didUpdateFocus`, the key commands, `AWCFocusHolder`); find the path with `ls -R packages | grep -i FocusBridge`
- the Dev Agent Record of story `1-4` (the iPad focus entry patch, KNOWN-CAUSES row 6) and of story `9-11` (its patch to the same file)

## Tasks & Acceptance

**Execution:**
- [x] Reproduce on iPad 26.3 with the 9-10 shim in the private tree: Table states three rounds at floor 0 (failures per round) and three rounds with the canonical shim (0 failures)
- [x] Capture the order of the focus system update and the AWC key command for Tab-9 and Tab-10; say why the focus system moves focus on a Tab that AWC handles; decide which move owns the first responder, with the Web behaviour as the reference
- [x] Fix in the private tree; Table states on iPad five rounds at floor 0 and five at floor 15 with the 9-10 shim: 0 failures; three rounds with the canonical shim: 0 failures
- [x] Regression with the canonical shim: every iPad states suite that sends Tab (the list is in the Dev Agent Record of story 9-10) once on iPad 26.3; Table states once on iPhone 26.3 and once on macOS; tools/ax for md-table on iOS
- [x] One main-queue install as an anchored patch (dry run, rollback, byte identity); DEFECTS.md status line `ready for re-check` for C910-01; the fix in KNOWN-CAUSES.md row 32; say in `open_items` that story 9-10 can continue

**Acceptance Criteria:**
- Given the 9-10 shim in the private tree, when Table states run five rounds on iPad 26.3 at floor 0 and five at floor 15, then every round has 0 failures, and the same suite failed 8 to 14 checks per round before the change
- Given the canonical shim, when every iPad states suite that sends Tab runs once, then no check fails that passed before the change
- Given the fix, when a reader opens the Dev Agent Record, then it says why the focus system moved focus on a handled Tab and why the result no longer depends on the order of the two callbacks, and the fix contains no wait
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE, status review. Fix = fix6 over canonical NativeFocusBridge.swift, installed (job 100-install, md5 db9b4400c42c342513727447e37e84a4, identical to tested tree s915-tree). Regression 012 (iPad, canonical shim) fails identical to before the fix (Button 1 snapshot-equality, TextField 6 motion; both in the -before logs). macOS Table states: 013 had 1 smooth-scroll frame check fail at load 273 (tb-frozen-scroll-ltr PageDown); rerun 014 R1 3859/3859 (R2 may still be running: `grep -a "^SUM" claude-runner/done/9-15-*-014-*.log`).
- Docs: DEFECTS C910-01 ready for re-check, KNOWN-CAUSES row 32 updated.
- Story 9-10 can continue (its shim install is unblocked).

EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-002-repro | ios | NativeTableStatesIntegration iPad canonical shim, no fix, 3 rounds fails 0,0,0 | 3/3 runs clean
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-002-repro | ios | NativeTableStatesIntegration iPad shim v5 floor0, no fix, 3 rounds fails 0,0,14 (explained: the reproduced defect, 14 fails in R3) | 2/3 runs clean
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 (9-10 shim) fix6 floor0 R1, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 (9-10 shim) fix6 floor0 R2, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 (9-10 shim) fix6 floor0 R3, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 (9-10 shim) fix6 floor0 R4, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 (9-10 shim) fix6 floor0 R5, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 fix6 floor15 R1, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 fix6 floor15 R2, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 fix6 floor15 R3, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 fix6 floor15 R4, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 shim v6 fix6 floor15 R5, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-011-clean5 | ios | NativeTableStatesIntegration iPad 26.3 canonical shim fix6, 3 rounds fails 0 | 3/3

EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-012-regress | ios | 17 iPad states suites canonical shim fix6 (failing: Button 1, TextField 6, identical to before; explained: both pre-existing, same in -before logs) | 16/18 suites with 0 fails
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-012-regress | ios | NativeTableStatesIntegration iPhone 26.3 canonical shim fix6, fails 0 | 1/1
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-013-mac-ax | macOS | NativeTablePaintIntegration | 7403/7403
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-014-mac-rerun | macOS | NativeTableStatesIntegration R1 | 3859/3859
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-013-mac-ax | macOS | NativeTableStatesIntegration (1 load-noise smooth-scroll fail at load 273; explained, rerun 014 R1 3859/3859) | 3858/3859
EVIDENCE | 9-15-ipad-focus-system-first-group-takes-tab-target-100-install | macOS | canonical NativeFocusBridge.swift guards, identical to dry run and tested tree | 4/4

### Notes (session 1)
- Capture (job 002, FOC lines, work/s915-lab/out/002/R*-floor0.log): on a Tab the AWC key command runs `handleKey` -> `AWCKeyViewLoop.select` -> `requestNativeFocus`; the focus system also reacts to the key and re-picks the first focus group (heading none, next = idx 0, `become sys=true`). Passing order: handleKey from view k, then a `requesting=true` hop to idx 0, then explicit target 1.5 ms later. Failing order (R3 floor0): the system's update (prev = view k, next = idx 0, requesting=false) comes BEFORE handleKey, so the key command runs on idx 0 as first responder and the Tab order restarts.
- Fix: the AWC view that is first responder refuses (shouldUpdateFocus) a heading-less system move to another AWC key view that no AWC request asked for. The loop owns moves between AWC key views; no wait.

## Review Triage Log


### Why (AC3)
The focus system re-picks the first focus group on the same Tab (UIKit handles the key in parallel to the AWC key command). The fix makes the result independent of callback order: `didUpdateFocus` vetoes a heading-less AWC-to-AWC system pick that AWC did not request, restoring `awcLastFocused`; `handleKey` redirects to `awcFocusHolder`. No delay, floor, retry or debounce.
