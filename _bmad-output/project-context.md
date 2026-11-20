# AWC native parity — project context for story agents

Read this file fully before touching anything. Then read your story file. Then read `work/claude-runner/PARALLEL.md`.

## What this project is

The AWC library (Material Design 3 Web Components, `packages/core`) is being migrated to SwiftUI (macOS + iOS, `packages/native-ios`) and Jetpack Compose (`packages/native-android`). A studio app, the Laboratory (`apps/native-playground`), previews every component on Web, SwiftUI and Compose. Each of the 56 Laboratory components must match the Web source contract (properties, events, methods, slots, CSS hooks, parts), be verified against Chrome 153 oracles, and pass an independent gate-7 audit recorded in `docs/native-parity/AUDIT.md`.

## Where things are

- Root on the Mac: `R=/Users/ionut-valentinmitrache/Documents/Codex/2026-10-07/p`. In the `device_bash` shell the same folder is `$HOME/mnt/p`.
- Canonical repo: `R/work/awc-native` (branch `claude/native-parity-2026-11-05`). **Never run git commands.**
- Docs: `docs/native-parity/` — `AUDIT.md` (ledger and the seven gates), `<tag>.md`, `<tag>-source-review.md`, `audit/<tag>.md`, `ios-harness.md`, `accessibility.md`.
- Evidence: `R/outputs/native-parity/<tag>/` (oracles, `checkpoint.json`, accessibility captures).
- Protocol: `R/work/claude-runner/PARALLEL.md`. Audit protocol: `R/work/audit/AUDIT-PROTOCOL.md`. Findings: `R/work/audit/DEFECTS.md`.
- Earlier agents' work: `R/work/<code>-lab/` (`PROGRESS.md`, `REQUESTS.md`, patches, job scripts) and private trees `R/work/<code>-tree*`. Your story names the lab you continue from. Their latest results are the newest `R/work/claude-runner/done/<code>-*.log` files; `PROGRESS.md` can be older than those logs.
- BMAD (v6.12): `_bmad/`, `.claude/skills/bmad-*`. Epics: `_bmad-output/planning-artifacts/epics.md`. Stories: `_bmad-output/implementation-artifacts/<story-key>.md`.

## How to run things

- `mcp__remote-devices__device_bash` is a Linux VM with the Mac folder mounted. Use it to read, search and edit files. It cannot run macOS tools (swift, xcodebuild, simctl, adb, gradle, node against the Mac's Chrome).
- macOS execution goes through job files. Write a bash script to `R/work/claude-runner/queue-<lane>/<story-key>-NNN-<desc>.sh` (NNN zero-padded). It runs from the canonical repo; output goes to `claude-runner/done/<name>.log`, exit code to `.exit`. Jobs must use absolute Mac paths.
- The main queue `claude-runner/queue/` is only for canonical installs, Laboratory restarts and other shared-state changes.
- `device_bash` calls from all agents run one at a time on a single bridge (measured 2026-11-15). Keep each call to a few seconds, put several reads into one call, and never `sleep` in it: a sleeping call blocks every other agent. To wait for a job, sleep in the cloud `Bash` tool (for example `sleep 240` with `timeout: 300000`), then check with one short `device_bash` call. Never sleep longer than 240 seconds in one call: a gap of more than 5 minutes between two of your calls drops the prompt cache, and your whole context is then sent again at full price (measured on 2026-11-15: 23 re-sends of 220k tokens in the 6-5 session, 21 in the 7-7 audit). For a long job, repeat `sleep 240` calls and check the Mac only every second or third time.
- Wrap long commands with `claude-runner/tools/with-timeout.sh <seconds> <cmd>`. Run every timing-sensitive suite (states, motion, iOS harness, Android device timing tests, tools/ax captures) through `claude-runner/tools/slot.sh timing 4 <cmd>`.
- The Mac has 16 cores and is shared by about ten stories; its load average was 120 to 550 on 2026-11-15, which causes timing misses. Wrap every build (`swift build`, `xcodebuild`, `gradle`) in `claude-runner/tools/slot.sh build 2 <cmd>`. Build first, then run the built binary in the timing slot; never hold a timing slot while building. Wrap each single fixture run in `with-timeout.sh` (a run that normally takes 5 minutes gets 20), so one hung run cannot block your lane.
- An iOS job takes the timing slot once and keeps it from boot to shutdown: one call of `claude-runner/tools/slot.sh timing 4` around the boot, `bootstatus -b`, 60 s of settling, every run of the job and the shutdown; no simulator is booted outside a held slot; keep such a job under about 40 minutes (PARALLEL.md, Load discipline, 2026-11-20 08:12 UTC). Runs that decide a class start only in a quiet minute: the last line of `claude-runner/load/load-<UTC day>.log` shows a load below 30 and `boot=0` (wait up to ten minutes, then start and mark the run). A run that ended with `slot.sh: Permission denied` or any exit 126 has no result.
- Your story frontmatter names your Mac lane, your Android lane (one emulator per Android lane: a1=5556, a2=5558, a3=5560, a4=5562, a5=5564, a6=5566) and your iOS simulator clone. Use only those.
- `emulator-5554` and port 4177 are the user's Laboratory. Never test there. Only a main-queue install may reinstall the APK there (build with `ANDROID_USER_HOME=$W/android-user`) and restart the server (recipe: `claude-runner/done/710-laboratory-start.sh` step 5).
- A job that restarts the server on 4177 must first export the Android variables of line 18 of `claude-runner/done/710-laboratory-start.sh` (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, `ANDROID_AVD_HOME`, `ANDROID_USER_HOME`, `ANDROID_SERIAL`). Install job 9-3-...-100 did not, and since 2026-11-15 19:14 UTC Android previews answer 503 (finding s7-5-02). After a restart, read `/api/native-live/status?platform=android` and `?platform=ios` and require `"available":true` in both bodies; the HTTP code alone proves nothing. The coordinator repaired it on 2026-11-16 at 09:43 UTC (job `881-coord-laboratory-restart`): Android is available again.
- Do not run artificial CPU load on the Mac (busy loops, extra suites started only to make load) unless a coordinator note in your Handover allows it for a named job. It disturbs the timing runs of every other story: on 2026-11-16 one story's loaded jobs kept the load average at 270 to 1000 for two hours. If you need a loaded reproduction, say so in `open_items`; the coordinator gives you a window when the other chains are idle. Every job that runs a timing-sensitive suite prints the load at its start and end (`uptime`); a failure at a 1-minute load above about 300 is repeated before it is believed.
- If `device_bash` keeps failing, switch to file mode: write scripts under `/mnt/user-data/outputs/<story-key>/vN/` (new folder per write), push them with `device_commit_files`, read logs with `device_stage_files`. If the Mac is unreachable for more than a few minutes, stop and report.
- Lanes were last restarted on 2026-11-16 at 15:43 UTC (17:43 Mac time) after the stop of 13:35 UTC; they exit on 2026-11-21 at 15:50 UTC. Since then each lane, and each lane job, runs in its own process group. All 7 Android emulators and the Laboratory server were restarted at the same time (cold boot). The Mac's clock is UTC+2; job logs use Mac time.
- You are one of several story agents running at once. Another agent may have worked on your story before you: its notes are in the story's Dev Agent Record and Handover sections, and its job logs are `claude-runner/done/<story-key>-*.log`.
- If your lane does not pick up jobs (its `lane-<x>.log` ends with a limit message), stop and report. Do not restart lanes.
- Never signal a process group from a job: no `kill 0`, no `kill -- -<n>`, no `pkill -g`, and no `pkill -f` pattern that can match `claude-runner`, a runner script or another story's job. On 2026-11-16 at 13:35:04 UTC one job's helper `( trap 'kill 0' EXIT; ... ) &` stopped the main runner, every lane and every running job (`KNOWN-CAUSES.md` row 34). Stop a background helper by its pid: `pkill -P $BG; kill $BG; wait $BG 2>/dev/null`.
- A job whose log ends with the coordinator line "This job did not end by itself" and whose `.exit` is 143 was stopped by that event, not by its own result. Before you queue it again (under a new number), check your private tree: files that the job's trap restores, half-applied patches, diagnostic lines left in tests.
- If no lane and not the main queue picks up jobs (no lane log gets new lines for more than 10 minutes while jobs wait), the runner is down. Only the user can start it. Do not wait and do not queue more jobs: update Current state, return `continue_now: false` and say "runner down" in `open_items`.

## Rules

- Work in a private tree first (snapshot recipe: `work/fx-lab/integrate-snapshot.sh`). Change canonical only through one main-queue install job per batch: anchored edits with pre-image checks, a dry run on a copy, rollback on failure, byte identity with your verified tree. New Swift files need the playground built with `--disable-build-manifest-caching`.
- Queue the install only when every line under **Always** of your story is met with numbers, or a coordinator note names the install and its conditions. If one line is not met, do not install: end with the words coordinator decision and the table. A mutation run that passes, or a miss of the check the story is about, is never 'recorded and handed on' in front of an install. (2026-11-20: story 9-34 installed with two lines unmet; that install is marked provisional.)
- Before you investigate a timing, focus or capture failure, read `R/work/claude-runner/KNOWN-CAUSES.md` and try a recorded fix first. When you find a new cause, append it there.
- Defects are fixed test-first: add the failing test or Chrome oracle case, then the fix. Do not widen tolerances unless Chrome's own measured variance justifies it, and say so.
- A failure that disappears on rerun is still a finding until its cause is known.
- No `::part` exceptions where a typed native part API is implementable. Pattern: `AccordionParts.swift`, `AWCAccordionParts.kt`, `apps/native-playground/appearance-part-rules.js`.
- An exception needs the full record from AUDIT.md's Exception policy and only a gate-7 reviewer can accept it.
- Cleanup: shut down any simulator you boot when the job exits, kill servers and Chrome you start, keep one booted simulator at a time.
- After a canonical install: refresh and confirm checkpoints with `tools/checkpoint-refresh.py`, and append a dated status line with the evidence path to each finding you closed in `DEFECTS.md`. Do not rewrite other agents' lines.
- Other stories run in parallel. Shared files (`AWCNativeView.swift`, `AWCComponent.kt`, `NativeFocusBridge.swift`, `test-native-views.sh`, `server.mjs`, Laboratory registries, `tools/ax/*`, `AUDIT.md`, `DEFECTS.md`) change only through anchored edits in install jobs.

## Definition of done for a story

- Every task is done and every acceptance criterion is met, with evidence: job names and pass counts on macOS, the iOS simulator and Android, as the story requires.
- The canonical install is verified, and docs, AUDIT row and checkpoint are updated.
- The story file is updated: tick the tasks, fill "Dev Agent Record" (what changed, evidence, open items), and set `status` to `review`. If you cannot finish, set `blocked` and say exactly why and what is left.
- Keep a `### Current state` block as the first thing in the Dev Agent Record: at most 15 lines, rewritten (not appended) at the end of every session: what is done, what is in flight (job names), and the next step with its exact command.
- When you edit a story file with a script, find a heading by its whole line (for example the regular expression `^### Current state$` in multi-line mode), never by the first occurrence of its words: coordinator notes and task texts quote the same words, and two story files lost their notes and the `## Dev Agent Record` heading that way. After each write, run `grep -n "^## \|^### " <story file>` and check that `## Handover`, `## Dev Agent Record` and `### Current state` are still there. The same holds when you write a note into another story's file.
- Write each piece of evidence also as one line of the form `EVIDENCE | <job name> | <platform> | <suite> | <pass>/<total>`, so the coordinator can check it against the log mechanically.
- Do not edit `sprint-status.yaml`; the coordinator syncs it.

## Token discipline

- Put many steps into one job. Do not poll a running job more often than it can plausibly change.
- Never print whole logs. Use `grep`, `tail -n`, `cut -c1-200`.
- Write notes into your story file as you go, so a successor can resume without redoing your investigation.
- Do not re-derive what the lab's `PROGRESS.md` already states.
- When blocked, stop and report. Do not loop.
- Your final reply to the coordinator is short: status, evidence counts, open items.

## Audit stories (epic 7)

- Your reviewer id is `s<epic>-<n>` (for example `s7-1`). Use it wherever `AUDIT-PROTOCOL.md` says `rN`: job names, your folder `work/audit/s7-1/`, and the verdict prefix "Gate 7 (s7-1, <date>)".
- Use the Mac lane, Android lane and simulator named in your story, not the ones the protocol lists for r1..r6.
- Earlier reviewers' folders (`work/audit/r1`..`r6`) hold probes and scripts you may reuse; re-run, don't trust their numbers.
- An audit story ends with `status: done` when every component in its scope has a dated gate-7 verdict in AUDIT.md backed by your own re-runs (PASS, PASS WITH ACCEPTED EXCEPTIONS, or FAIL with the findings in DEFECTS.md). If you could not finish, set `blocked` and say what is left.
- Port 4177 and emulator-5554: only the read-only Laboratory probes that AUDIT-PROTOCOL.md describes.

## Sessions and tokens (rules v5, 2026-11-15)
Measured on 2026-11-15: about 40% of all tokens went into steps that only waited for jobs, and much of the rest into sessions with a large context. Every tool call re-reads the whole context.
- If your task text contains the line `Run rules: v5`, follow the session rules in the task text.
- If it does not, you were started by an older run. Then: make at most about 70 tool calls in this session; keep waits to `sleep 240`; if everything you could still do depends on a job that will not finish within about 15 minutes, stop. When you stop without a final status (`review`, `done`, `blocked`), rewrite `### Current state`, list the jobs you wait for in `open_items`, and return `continue_now: false`. The coordinator restarts the story with the new rules.
- Put several steps into one job script and let it print one summary line per suite (pass/total), so that one read gives the result.
- The `### Current state` block must be enough for the next session to continue without re-reading logs: what is done, what is in flight (job names), the next step with its exact command.
