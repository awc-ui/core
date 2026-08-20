/**
 * URL safety for components that expose an `href` prop.
 *
 * Every `href` is consumer-supplied, and consumers routinely bind it to data
 * they didn't author (a CMS field, an API response, a row of user records).
 * A `javascript:` or `data:` URL in that position executes script the moment
 * the link is followed — in the consumer's origin, with their session. The
 * component is the last place that can stop it, because static analysis of
 * *this* repo never sees the untrusted value: it enters at the API boundary.
 *
 * Allowlist, not denylist. A denylist has to anticipate every dangerous
 * scheme (`javascript:`, `data:`, `vbscript:`, `blob:`, browser-specific
 * ones); an allowlist only has to name the handful that navigation needs.
 */

/** Schemes a link is allowed to navigate to. Everything else is dropped. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'ftp:'];

/**
 * Return `value` when it is safe to navigate to, otherwise `undefined`.
 *
 * Relative URLs (`/path`, `?q=1`, `#anchor`) and protocol-relative ones
 * (`//host/path`) pass through — they inherit the page's origin and scheme
 * and cannot introduce a new one.
 *
 * The returned string is the caller's original value (trimmed), never a
 * normalised or re-encoded one: rewriting a URL that was already safe risks
 * breaking query strings and fragments that consumers depend on.
 */
export function sanitizeHref(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;

  const href = String(value).trim();
  if (!href) return undefined;

  /* Scheme detection runs on a stripped copy, because URL parsing drops ASCII
     whitespace and control characters that sit *inside* the scheme. Without
     this step a tab or newline spliced into "javascript:" reads as an unknown
     scheme here while still navigating in the browser.

     `[^!-~]` keeps only printable, non-space ASCII (0x21-0x7E) — which covers
     every character legal in a scheme — and drops spaces, tabs, newlines,
     control characters and non-ASCII alike. The stripped copy is used solely
     to decide; the original is what gets returned. */
  const probe = href.replace(/[^!-~]/g, '').toLowerCase();

  const colon = probe.indexOf(':');
  if (colon === -1) return href; // no scheme at all — relative

  /* A colon that appears after the first `/`, `?` or `#` belongs to the path,
     query or fragment, not to a scheme: `/a:b`, `?x=1:2` and `#a:b` are all
     relative URLs. */
  const separator = probe.search(/[/?#]/);
  if (separator !== -1 && separator < colon) return href;

  return SAFE_SCHEMES.includes(probe.slice(0, colon + 1)) ? href : undefined;
}

/**
 * `window.open` features that sever the opener relationship.
 *
 * Without `noopener` the opened page can reach back through `window.opener`
 * and navigate the page that opened it — reverse tabnabbing, which turns any
 * outbound link into a phishing vector. `noreferrer` implies `noopener` and
 * additionally withholds the `Referer` header; it is included because the
 * components that already opened links correctly used both, and a library
 * should not leak the embedding URL to third parties by default.
 *
 * `_self`, `_top` and `_parent` keep their meaning when these are set; every
 * other target name behaves as `_blank`.
 */
export const SAFE_WINDOW_FEATURES = 'noopener,noreferrer';

/**
 * `rel` value for a rendered anchor that opens in a new browsing context.
 *
 * Modern browsers imply `noopener` for `target="_blank"`, but the guarantee
 * only holds for that exact target — a named target (`target="preview"`) still
 * hands over `window.opener`, so the attribute is set explicitly.
 */
export const SAFE_LINK_REL = 'noopener noreferrer';
