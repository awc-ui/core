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
