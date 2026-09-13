# AWC UI Core MCP server

`@awc-ui/mcp` gives AI assistants read-only access to Core's component catalog,
exact API contracts, component manuals, and framework/theming guides. It uses
the [official MCP SDK](https://ts.sdk.modelcontextprotocol.io/v2/) over stdio.
Documentation is bundled at build time, so the installed server runs offline
without an API key, browser runtime, repository checkout, or Core dependency.

## Connect your assistant

Use Node 22.13+ (22.x), or Node 24+, and choose your assistant below.

### Codex

With the Codex CLI installed, add the server once:

```sh
codex mcp add awc-ui -- npx -y @awc-ui/mcp
```

Restart Codex after adding it, then use `/mcp` to check the connection. The
desktop app and CLI share this configuration.

### Claude Code

Run this from your project folder:

```sh
claude mcp add --transport stdio --scope project awc-ui -- npx -y @awc-ui/mcp
```

This saves the server in the project's `.mcp.json`. Start Claude Code, approve
it when prompted, and use `/mcp` to check the connection. Use `--scope user`
instead of `--scope project` to make the server available across your projects.

### Other MCP clients

Add this local stdio server to your assistant's MCP configuration. Your client
may use a different outer settings format:

```json
{
  "mcpServers": {
    "awc-ui": {
      "command": "npx",
      "args": ["-y", "@awc-ui/mcp"]
    }
  }
}
```

The client starts the server for you; no separate terminal process is needed.
The first download needs internet access, then the server serves its bundled
documentation offline.

Without a version suffix, `npx` uses npm's `latest` tag. Check the server's
reported `coreVersion` against your installed Core version. If they differ,
choose an MCP release with matching bundled documentation; installing the
latest MCP does not update Core in your project.

Ask your assistant:

> Use the awc-ui MCP to build a responsive dashboard using only AWC Core
> components. Read the framework guide and relevant component APIs before
> implementing, and check that the documentation matches my installed Core.

See [Building with AI](https://awc-ui.dev/guides/building-with-ai/) for the
complete workflow and optional skills.

## Run from this repository

Use Node 22.13+ (22.x), or Node 24+, and the repository's pnpm version:

```sh
pnpm install
pnpm build:mcp
node packages/mcp/bin/awc-ui-mcp.mjs
```

The server waits for MCP messages on stdin. It writes protocol messages only
to stdout; startup failures go to stderr. `--help` prints usage and exits.

Configure a stdio-capable MCP client with an absolute executable path:

```json
{
  "mcpServers": {
    "awc-ui": {
      "command": "node",
      "args": ["/absolute/path/to/core/packages/mcp/bin/awc-ui-mcp.mjs"]
    }
  }
}
```

The client must resolve `node` to a supported version. This example is a common
JSON configuration shape; adapt the outer configuration to your MCP client.
No client or global configuration is changed by the package.

A source build uses the current checkout's documentation, which may include
unreleased changes. Use the published package for a released Core version.

## Tools, resources and prompts

| Tool | Purpose |
| --- | --- |
| `search_components` | Search tags, summaries and manual text; ranked results with `limit`, `offset` and `nextOffset`. Empty query lists components. |
| `get_component` | Read `manual`, structured `api`, or `both` for an exact `md-*` tag. |
| `list_guides` | Discover framework, SSR, build, token and accessibility guide IDs. |
| `get_guide` | Read a guide by its advertised ID. |

Resources expose the same documentation at `awc://catalog`,
`awc://components/{tag}/manual`, `awc://components/{tag}/api`, and
`awc://guides/{id}`. Prompts `awc-ui-build` and `awc-ui-review` accept `task`
and an optional `framework`.

Search, component and guide tool responses report the bundled `coreVersion`.
Treat this as a versioned reference: it does not inspect your dependencies or
claim that every documented feature exists in an older installation. Manuals
are the canonical Markdown; guide snapshots preserve the original MDX source.
Repository-relative links are source references, not paths on the client.

The server has no write, shell, arbitrary-file, URL-fetch, or application-data
tools. AI clients still own their normal editing and execution permissions.

## Maintain and verify

```sh
pnpm test:mcp
pnpm --dir packages/mcp pack --pack-destination /tmp
```

The builder regenerates the public custom-elements manifest, bundles each
canonical component manual and an explicit guide allowlist, and includes the
Core version. Missing manuals fail the build. Build/prepack and Turbo inputs
keep this snapshot tied to source changes without hand-maintained API copies.

For an MCP-only release against an already-published Core package, first extract
that exact npm tarball and identify its matching Core Git tag. Then set both
inputs for the build and pack commands, replacing `<core-version>` with the
version of that published Core package:

```sh
export AWC_MCP_CORE_PACKAGE=/absolute/path/to/extracted/core/package
export AWC_MCP_GUIDES_REF="v<core-version>"
pnpm build:mcp
pnpm --filter @awc-ui/mcp test
pnpm --dir packages/mcp pack --pack-destination /tmp
```

This uses the published package's APIs and manuals and the matching Git ref's
framework guides. It rejects mismatched versions. Omitting both inputs retains
the normal source build used when Core and MCP ship together.

Reusable agent skills are included in Core. Run
`npx --no-install awc-ui ai-setup --skills` from your app to install them.
Installing MCP does not update Core or install skills in your project. See
[Building with AI](https://awc-ui.dev/guides/building-with-ai/).
