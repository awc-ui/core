# Security

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/awc-ui/core/security/advisories/new). If that channel is unavailable, open an issue requesting a private contact without including exploit details, credentials, or affected customer data.

The project is in beta. Report the exact package version, framework, rendering mode, and a minimal reproduction. Prefer the most recent coordinated AWC UI release; framework packages and core should be upgraded together.

## Runtime and CLI behavior

- The authored core component/CLI code does not contain a built-in analytics or telemetry client. This is not a guarantee that applications using the library make no network requests.
- The loader retrieves the installation's component chunks. User-provided image, link, and asset URLs can cause browser requests. Starter examples may load Google Fonts or published CDN assets. Optional speech recognition uses the browser's platform service.
- The SSR renderer includes Stencil's server DOM/runtime. Applications control the HTML and rendering options they pass to it; review those options before rendering untrusted input.
- `awc-ui ai-setup` updates documented local assistant instruction files. `init` copies bundled starter files into an empty directory, and `doctor` reads installed package metadata and application source to report setup checks. These commands do not install dependencies, fetch remote templates, or send application source to a service. The printed install command is a separate user action.

## Interpreting Socket findings

The public beta.9 report inspected on 2026-09-06 lists `Unpopular package` and the low-severity `URL strings` alert. The latter lists `AGENTS.md`, `CLAUDE.md`, `copilot-instructions.md`, W3C SVG/XHTML/XLink namespace identifiers, Stencil documentation/support links, and a Material Design accessibility reference. A string match is not proof of a network request. Keep standards identifiers and useful documentation intact; review any new executable network behavior separately.

Socket scores also include adoption, maintenance activity, and maintainer counts. They are not vulnerability counts, and a code change cannot guarantee a score of 100. Track meaningful releases, issue triage, and genuine maintainership rather than artificial downloads, commits, or maintainers.

References: [beta.9 alerts](https://socket.dev/npm/package/@awc-ui/core/alerts/1.0.0-beta.9), [URL strings alert](https://socket.dev/alerts/urlStrings), [Socket scoring](https://docs.socket.dev/docs/package-scores).

## Release controls

Publishing currently uses GitHub Actions with npm provenance. Keep package/type, adapter, SSR, starter, and size checks ahead of publication. Require 2FA on publisher accounts and review changes to workflows and dependency locks.

The next account-level improvement is [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for each public package, bound to the `awc-ui/core` repository and `publish.yml` workflow. Configure and verify that relationship in npm before removing token authentication from the workflow; dist-tag operations may still require a separately scoped credential. Do not disable a functioning release path before the trusted publisher is configured. Enable GitHub private vulnerability reporting if it is not already enabled. Account settings and permissions cannot be inferred from repository files.

## Workspace dependency security

The October 2026 dependency refresh updates Angular within its supported 20.3 line and applies targeted transitive overrides in the root manifest. Framework/compiler and CLI/build/SSR patch versions follow their respective upstream release streams. Overrides also cover the documentation, examples, test runners, and Netlify tooling; they do not change the public component API.

Install with `pnpm install --frozen-lockfile`. Temporary patches are registered in `pnpm.patchedDependencies` and their hashes are recorded in the lockfile. `pnpm test:dependency-security` exercises the installed dependency paths in CI, including image transforms, nested CSS selectors, Nuxt Git operations, and the malformed inputs addressed below.

| Dependency | Local change and provenance | Removal condition |
| --- | --- | --- |
| `node-forge@1.4.0` | [Local patch](patches/node-forge@1.4.0.patch) validates nested DigestAlgorithm element counts and empty ASN.1 NULL parameters for [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Regression tests include valid OpenSSL signatures, BER compatibility, malformed structures, and RSA-PSS. This is a local mitigation, not an upstream release. | Upgrade to a release with the equivalent validation, remove the patch registration/file, and rerun the signature tests. |
| `braces@3.0.3` | [Local patch](patches/braces@3.0.3.patch) backports the nesting guards from [upstream PR 78](https://github.com/micromatch/braces/pull/78) for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Parsing and direct AST traversal reject nesting beyond 100 with `SyntaxError`. Tests cover small-stack execution and normal glob behavior. Callers must handle invalid patterns; this does not bound every expansion or regular-expression workload. | Upgrade to an upstream release with equivalent depth limits, remove the patch, and retain the regression tests. |
| `@nuxt/devtools@3.4.1` | [Compatibility patch](patches/@nuxt__devtools@3.4.1.patch) changes the default `simple-git` import to its named export, allowing the security override to `simple-git@4.0.2`. Tests load the actual DevTools chunk, exercise metadata commands, and verify rejection of unsafe inline Git configuration. | Remove when the selected DevTools release supports the patched `simple-git` API without this change. |

As of 2026-10-06, `pnpm audit` still reports the `node-forge` and `braces` advisories because their published versions remain in the affected ranges; version-based scanners do not recognize local patches. It also reports [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) in `sprintf-js@1.0.3`, for which no fixed upstream release is available. The inspected path is `js-yaml@3`'s CLI through `argparse@1`: current callers define their formatting strings in source. No application-request-controlled formatting path was found, but this advisory remains unresolved. Do not dismiss these findings or treat this inventory as a guarantee of no vulnerabilities.

`http-cache-semantics@4.3.0` is outside the currently reported affected range for [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp), but its `max-stale` behavior did not change. The advisory is [disputed upstream](https://github.com/kornelski/http-cache-semantics/issues/56#issuecomment-5975759591); the upgrade is not a demonstrated behavioral fix. The inspected package-download cache uses `shared: false`, and Astro's usage derives build-time image expiry rather than forwarding client cache directives. Reassess if introducing a shared request cache or new dependency paths.
