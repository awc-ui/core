import { defineCustomElements } from './loader/index.mjs';
// The package's OWN token sheet — dist/md3/md3.css carries all 218 --md-sys-*
// tokens, so this entry needs nothing outside the package. Importing
// @awc-ui/tokens here instead made core depend on a second package that a
// consumer installing only @awc-ui/core would not have, and the import failed
// with ERR_MODULE_NOT_FOUND.
import './dist/md3/md3.css';

// Client-only convenience entry. Guarded so importing it in a Node/SSR graph
// doesn't throw `ReferenceError: window` at module eval. (The tokens.css import
// still makes this a browser/bundler-only entry — for SSR use `@awc-ui/core/hydrate`.)
if (typeof window !== 'undefined') {
  defineCustomElements(window);
}
