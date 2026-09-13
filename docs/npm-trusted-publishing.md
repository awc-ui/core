# npm Trusted Publishing migration

The manual `Publish` workflow now has an `authentication` choice. It defaults to `trusted`: GitHub Actions authenticates with a short-lived OIDC identity and passes no stored npm token. A real authorized release is still required to verify the account-side trust end to end. Existing release gates, version stamping, package selection, provenance, and GitHub release handling remain in place.

## Complete npm setup

An npm maintainer must configure **each** package: `@awc-ui/core`, `@awc-ui/tokens`, `@awc-ui/react`, `@awc-ui/vue`, `@awc-ui/angular`, `@awc-ui/svelte`, `@awc-ui/theme`, and `@awc-ui/mcp`.

In each package's Settings → Trusted publishing, add GitHub Actions with:

| Field | Value |
| --- | --- |
| Organization or user | `awc-ui` |
| Repository | `core` |
| Workflow filename | `publish.yml` |
| Environment name | Leave blank; this workflow declares no environment |
| Allowed actions | Enable direct `npm publish` |

New configurations permit staged publishing by default, so direct publishing must be enabled explicitly for this workflow. npm does not validate the connection when it is saved. The workflow must run on GitHub-hosted runners with `id-token: write`; Trusted Publishing requires npm ≥11.5.1 and Node ≥22.14.0. ([npm setup and requirements](https://docs.npmjs.com/trusted-publishers/))

The workflow retains Node 22 and installs **npm 11.19.1** only in trusted mode. That npm version is pinned from the current npm 11 maintenance changelog and supports Node 22. ([npm changelog](https://docs.npmjs.com/cli/v11/using-npm/changelog/), [npm 11.19.1 package metadata](https://github.com/npm/cli/blob/v11.19.1/package.json))

## Choose the release path

| Request | `token` | `trusted` |
| --- | --- | --- |
| Snapshot → `snapshot` | Existing behavior | Supported after setup |
| Prerelease → dedicated dist-tag | Existing behavior | Supported if no bootstrap repair is needed |
| Prerelease plus `promote_latest=true` | Publishes the prerelease and promotes latest | Rejected before publishing |
| Production → `latest` | Existing behavior | Supported; publish assigns latest directly |
| Prerelease while latest points at a bootstrap snapshot | Automatically repairs latest | Rejected before publishing |

OIDC authenticates publishing, not `npm dist-tag`. The trusted branch therefore performs no extra tag writes. A read-only preflight checks public metadata for all eight packages before versioning, and again immediately before publishing. It rejects bootstrap repairs, prerelease promotion, and existing versions whose requested tag differs; pnpm would skip those existing versions. The error identifies the package and the required action. ([npm OIDC command limitations](https://docs.npmjs.com/trusted-publishers/#limitations-and-future-improvements))

For a prerelease requiring latest promotion or bootstrap repair, a maintainer can perform the necessary tag update interactively under separate release authorization. The explicit `authentication=token` legacy fallback remains available during migration. For an existing version whose tag needs repair, the preflight prints the exact `npm dist-tag add` command. No tag command is run automatically in trusted mode.

Both authentication branches use `pnpm -r ... publish`, preserving pnpm's workspace-range rewriting and Angular's `publishConfig.directory=dist`. Trusted mode explicitly selects the upgraded npm executable with `npm_config_npm_path`; pnpm otherwise prefers the npm next to its Node executable. The trusted branch passes no npm secret and unsets token environment variables before npm performs its OIDC exchange. Token publishing and the `NPM_TOKEN` repository secret remain available during migration.

## Verify and finish the migration

1. Review the workflow and run `node --test scripts/check-publish-auth.test.mjs` locally. This checks runtime bounds, auth branches, promotion/repair rejection, and partial reruns without publishing anything.
2. Confirm all eight npm configurations use the exact owner, repository, workflow filename, and direct-publish permission above. Package repository URLs already point at `https://github.com/awc-ui/core`.
3. For the **next separately authorized release**, choose `authentication=trusted` and a compatible channel/tag plan. Inspect the published package versions, requested tags, and provenance for all eight packages.
4. Trusted mode is already the default. After the first successful OIDC release, decide how maintainers will handle the remaining interactive dist-tag operations before removing the legacy fallback.
5. Only then restrict token publishing and revoke/remove obsolete credentials. npm recommends validating Trusted Publishing before disabling tokens. ([npm migration sequence](https://docs.npmjs.com/trusted-publishers/#migration-tip))

Packing and `publish --dry-run` validate artifacts but do not prove OIDC trust. `npm whoami` does not validate OIDC either; authentication happens during publish. This migration does not itself authorize or trigger a release. ([npm authentication limitations](https://docs.npmjs.com/trusted-publishers/#limitations-and-future-improvements))

## npm token deprecation and install security

Sensitive account, organization, and package-management operations now require interactive 2FA even with bypass-2FA granular access tokens. npm targets January 2027 for removing those tokens' direct-publishing capability; Trusted Publishing is the automated replacement. This npm change does not revoke GitHub tokens. ([July 31 enforcement update](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/))

npm 12 also makes dependency lifecycle scripts, Git dependencies, and remote URL dependencies opt-in. This workflow still installs workspace dependencies with pnpm and uses the pinned npm 11 CLI for OIDC publishing, so migrating authentication does not change the workspace's install policy. ([July 8 announcement](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/))

## New package bootstrap

A newly added package needs an authenticated first publication before it can join the trusted release workflow. Configure its npm Trusted Publisher for the repository and workflow listed above; a bootstrap publication does not configure that trust automatically. The preflight rejects missing packages.

Core and MCP normally ship together. For an MCP-only release, bundle the matching published Core APIs and manuals as described in the [MCP maintenance guide](../packages/mcp/README.md#maintain-and-verify).
