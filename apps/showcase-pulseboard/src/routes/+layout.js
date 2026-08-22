export const prerender = true;

// Emit directory-style output (funnels/index.html) instead of funnels.html so the
// static tree resolves on ANY host. Extensionless URLs like /funnels only work
// where the host does pretty-URL rewriting (Netlify does; a plain static server
// does not) — directory indexes work everywhere.
export const trailingSlash = 'always';
