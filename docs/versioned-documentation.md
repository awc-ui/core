# Versioned documentation

The documentation header groups versions into **Latest LTS**, **New versions**,
and **Previous versions**. `/versions/` lists the same groups. Switching versions
keeps the same page when it exists; otherwise it opens that version's overview.

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
soon**. Beta releases are never labeled LTS.

For the first stable release, select **promote_lts** when running the Publish
workflow with `channel=prod`. This captures the release reference and designates
it Latest LTS. The option is off by default: publishing a newer beta or stable
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
numeric beta suffixes. The LTS release appears only once in the selector.

## Capture a release

From the repository root, after the release commit and tag exist:

```sh
git fetch origin --tags
pnpm docs:snapshot --ref v1.0.0-beta.14
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

The publish workflow captures beta and production releases **after** creating
their release tag, then commits the new archive separately. Snapshot npm builds
do not create documentation versions. The workflow explicitly starts CI after
the archive commit; successful CI triggers the documentation deployment. This
is necessary because pushes made with GitHub's workflow token do not start
push-triggered workflows. The initial beta.14 reference is verified
against both its Git tag and its published Core package.
