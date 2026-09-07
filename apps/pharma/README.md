# Vela — pharmaceutical testing workspace

A complete AWC UI showcase for laboratory test management, with eight fictional compounds, 22 seeded test runs, and six analysts. Built entirely from existing AWC components and app-level composition.

## Run

From the monorepo root, build `@awc-ui/core` and `@awc-ui/theme` if their dist folders are missing, then:

```sh
pnpm --filter @awc-ui/pharma dev
```

Open http://127.0.0.1:4398/. Set `PORT` to use a different port.

## Demo access

- Email: `alex.morgan@vela.demo`
- Password: `VelaDemo!2026`
- MFA: `246810`

Use the displayed demo credentials or create a fictional profile. Signup and sign-in both lead through six-digit verification. The five-minute challenge has five attempts and a 30-second resend cooldown; resending does not reset attempts. This is simulated browser authentication, not a production identity service. Passwords and pending challenges are discarded. Only the verified display profile is stored in sessionStorage, for at most eight hours. Signing out clears it.

## Workflows

- Overview: derived workload metrics, sample intake chart, review attention list, priority worklist.
- Test runs: search, status/assay filters, CSV export, run details, assignments, notes, and stage advancement.
- Compounds: candidate catalog with associated test records and program ownership.
- Samples: linked batch register and reconciled passed/flagged/pending counts.
- Review queue: approve results or request a retest, with a review note.
- Research team: assignment capacity, specialties, and individual worklists.

Create a draft, assign an available analyst, queue and start the run, then send the simulated results to review. Approval completes the record; retesting returns it to the queue. Completed records are read-only. Results are fictional and do not represent real analytical measurements, methods, compliance determinations, or medical advice.

Changes persist in this tab's sessionStorage and are validated before restoration. Theme color, density, light/dark mode, RTL direction, and expanded navigation preference persist in localStorage. Controls are available through **Make it yours** beside the account avatar. Desktop uses an expandable navigation rail; compact screens use a bottom bar, with Research team available in the footer.

## Validation

```sh
pnpm --filter @awc-ui/pharma lint
pnpm --filter @awc-ui/pharma test
pnpm --filter @awc-ui/pharma build
```

Authentication and domain tests cover validation, lifecycle invariants, review decisions, capacity, chart metrics, CSV escaping, expiry/attempt budgets, and malformed stored state. Assets are self-contained, including the local AWC runtime, theme engine, fonts, and license notices. Documentation embeds the build at `/showcase/pharma/html/`.
