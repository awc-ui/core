# SvelteKit SSR reference

This workspace example uses Svelte 4 and SvelteKit 2.10+ with AWC UI's SSR-capable
component entries. Build core first, then run:

```sh
pnpm --filter @awc-ui/example-sveltekit dev
pnpm --filter @awc-ui/example-sveltekit build
pnpm --filter @awc-ui/example-sveltekit preview
```

The server handle buffers a complete HTML document before injecting Declarative
Shadow DOM. Client `init` captures the SSR host annotations before Svelte claims
them. The root layout restores missing annotations before dynamically importing
`src/lib/components.ts`, so the component runtime adopts the existing shadow roots.

For a standalone npm installation, use `starters/sveltekit`. Its source requires
the package release containing `@awc-ui/core/ssr/sveltekit`; the packed-candidate
starter harness verifies that integration before the release is published.
