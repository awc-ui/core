/// <reference types="vite/client" />

/**
 * Ambient declarations for the SFC toolchain.
 *
 * `vue-tsc` understands `.vue` files natively, so there is no `declare module
 * '*.vue'` shim here — adding one would REPLACE the real per-file types it
 * infers with a single opaque `DefineComponent`, and every prop this app passes
 * between screens would stop being checked. The reference above is what brings
 * in Vite's client types for the two CSS imports in `src/main.ts`.
 */

export {};
