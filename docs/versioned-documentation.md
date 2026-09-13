# Versioned documentation

The documentation header groups versions into **Latest LTS**, **New versions**,
and **Previous versions**. The **Documentation versions** navigation link opens
`/versions/`, which lists the same groups. Switching versions keeps the same page
when it exists; otherwise it opens that version's overview.

**Next (development)** includes unreleased changes and interactive examples.
Release references preserve the component manuals, generated API definitions,
and guides from an exact release commit. Their examples are rendered as code;
historical MDX and demo components are never executed with the current runtime.
Each release overview has its own reference search. Archived pages are excluded
from the current site's Pagefind index.

## Designate Latest LTS

LTS is an explicit documentation channel, stored as `channels.lts` in
`apps/docs/versions/manifest.json`. It is independent of npm's `latest` tag.
Until a stable archive is designated, the selector shows **Latest LTS — coming
soon**. Prereleases are never labeled LTS.

To designate a stable release, select **promote_lts** when running the Publish
workflow with `channel=prod`. This captures the release reference and designates
it Latest LTS. The option is off by default: publishing a newer prerelease or stable
version must not silently replace an existing LTS.

You can also capture and designate a tagged stable release from the repository:

```sh
pnpm docs:snapshot --ref v1.0.0 --lts
```

Or promote an already archived stable version without fetching Git history:

```sh
pnpm docs:snapshot --promote-lts 1.0.0
pnpm docs:versions:check
```

Replace `1.0.0` with the real stable release. Promotion verifies the archives,
rejects missing or prerelease targets and downgrades, and changes only the
manifest pointer. Commit and deploy that manifest change; frozen archive files
remain unchanged.

Releases newer than the designated LTS appear under **New versions**, together
with development docs. Older releases appear under **Previous versions**. Each
group is sorted newest first using semantic version precedence, including
numeric prerelease identifiers. The LTS release appears only once in the selector.

## Capture a release

From the repository root, after the release commit and tag exist:

```sh
git fetch origin --tags
pnpm docs:snapshot --ref v1.0.0
pnpm docs:versions:check
pnpm --filter @awc-ui/docs test
```

Replace the example tag with the release to archive. The tag must contain a
matching `@awc-ui/core` package version. `HEAD` and branch names are rejected so
unreleased APIs cannot be archived under an existing package version.

The snapshot reads the release's `custom-elements.json`, component readmes,
and guides in `getting-started`, `frameworks`, `theming`, `behaviour`, `guides`,
and `recipes`. Compare and showcase pages are not part of the release reference.
If an older tag lacks the generated manifest, pass
`--package /absolute/path/to/extracted/package` for that exact npm release.
The package identity, version, and manuals must match the tag; where the tag
contains a manifest, its API must match too.

Commit both the new gzip snapshot in `apps/docs/versions/` and its entry in
`manifest.json`. The manifest records the release tag, full commit SHA, and
compressed file's SHA-256 checksum. Repeating a capture verifies the existing
snapshot; changing an already archived version is rejected. Do not regenerate
old snapshots from current source or edit their contents in place.

## Build and release integration

Docs tests exercise capture, immutability, integrity, version navigation, and
safe rendering. `pnpm docs:versions:check` validates the committed archives
without fetching Git history or accessing the network. Both local docs builds
and CI run these checks before rendering `/versions/<version>/…`.

The publish workflow captures prereleases and production releases **after** creating
their release tag, then commits the new archive separately. Snapshot npm builds
do not create documentation versions. The workflow explicitly starts CI after
the archive commit; successful CI triggers the documentation deployment. This
is necessary because pushes made with GitHub's workflow token do not start
push-triggered workflows. Each release reference is tied to its exact Git tag;
when a published package is supplied, its APIs and manuals are verified too.

## Production deployment

Production deployment verifies that all eight packages exist on npm at the
source Core version. A stable version also needs its visible, verified release
reference. This prevents release-preparation commits from deploying before
publishing and archive capture finish. PR previews can still build unreleased
changes. Run the same check locally with `node scripts/check-docs-release.mjs`.

A retired reference can be marked `hidden: true` in the versions manifest. Its
immutable source artifact remains integrity-checked, but the site excludes its
routes, links, search entries, and selector option. The active LTS cannot be
hidden.
