# Tessellate Academy (showcase-tessellate)

Tessellate Academy is a fictional online course platform built with Nuxt 3 and AWC UI, server-rendered with Declarative Shadow DOM and hydrated on the client. Learners browse a systems-design course catalog with live search and topic filtering, drill into a course's syllabus, reviews and enrollment card, track per-course lesson progress alongside a quiz-score chart and an overall completion meter, and sit a linear checkpoint quiz that gates each step until a question is answered and ends in a scored results card. All styling uses MD3 design tokens only.

## Screens

- **Catalog** (`/`) — course grid of `md-card`s with read-only `md-rating`s and `md-chip` topic tags, a docked `md-search` with keyboard-navigable results, and `md-chip` filter chips by topic.
- **Course** (`/courses/[slug]`) — hero with enroll `md-button`, `md-tabs` + `md-tab-panels` for Lessons / About / Reviews, and an `md-accordion` syllabus with per-module lesson lists.
- **My progress** (`/progress`) — per-course linear `md-progress-indicator`s, a circular `md-meter` for overall completion, and an `md-bar-chart` of checkpoint quiz scores.
- **Quiz** (`/quiz`) — a linear `md-stepper` with one `md-radio` question per `md-step`, Continue gated until answered, and an `md-card` results panel with per-question verdicts and a score `md-meter`.

## AWC components exercised

`md-card` · `md-rating` · `md-chip` · `md-search` · `md-button` · `md-tabs` · `md-tab` · `md-tab-panels` · `md-tab-panel` · `md-accordion` · `md-accordion-item` · `md-progress-indicator` · `md-meter` · `md-bar-chart` · `md-stepper` · `md-step` · `md-radio` · `md-divider`

## Run it

```bash
pnpm --filter @awc-ui/showcase-tessellate dev
```

Build (SSR gate):

```bash
pnpm --filter @awc-ui/showcase-tessellate build
```
