#!/usr/bin/env node
// Compatibility entry point; all five Pictor ports run the same assertions.
process.argv.splice(2, 0, 'svelte');
await import('../../shared/scripts/verify-browser.mjs');
