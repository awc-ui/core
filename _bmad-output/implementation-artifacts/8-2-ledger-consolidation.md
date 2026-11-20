---
title: 'One clean ledger: DEFECTS status table and AUDIT summary'
type: 'chore'
created: '2026-11-13'
status: 'ready-for-dev'
story_key: '8-2-ledger-consolidation'
epic: 8
model: 'haiku'
wave: 5
lanes: 'mac lane d2b · no Android · no simulator'
lab: 'work/audit'
depends_on: ['8-1-final-integration-run']
context: ['{project-root}/_bmad-output/project-context.md', '{project-root}/../claude-runner/PARALLEL.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** DEFECTS.md has grown by appended status lines and is hard to read; AUDIT.md has no summary of gate-7 verdicts.

**Approach:** Generate `docs/native-parity/audit/STATUS.md`: one table of every finding with its latest status and evidence path, and one table of the 56 components with their gate-7 verdict. Do not delete history.

## Boundaries & Constraints

**Always:** Copy statuses exactly from the newest dated line of each finding. If the newest line is ambiguous, write 'unclear' and quote it. The rules in project-context.md apply.

**Never:** Do not change any verdict or status. Do not edit DEFECTS.md or AUDIT.md content, only add the summary file through a main-queue install.

</intent-contract>

## Code Map

- `work/audit/DEFECTS.md`
- `docs/native-parity/AUDIT.md`
- `docs/native-parity/audit/*.md`

## Tasks & Acceptance

**Execution:**
- [ ] Parse findings and their dated status lines with a script kept in work/audit/ledger/
- [ ] Write STATUS.md and install it
- [ ] List 'unclear' findings for the coordinator

**Acceptance Criteria:**
- Given STATUS.md, when a row is compared with DEFECTS.md, then the status and evidence match the newest dated line

## Handover

_Filled by an upstream story or the coordinator when there is state to pass on._

## Dev Agent Record

_The agent writes here: progress notes, evidence (job names and counts), decisions, open items._

## Review Triage Log

