---
title: 'Web source: slotted text missing from Chrome's accessibility tree (R6-15)'
type: 'bugfix'
created: '2026-11-13'
status: 'review'
story_key: '5-2-web-slotted-text-accessibility'
epic: 5
model: 'opus'
wave: 2
lanes: 'mac lane d6b · no Android · no simulator'
lab: 'work/d6-lab and work/fa-lab (R6-15 notes)'
depends_on: []
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** On cold loads Chrome leaves slotted text out of its accessibility tree in a fraction of loads: collapsed and full breadcrumb trails (5/24, 3/24), tab panel (2/24), md-step open panel (about a quarter to a third). md-accordion-item had the same defect, fixed by creating the ripple after first render; that fix only partly helps md-step.

**Approach:** Bisect the Web source with 24-load samples per variant until the trigger is known for each component, fix test-first in packages/core, prove with 24-load counts, install with a dist rebuild.

## Boundaries & Constraints

**Always:** A fix is accepted only at 0 of 24 missing loads per case on the fixed build, measured on Mac Chrome 153. The rules in project-context.md apply.

**Never:** Do not paper over it in tools/ax expectations.

</intent-contract>

## Code Map

- `work/d6-lab/REQUESTS.md` and `work/fa-lab/PROGRESS.md` -- fa's md-step data (ripple is not the whole cause; readonly has no ripple yet loses text)
- `packages/core/src/components/md-accordion-item` -- the earlier fix (fa-051) as a pattern
- `tools/ax/` -- Web capture via CDP getFullAXTree
- `packages/core/src/components/{md-breadcrumbs,md-breadcrumb-item,md-tabs,md-tab-panel,md-step,md-stepper}`

## Tasks & Acceptance

**Execution:**
- [x] Build a cold-load counter job (24 loads per case) for breadcrumbs, tab panel and md-step cases (d6-lab/s52/measure.sh + count.py; 5-2-001)
- [x] Bisect: element upgrades or async work during first render near slotted content (ripples in Back/Continue buttons, lazy imports, slotchange handlers) — 5-2-002/003/004/006: not ripples; a new slot's AX node built without children; restored by slot re-insertion
- [x] Fix in the Web source with a failing test first; run the affected spec and e2e suites — 5-2-005/007 (3 suites fail before; 11/11 after; 333/333 affected)
- [x] Install through the main queue with core dist rebuild; recapture the Web tools/ax cases; mark R6-15 in DEFECTS.md — 5-2-008 (install), 5-2-009 (0/24 + _ax-s52), 5-2-010 (DEFECTS)

**Acceptance Criteria:**
- Given the fixed build, when each case is cold-loaded 24 times, then the slotted text is present in all 24 trees
- Given the affected components' Web suites, when they run, then they pass
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

### Session 1 (2026-11-15, lane d6b)
- Prior state (read, not redone): md-breadcrumbs already FIXED + INSTALLED by d6 (d6-038: md-breadcrumb-item mounts its link ripple
  in componentDidLoad; spec md-breadcrumb-item.ripple-timing.spec.ts; cold loads trail 13/48 -> 0/48, collapsed 8/48 -> 0/48).
  md-tab-panel: d6 diag2/diag3 (d6-lab/r615) could not reproduce outside run.mjs (0/96, 1/192 under 4x CPU throttle).
  md-step: fa-071/072 (fix-web-3, step header ripple late) only partial; readonly (no step ripple) also loses the text.
- Lab for this story: work/d6-lab/s52 (count.py, measure.sh = N cold run.mjs Web captures, fresh Chrome per call, seeded with
  the macOS effective nodes of d6b-005 / fa-lab/stepper/ax3; variant.py = anchored diagnostic edits). Private tree work/s52-tree.
- 5-2-001-baseline (canonical dist, 24 cold loads each): md-breadcrumbs collapsed 24/24, trail 24/24 present (fixed holds);
  md-tab-panel/panel 23/24 (1 missing); md-stepper dot-nonlinear 23/24, horizontal 21/24, mobile 20/24, readonly 22/24,
  vertical 22/24 (12/120 missing).
- Hypothesis under test: the dist is lazy-loaded (p-*.entry.js chunks), so nested md-button / md-ripple elements hydrate
  asynchronously after the host's first render; md-ripple's connectedCallback calls getComputedStyle (display:contents walk)
  -> a forced document style recalc in the middle of another component's patch. 5-2-002 tests rip-nogcs / rip-defer / rip-inert.
- 5-2-002-bisect-ripple (private builds from work/s52-tree, 24 cold loads each; missing counts): rip-nogcs tab-panel 6/24,
  stepper dot 4 / horiz 6 / mobile 6 / readonly 4 / vertical 2 (22/120); rip-defer tab-panel 3/24, stepper 1/4/3/4/3 (15/120).
  Breadcrumbs 0/24 in both. => md-ripple's getComputedStyle while connecting is NOT the trigger (hypothesis rejected); md-tab-panel
  has no nested element at all and still drops its text, so the generic cause is not nested hydration. Rates vary with machine
  load (the timing slots were saturated by other stories: the job waited ~35 min for slots). Failing trees: the default <slot>
  is an ignored AX node with NO children (the text node is nowhere in the tree).
- measure.sh now holds one timing slot per batch (not one per run) to avoid slot starvation.
- 5-2-002 rip-inert (md-ripple does nothing on connect): tab-panel 5/24, stepper dot 8 / horiz 0 / mobile 4 / readonly 4 /
  vertical 2 missing -> ripples are not the stepper's trigger either.
- 5-2-003-remedies (diag52.mjs: tools/ax page sequence, fresh Chrome per load; when the text is missing, try remedies in order):
  tab-panel 5/48 missing, all 5 restored only by removing + re-inserting the slot element (not by waiting 1.5 s, not by re-naming
  the slot, not by display:none/'' on its parent); stepper horizontal 1/24 and readonly 4/24 missing, all restored by re-naming the
  slot (reslot not reached there). => the defect is Chrome building a new slot's AX node without its assigned children.
- Candidate fix (s52/src/slot-refresh.ts, variant.py `reslot`): `refreshNewSlots(shadowRoot)` from componentDidRender re-inserts
  each newly rendered default slot once, on the next animation frame (skipped if focus is inside the slotted content); applied to
  md-tab-panel and md-step (md-step's panel slot appears on a later render, after md-stepper sets data-panel-mode). Queued
  5-2-004-reslot: diag sets on canonical (control) / reslot / reslot-sync, then run.mjs measure (24) on reslot.
- 5-2-004-reslot (same load window): diag52 canonical tab-panel 1/48, stepper horiz 5 / readonly 4 / mobile 4 / dot 2 / vertical 2
  (18/168 missing); reslot 0/48 + 0/120 (0/168); reslot-sync (re-insert inside componentDidRender, no frame) 1/48 + 1/120 -> the
  frame matters. BUT the run.mjs path on dist-reslot: tab-panel 2/24, stepper readonly 6/24 (dot/horiz/mobile/vertical 0/24,
  breadcrumbs 0/24) -> reslot fixes four stepper layouts in the acceptance path, not readonly / tab-panel.
- 5-2-005-testfirst-fix (s52-tree): new specs (s52/spec: utils/slot-refresh.spec.ts, md-tab-panel.slot-refresh.spec.ts,
  md-step.slot-refresh.spec.ts) on canonical sources: 3/3 suites FAIL (module missing); with the fix 3 suites, 10/10 pass;
  affected spec+e2e (slot-refresh, md-tab-panel(s), md-tabs, md-tab, md-step, md-stepper) 28 suites, 332/332 pass; dist-fix
  run.mjs measure (24): breadcrumbs 0+0, tab-panel 1/24, stepper dot/horiz/mobile/vertical 0/24 each, readonly 4/24 missing.
  Fixed sources + sha256 in d6-lab/s52/fixed-src (NOT final: readonly / tab-panel still miss).
- 5-2-006 (queued): diag52 with 4 warm-up pages in the same browser (run.mjs captures readonly 5th) and variant reslot2
  (re-insert at the next frame and again 250 ms later), run.mjs measure on reslot2.
- 5-2-006-warm-reslot2: diag52 with 4 warm-up pages (cached chunks): canonical readonly 1/24, horiz 3/24, panel 3/48; reslot
  readonly 7/24 (worse: the frame re-insert is itself a slot insertion and can hit the race while the page is still hydrating),
  horiz 0/24, panel 1/48; reslot2 (frame + 250 ms) readonly 0/24, horiz 0/24, panel 0/48. run.mjs measure (24) on reslot2: every
  case 0/24 missing (breadcrumbs collapsed/trail, tab-panel, stepper dot/horiz/mobile/readonly/vertical).
- Final fix = reslot2: s52/src/slot-refresh.ts re-inserts each new default slot on the next frame and again after
  SLOT_REFRESH_SETTLE_MS (250); spec covers both passes (11 tests). Root cause stays in Chrome (a new slot's AX node built without
  its assigned children, intermittently, while the page hydrates); the source works around it where it renders slotted panels.
- 5-2-007-final-fix: new specs on canonical sources 3/3 suites FAIL (module missing); fixed: 3 suites 11/11; affected spec+e2e
  28 suites 333/333; dist-fix2; then 2 x 24 run.mjs loads + diag sets (running at the time of writing).
- Install prepared (not yet queued): d6-lab/s52/install-008.sh (MAIN queue) using fix-web-s52.py (anchored, pre-image checked,
  refuses existing new files, verifies byte identity with s52/fixed-src), affected spec+e2e on canonical, 710 step-1 dist rebuild,
  4177 restart + probes, rollback on failure. After it: 24 cold loads on the canonical dist, tools/ax Web recapture, DEFECTS R6-15.
- 5-2-007 results: dist-fix2 run.mjs measure 2 x 24 (007-a, 007-b): every case 0/24 missing in both batches (breadcrumbs
  collapsed/trail, tab-panel, stepper dot/horiz/mobile/readonly/vertical) = 0/384 captures; diag52 set: tab-panel 0/48, stepper
  horiz/readonly/mobile/dot/vertical 0/24 each. Fixed sources sha256 (d6-lab/s52/out/007/fixed-src.sha256): slot-refresh.ts
  2a737c75…, md-tab-panel.tsx 086fc5c5…, md-step.tsx a26277e7…, specs 7e764014… / 4e67c0a7… / 4f5a6a91….
- 5-2-008-install-r615-slot-refresh (MAIN queue) INSTALLED: dry run ok; anchored patch applied; all 6 files byte-identical with
  d6-lab/s52/fixed-src (= the tested s52-tree); affected spec+e2e on canonical 28 suites 333/333; core dist rebuilt (710 step 1,
  refreshNewSlots in dist/md3 chunks); 4177 restarted, probes / , md3.esm.js, md3.css, native-live ios/android all 200.
  Log: claude-runner/done/5-2-008-install-r615-slot-refresh.log; backups + installed.sha256 in d6-lab/s52/out/install.
- 5-2-009-after-install (queued in lane d6b, waiting for a timing slot): 24 cold loads on the installed canonical dist +
  tools/ax macOS/Web/compare recapture of md-tab-panel, md-breadcrumbs, md-stepper -> outputs/native-parity/_ax-s52.
- Checkpoints: only md-stepper/checkpoint.json pins md-step.tsx (report: stale, 3 changed pins incl. other stories' installs);
  md-tabs/native/checkpoint.json is stale from other installs, md-tab-panel.tsx not pinned there.
- 5-2-009-after-install (lane d6b): 24 cold run.mjs Web loads on the INSTALLED canonical dist: breadcrumbs collapsed 24/24, trail
  24/24, tab-panel 24/24, stepper dot-nonlinear / horizontal / mobile / readonly / vertical 24/24 each (0 missing in 192 captures).
  tools/ax macOS + Web + compare recapture -> outputs/native-parity/_ax-s52: md-breadcrumbs macOS pass 2/2 (Web text incl. the last
  crumb); md-tab-panel macOS pass (the current Laboratory default has `active: false`, so the panel is legitimately hidden there);
  md-stepper 5 cases: readonly pass, 4 cases open `relation x4` (Web aria-controls with no macOS link) - pre-existing and owned by
  story 5-3 (fa-lab/s53/out/015 and 020 show the same, before this install); Web panel text present in all 5.
- 5-2-010-install-defects-r615 (MAIN queue): dated "5-2 status (2026-11-15)" line appended to R6-15 in work/audit/DEFECTS.md
  (anchored, pre-image checked; backup d6-lab/s52/defects/DEFECTS.before-5-2.md). Status: FIXED and INSTALLED, awaiting r6 re-check.
- Checkpoint: `checkpoint-refresh.py refresh --tags md-stepper` -> stale-recorded (22/22 pins current; 3 changed pins recorded, incl.
  md-step.tsx; backup d6-lab/s52/defects/md-stepper.checkpoint.before-5-2.json). Not confirmed: md-stepper's checkpoint evidence is
  native + Web and other stories' installs changed pins too; confirm belongs to the stepper evidence owner (5-3) after its re-runs.

#### Acceptance review (session 1)
- AC1 (0/24 per case on the fixed build, Mac Chrome 153): met - installed canonical dist 5-2-009 0/24 in all 8 cases; private build
  5-2-007 2 x 24 also 0; diag52 0/168 (5-2-007). Before: 5-2-001 tab-panel 1/24, stepper 12/120 missing.
- AC2 (affected Web suites pass): met - 28 suites 333/333 spec+e2e on canonical in 5-2-008 (and in s52-tree, 5-2-007); new specs
  fail before (3 suites, 5-2-005/007) and pass after (11/11).
- AC3: macOS - tools/ax recapture 5-2-009 as above (no regression from this change); iOS simulator and Android - not run: this is a
  Web-only change in packages/core (no SwiftUI / Compose source touched), and the story's lanes are "no Android, no simulator".
  The coordinator should say if native runs are still wanted. Canonical install byte-identical with the tested tree: all 6 files
  identical (5-2-008 log + d6-lab/s52/out/install/installed.sha256 vs out/007/fixed-src.sha256).
- Files changed in canonical: packages/core/src/utils/slot-refresh.ts (new), utils/slot-refresh.spec.ts (new),
  components/md-tab-panel/md-tab-panel.tsx, md-tab-panel.slot-refresh.spec.ts (new), components/md-step/md-step.tsx,
  md-step.slot-refresh.spec.ts (new); packages/core/dist rebuilt.
- Open items: r6 re-check of R6-15; md-stepper checkpoint confirm (owner 5-3); the root cause is in Chrome - other components that
  render a slotted panel on a later render may need the same `refreshNewSlots` call if tools/ax ever shows the same signature
  (an ignored slot with no children). md-accordion-item / md-breadcrumb-item keep their earlier ripple-late fixes (still 0/24).

## Review Triage Log

