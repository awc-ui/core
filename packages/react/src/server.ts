// SSR entry — React wrappers that server-render each component's Declarative
// Shadow DOM via @awc-ui/core/hydrate, then hydrate on the client. Import these
// (instead of the client components from '@awc-ui/react') when you want styled
// server markup on first paint, e.g. in a Next.js App Router server component.
export * from './components.server.js';
