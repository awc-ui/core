---
title: 'md-search on iOS 18.6: about 60 ms without a frame after the docked open is applied (S1-2-B2)'
type: 'bugfix'
created: '2026-11-15'
status: 'in-progress'
story_key: '9-43-search-docked-open-frame-hole-ios18'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n3 · simulator: the iPhone on iOS 18.6 that story 1-2 used (work/n3-lab/search2/common.sh names it)'
lab: 'work/n3-lab/search2 (the lab of story 1-2: common.sh, patches/, out/; private tree work/n3-tree2, restored to canonical by job 169; make a fresh copy if canonical moved)'
depends_on: ['1-2-md-search-finish-and-install']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Story 1-2 ended with one open finding, S1-2-B2 (DEFECTS.md). On the iOS 18.6 simulator the case docked-divided-ltr of `NativeSearchStatesIntegration` fails `click-bar-focus` in 10 of 10 runs (job 166; one time step, t=83, with two or three properties: bar x, bar width, panel opacity) and `Escape-closes` in 2 of 10. Job 169 (three launches, third click of the run, times from the click start): the open state is written about 2 ms after the press (+12 to +20), the first applyTracks with open=true runs at +40 to +52, and then no frame is presented for about 60 ms: native frames at t=35 and then t=99 to 115, while the Web shows its first frame with panel opacity above 0 at t=66.6 (the envelope accepts up to 100.6). No line of the component's trace runs inside the hole; the SwiftUI tap action arrives after it, at +73 to +80. Moving the open to the UIKit touch end (patches/tapup.py) changed nothing and is not installed. The +33 ms mutation of the close fails Escape-closes 3 of 3 (job 167). What holds the main thread in the hole is not known: the trace cannot show that no code of ours is on the path.

**Approach:** Find who holds the main thread in the hole, with samples, before changing anything. Short trial job first, then one measurement job on iOS 18.6, docked-divided-ltr only, 10 launches: sample the fixture process at 1 ms from just before the measured click (`/usr/bin/sample <pid> 2 1 -file <out>`, as job 132 of story 1-2 and job 010 of story 9-32 did), with the wall-clock times of the press, of the open write, of the first applyTracks and of the next presented frame printed on both sides, so that the stacks inside the hole can be cut out. Give the stacks of the hole by share: UIKit first responder and keyboard work (becomeFirstResponder, the text input session, the keyboard task queue), SwiftUI layout and AttributeGraph work of the panel that mounts (whose view types), Core Animation commit, or the test's own calls (a read or a capture). Do the same for Escape-closes. Then one of three ends. (A) The hole is UIKit work of the focus turn and no frame of ours is on the stacks: write the line under the user decision 'UIKit focus turn' with the bracket and the share as its proof, and say what the FAIL line would need to carry that proof by itself (the diagnostics of story 9-38 exist for four other test files; do not add them to the search test without a coordinator note). (B) Code of the component is on the stacks (layout of the results panel, a synchronous measure, a first use that repeats on every open): fix it in the private tree, ten alternating pairs base against fix on iOS 18.6, the search states suite x10 on iPhone 26.3 and x5 on the iPad, the +33 ms mutation of the open 3 of 3, an event-order test for click, Tab and Escape, macOS states and paint once, and the install under the name the coordinator gives. (C) The test's own call sits in the hole: say which, and end with the words coordinator decision.

## Boundaries & Constraints

**Always:** The stacks of the hole are in the record for at least five launches that miss, with shares, and the story ends with one of the three ends above with its numbers. The rules in project-context.md apply. The rules in project-context.md apply.

**Never:** Do not widen a tolerance and do not add a retry. Do not pass a time from the test into the product. Do not move the open again without a cause from the samples (the tap-up change showed that the write time is not the cause). Do not change AppKitShim.swift, AWCHarnessInput.swift or the search states test. Queue the install only when every Always line is met or a coordinator note names it. Every build step through tools/slot.sh build 2; one boot per job inside the timing slot; start timed runs only when the last line of the load record shows a load below 30 and boot=0 (wait up to ten minutes, then start and mark the run). Before queueing a job check that no file with the same name sits in the lane queue. A job stops at the first failed build. Do not create CPU load on the Mac.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- S1-2-B2
- the story file `1-2-md-search-finish-and-install.md`: Current state and Table B2 (job 169); `work/n3-lab/search2/out/1-2-166`, `1-2-167`, `1-2-169`; `work/n3-lab/search2/patches/` (the trace patch and tapup.py)
- `claude-runner/done/` jobs 132 of story 1-2 and 010 of story 9-32 (how the main thread was sampled); `claude-runner/KNOWN-CAUSES.md` (UIKit focus turn; first focus of the process); `claude-runner/PARALLEL.md` ('User decisions on classes', Load discipline)
- `packages/native-ios/Sources/AWCUI/NativeSearch.swift` and `packages/native-ios/Tests/NativeSearchStatesIntegration.swift`

## Tasks & Acceptance

**Execution:**
- [ ] Trial job, then the sampling job: 10 launches of docked-divided-ltr on iOS 18.6 in quiet minutes; the stacks inside the hole by share, for click-bar-focus and for Escape-closes
- [ ] Name the end (A, B or C) with its numbers; a KNOWN-CAUSES.md row if the cause is new
- [ ] End B only: fix in the private tree; pairs x10 on iOS 18.6; search states x10 on iPhone 26.3 and x5 on the iPad; the +33 ms open mutation 3 of 3 with a line that proves the delayed code ran; event-order test; macOS states and paint; Android only if shared code changed; one main-queue install under the coordinator's name
- [ ] DEFECTS.md status line for S1-2-B2 with the evidence path; refresh and confirm the md-search checkpoint if canonical changed; verify_evidence

**Acceptance Criteria:**
- Given a launch that misses click-bar-focus, when a reader opens the record, then the stacks of the 60 ms hole are there with the times that cut them out
- Given end A, when the line is written, then it carries the bracket and the share, and nothing is installed
- Given end B, when the search states suite runs ten times on iOS 18.6 after the fix, then click-bar-focus passes in every run or its misses are classed with numbers, and the +33 ms mutation fails 3 of 3
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

### Coordinator note (Coordinator note 2026-11-20 08:10 UTC: an iOS job takes the timing slot once, from boot to shutdown; pool back at 2)
New machine rule for iOS jobs (PARALLEL.md, Load discipline, paragraph of 08:12 UTC; read it before you queue the next job). An iOS job takes the timing slot ONCE and keeps it from boot to shutdown: one call of tools/slot.sh timing 4 around the boot, bootstatus -b, the 60 s, every run of the job and the shutdown. No simulator is booted outside a held slot. Keep such a job under about 40 minutes (split x10 into two jobs of five). Reason, measured at 08:08 UTC: 11 simulators were booted with 3 slots, because jobs that take the slot per run go to the back of the first-come queue after every run and keep their simulator booted through every wait; the load was above 120 in 30% of the samples. Jobs already queued stay as they are; change your lab's common script once. The pool is at 2 again. Also read the paragraph of 07:05: tools/slot.sh was not executable from 06:52:18 to 06:59:36 UTC and runs in that window have no result.

### Coordinator note (Coordinator note 2026-11-20 10:05 UTC: relaunch; sample has no time axis: three ways to get stacks with times (what 9-36, 9-20 and 9-22 did; xctrace Time Profiler export; many opens inside the sampled second))
Relaunch. You found the limit of the tool: /usr/bin/sample gives a call tree with counts and no time axis, so a hole of 60 ms is 6 to 8% of a one-second window and cannot be cut out. Do not spend more jobs on window timing. Three ways to get stacks WITH times, in this order; a short trial job for each before a measurement job:
1. What exists already. Story 9-36 separated 'the first 60 ms after the key' on the same simulator (its lab work/s936-lab: job scripts 007 and 009, analysis an-smp.py; result: 37 to 43 samples of Swift generic metadata work in failing runs against 9 in passing). Story 9-20 has a gap record inside the app (work/s920-tree, GapRec) and story 9-22 a block record on macOS; story 9-27 used GapRec in its job 035 (patch927.py). Read how they tie a stack to a time, and reuse it.
2. A time profile with time stamps: xcrun xctrace record --template 'Time Profiler' --attach <pid> --time-limit 5s --output <file>.trace, then xcrun xctrace export --input <file>.trace --xpath for the time-profile table (each sample has a time and a backtrace). Export DEVELOPER_DIR as your lab does. Print a wall-clock mark from the app at the press so that the trace's clock can be tied to it (or use the first sample that shows the touch handler). If xctrace cannot run without a window session, say so in one line and go to way 3.
3. Make the hole a large share of the window: a diagnostic case in the private tree that opens and closes the docked bar six times in a row inside the sampled second (click, Escape, no waits beyond what the motion needs). If every open has its hole, the holes are about a third of the window and their stacks lead the call tree; compare with a second in which nothing is clicked. Private tree only, never installed.
What to report is unchanged: the stacks inside the hole by share (UIKit first responder and keyboard work; SwiftUI layout or AttributeGraph work of the panel that mounts, with the view types; Core Animation commit; the test's own calls), for click-bar-focus and for Escape-closes, from at least five launches, and then end A, B or C. Your aggregate (story code about 80% of the non-idle samples in the second around the click, UIKit focus 10 to 15%) is worth one line in the record as it is, marked as not cut to the hole.
Also find why only 2 of 5 launches ran per job before the next measurement job. An iOS job holds the timing slot once, from boot to shutdown (PARALLEL.md, 08:12).

## Dev Agent Record

### Current state
- Lab work/s943-lab. job-body2.sh (blur trigger) / job-body3.sh (+patch-smp3, applyTracks trigger) take ONE slot.sh timing 4 from boot to shutdown (08:10 rule). incl.py = inclusive per-function view of a sample file; summ.py leaf shares.
- 004 (5 s window, 10 launches, all miss click-bar-focus, 5 also Escape-closes): main thread 100% in NativeSearchStatesIntegration.pump; SwiftUI render ~35%, AWCShimTouch.dispatch/key (test's synthetic input) 10-27%, results rows body ~6%. Window too wide to isolate the 60 ms hole.
- 005/006/007-arm-a/-arm-b: only 2 launches ran per job although K=5 (cause unknown; 008 jobs print LOOP/after-run lines to find it). 007 windows (1 s, trigger = 2nd applyTracks after open=false) do contain click 2 (+0.47 s in), but sample has no time axis, hole ~6-8% of samples: aggregate shows ours~80% of non-idle, focus 10-15%, still not the hole. 007 logs: S-2/T-2 miss, 104/106 checks, open written at +69..87 ms (after focusCb +16..28, applyTracks +40..58), first native panel>0 frame t=144-159. No EVIDENCE lines yet.
- Queued (queue-n3): 008-blur-a, 008-blur-b (job-body4.sh = body2 + loop debug; K=4 each; blur trigger NTH=1, DUR=0.5: sample attach ~0.85 s after blur 1 = window about click-0.05 .. click+0.45 s, i.e. contains the +40..+170 ms hole; tags Ua-n, Ub-n).
- Next: read done/9-43-...-008-blur-a/b .log; per launch compare SMPSTAMP click wall (2nd click stamp) with sample Date/Time (+0200 local, UTC = -2h) and DUR; python3 s943-lab/incl.py out/<job>/sample-X.txt 60. Need >=5 launches whose window holds the click and miss; then Escape-closes variant; then name end A/B/C (test-own AWCShimTouch.key/dispatch share is the end-C candidate, SwiftUI render of panel end B). If LOOP line shows K!=4 or loop stops early, fix that first.

## Review Triage Log

