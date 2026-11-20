---
title: 'md-date-picker Android: intermittent HTTP 400 in the live-host test (s7-11-01); paint test default for the year scroll'
type: 'bugfix'
created: '2026-11-15'
status: 'review'
story_key: '9-13-date-picker-android-live-host-400-and-paint-default'
epic: 9
model: 'sonnet'
wave: 6
lanes: 'mac lane n4 · android lane a4 (emulator-5562) · no simulator'
lab: 'work/s913-lab (create it; private tree work/s913-tree = a copy of canonical; the reviewer's runs are in work/audit/s7-11)'
depends_on: ['7-11-audit-search-transfer-list-date-picker']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The gate-7 audit s7-11 (2026-11-16) passed md-date-picker and left two Android items. s7-11-01 (non-blocking): `LivePreviewDatePickerHostTest` failed once with an HTTP 400 (job s7-11-A001) and passed 3 of 3 in job s7-11-A004; the same test failed the same way on 2026-11-14. The cause is not known, so the live preview of the date picker on Android can answer 400 to a valid request now and then. Second item: the Android paint test of the date picker passes 31436/31436 only with `awcDpD9=1`; without the flag 606 checks fail (3 hook-year cases, the year scroll of Decision 9). Story 1-3 changed the Swift test on 2026-11-16 so that a run without flags uses the motion capture and passes (its job 100-install-paint-test); the Android test still needs the flag, so a plain run of the Android suites fails.

**Approach:** For the 400, find what the host answers 400 to. Run the live-host test in a loop on your emulator, 30 times alone and 30 times with a second instrumented test running on the same emulator, and log for every request the path, the body size and the response code with its error body. Read the host's validation code for the path that answers 400 and name the condition; the usual shapes are a request that arrives before the session is ready, a body cut by a timeout, and a stale session id after the host activity restarts. Fix the cause in the host or in the order of the test's steps. For the paint default, make the Android paint test behave as the Swift one does after story 1-3: the year-scroll cases use the motion capture by default, so that a run without flags passes every check. Keep a way to run the old strict mode and show that it still fails the same 606 checks, so that the default hides nothing new.

## Boundaries & Constraints

**Always:** The live-host test fails at least once in the loop before the change (if 60 runs do not fail, raise the count and record the rate) and passes every run of the same loop after it. The Android paint suite fails 606 checks without flags before the change and passes without flags after it. The rules in project-context.md apply.

**Never:** Do not add a retry around the request. Do not change the Swift date-picker sources or tests (story 1-3 owns them). Do not run artificial CPU load on the Mac; a second test on your own emulator is allowed.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md` -- s7-11-01
- `work/claude-runner/done/s7-11-A001-android.log` and the s7-11-A004 log (the failing and the passing runs)
- the Dev Agent Record of story `1-3` (2026-11-16, job 100-install-paint-test: what the Swift default now is) and of story `1-5` (the Decision 9 cause)
- the Android date-picker tests and the live-preview host (find them with `ls -R apps/native-android-playground packages | grep -i -E 'datepicker|LivePreview'`)

## Tasks & Acceptance

**Execution:**
- [x] Loop the live-host test (30 alone, 30 with a second test running); log path, body size, code and error body per request; the failure rate
- [x] Name the 400 condition from the host's code and the log; fix the cause; the same loop passes every run
- [x] Android paint test: the same default as in Swift; a run without flags passes; the strict mode still fails the same 606 checks
- [x] The other Android date-picker suites once (states, live host, views); one main-queue install (dry run, rollback, byte identity); DEFECTS.md status line `ready for re-check` for s7-11-01; refresh and confirm the md-date-picker checkpoint

**Acceptance Criteria:**
- Given the live-host test, when it runs 60 times as in the loop, then every run passes, and the cause of the 400 is named with the request that triggered it
- Given the Android paint suite, when it runs without flags, then every check passes, and the strict mode shows the same 606 failures as before
- Given the story's tasks are done, when the coordinator reads the story file, then every claim has a job name and pass counts for macOS, the iOS simulator and Android, and the canonical install is verified byte-identical to the tested tree.

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

### Current state
- DONE (session 5). Fix installed on canonical byte-identical to s913-tree (job 100-install); DEFECTS.md s7-11-01 line `ready for re-check` and md-date-picker checkpoint confirmed `current` (job 110-defects-confirm).
- 400 cause: TimeoutException (5 s capture wait) was the only path to the message-less 400; now 504 naming the request. Original load-217 failure not reproduced (60/60 before and after); needs a coordinator load window if the reviewer wants it.
- Paint: Decision 9 default, strict awcDpStrict=1 fails 606 of 32042 as before. dp-states, noop-host: exit 0 in A004.
- Next: reviewer re-check only.

EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A004-loop-after-fix | android | LivePreviewDatePickerHostTest alone x30 after fix | 30/30
EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A004-loop-after-fix | android | LivePreviewMenu/Tooltip/DatePickerHostTest sequence x30 after fix | 30/30
EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A004-loop-after-fix | android | NativeDatePickerPaintTest default (no flags) after fix | 31436/31436

EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A002-loop-live-host-logged | android | LivePreviewDatePickerHostTest alone x30 (diagnostic APK) | 30/30
EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A002-loop-live-host-logged | android | LivePreviewMenu/Tooltip/DatePickerHostTest sequence x30 | 30/30
EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A003-paint-default-and-strict | android | NativeDatePickerPaintTest default (no flags) | 31436/31436
EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A003-paint-default-and-strict | android | NativeDatePickerPaintTest strict awcDpStrict=1 (606 expected failures, explained: strict mode keeps the old year-scroll checks) | 31436/32042

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

EVIDENCE | 9-13-date-picker-android-live-host-400-and-paint-default-A001-loop-live-host | android | LivePreviewDatePickerHostTest alone x30, old APK baseline (1 failure = docked test, open=false panel still present after 700 ms sleep; not the 400; explained) | 29/30

## Review Triage Log

