---
'@awc-ui/showcase-kit': minor
---

**social:** a new vertical — Lyra, a social photo app — exported from
`@awc-ui/showcase-kit/social`. 24 people, 42 posts over 66 generated SVG
pictures, 115 threaded comments, 20 notifications and 10 topics, all derived
from one seed, plus the selectors the five framework builds read: `feedItems`,
`exploreTiles`, `activityGroups`, `profileSummary`, `storyRail`,
`suggestedPeople`, `composerLibrary` and `engagement`.

Two conventions are new here and are worth knowing before you build on it.
**Time is an instant, not a date** — every timestamp is rendered against
`REPORTING_INSTANT` rather than the clock, so a feed says the same thing on
every machine and in every screenshot. **Every image is self-describing** —
`altKey` is mandatory on the media record, because generated abstract artwork
is not self-explanatory the way a photograph is.
