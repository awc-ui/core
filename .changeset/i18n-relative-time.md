---
'@awc-ui/showcase-kit': minor
---

**i18n:** `formatRelativeTime(value, now, options)` on the translator — "3h
ago", "in 2 days", localised through `Intl.RelativeTimeFormat` with a
year-to-second unit ladder and a memoised formatter per locale.

**BOTH INSTANTS ARE ARGUMENTS.** The reference instant is passed in rather than
read from `Date.now()`, which is what lets a fixture-backed screen render the
same words today as next year — and what makes it usable from a build that
writes static files and stops. Values are truncated toward the reference rather
than rounded, so something 90 minutes old is "1h ago" and never "2h ago".
