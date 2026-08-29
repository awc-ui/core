---
'@awc-ui/core': patch
---

**charts:** a short chart's escaping tooltip (the sparkline branch) now stays
fully inside its host whenever the host is wide enough to hold it. The escape
branch let the card overhang sideways by design, but inside a clipping ancestor
— a KPI tile's `md-card` is `overflow: hidden` — the overhang truncated the
reading mid-number. The overhang remains only for hosts genuinely narrower than
the card, where no non-clipping position exists.
