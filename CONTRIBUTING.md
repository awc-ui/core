# Contributing to AWC UI

Thanks for helping out. AWC UI is Material Design 3 web components built with
[Stencil](https://stenciljs.com/) in a pnpm + Turbo monorepo.

The project is in **beta**: the API is stable enough to build on but not frozen,
so well-argued proposals to change a shape still land.

- **Something is broken** → [Report a bug](#reporting-a-bug)
- **Something is missing on an existing component** → [Request a feature](#requesting-a-feature)
- **A whole component is missing** → [Request a component](#requesting-a-new-component)
- **You want to write the code** → [Development](#development) and
  [Adding a component](#adding-a-component)

You do not need to write code to help. A bug report with a reproduction is worth
more than a patch we cannot verify.

---

## Reporting a bug

Open a **Bug report** at
[github.com/awc-ui/core/issues/new/choose](https://github.com/awc-ui/core/issues/new/choose).

Before you do, two checks that resolve a good share of reports:

1. **Is the Material Symbols font loaded?** If icons render as words (`add`
   instead of a plus), the stylesheet is missing or requested without its axis
   ranges. See the [iconography guide](https://awcui.io/guides/iconography/).
2. **Is the component actually defined?** A component that renders at zero
   height, or ignores clicks while its methods still work, is usually not
   hydrated yet rather than broken.

### What makes a report actionable

The one thing we cannot work around is not being able to reproduce it. Everything
else we can chase down ourselves.

- **A reproduction.** A [Stackblitz](https://stackblitz.com), a CodePen, or a
  plain HTML file — whatever is fastest for you. Failing that, the smallest
  markup that shows the problem, as text rather than a screenshot, so we can
  paste and run it.
- **What you expected and what happened.** "The menu closes" and "the menu should
  stay open when I pick a second option" are different bugs on the same click.
- **Version and environment.** `@awc-ui/core` version, browser and version, and
  the framework if you are using a wrapper. Say if it is SSR — the failure modes
  are different.
- **Console output**, if there is any. A stack trace or a 404 on a runtime chunk
  usually names the cause outright.

For a **visual** bug, a screenshot genuinely helps — but include the markup too,
because we cannot measure a screenshot.

### Security issues

Do **not** open a public issue for a vulnerability. Email the maintainers or use
GitHub's private
[security advisory](https://github.com/awc-ui/core/security/advisories/new)
flow, and give us time to ship a fix before disclosure.

---

## Requesting a feature

Use the **Feature request** template. This covers a new prop, variant, event,
slot or CSS custom property on a component that already exists.

Lead with the problem, not the solution. "I need a prop that does X" tells us
less than "when a user does A, I have no way to B" — the second lets us find a
shape that also solves the four adjacent cases, and often the answer turns out to
be an existing API you had not found.

Include:

- **The use case.** What are you building, and what does the user see?
- **What you tried.** Existing props, slots, `::part()`, the CSS custom
  properties. If a workaround exists but is bad, say why it is bad.
- **Rough API sketch**, if you have one. Markup is fine, and you will not be held
  to it.
- **Whether MD3 specifies it.** A link to
  [m3.material.io](https://m3.material.io) makes the decision much faster, and a
  feature the spec already describes is close to automatically accepted.

Requests that make a component's behaviour configurable when MD3 is prescriptive
about it are usually declined — those become "do it in your app's CSS" or a
`::part()` hook instead.

---

## Requesting a new component

Use the **New component request** template. A component is a large, permanent
commitment: it needs an implementation, a readme, unit and e2e tests, a
Storybook story, docs, and a bundle budget, and every one of those has to be
maintained afterwards. So the bar is higher than for a feature.

Tell us:

- **Which MD3 component it is**, with a link to its spec page. AWC UI tracks
  MD3 — a component with no spec entry needs a much stronger argument, because
  we would be inventing the design as well as the code.
- **What you would build with it**, concretely.
- **Why composition is not enough.** Many requests are already reachable by
  slotting existing components together. If you tried that and it fell short,
  what fell short?
- **Prior art.** How Material Web, Vaadin, Spectrum or Shoelace handle it — and
  where theirs falls down for your case.

**Offering to implement it makes a real difference.** Say so in the issue and
we will agree the API shape with you before you write anything, so the review is
about correctness rather than direction.

Before opening, check the
[component list](https://awcui.io/components/) — there are 56 components and
some hide under a name you might not guess (`md-otp-field`,
`md-transfer-list`, `md-organization-chart`).

---

## Development

### Setup

Node 18+ and pnpm 9+ (the repo pins `pnpm@9.5.0`).

```bash
pnpm install
pnpm --filter @awc-ui/core build     # build the library first
```

Most things depend on `packages/core/dist`, so the first build is not optional.

### Where things live

| Path | What |
|---|---|
| `packages/core` | The components (`src/components/md-*/`) |
| `packages/{react,angular,vue,svelte}` | Generated wrappers — **never hand-edit** `proxies.ts` / `components.ts` |
| `packages/tokens` | The `--md-sys-*` design tokens |
| `apps/docs` | Astro/Starlight docs site |
| `apps/storybook` | Storybook |

### Everyday commands

| Task | Command |
|---|---|
| Build core | `pnpm --filter @awc-ui/core build` |
| Targeted spec test | `pnpm --filter @awc-ui/core test:spec -- <pattern>` |
| E2E test (real browser) | `pnpm --filter @awc-ui/core test:e2e -- <pattern>` |
| Typecheck | `pnpm --filter @awc-ui/core lint` |
| Lint TS / CSS | `pnpm lint:eslint` / `pnpm lint:stylelint` |
| Storybook | `pnpm storybook` |
| Docs site | `pnpm --filter @awc-ui/docs dev` |
| Bundle budget | `pnpm --filter @awc-ui/core size` |

**Run targeted tests while you iterate.** Stencil runs are slow, and an
unfiltered spec run under a live watcher can wedge. Save the full suite for a
final pass.

### Two build configs

`stencil.config.ts` is the real build. `stencil.config.dev.ts` is a lean config
Storybook's watcher uses — it emits **unhashed, unminified** entries into the
same `dist/`, and Stencil does not clean between configs. If you have run
Storybook and then need a production build:

```bash
rm -rf packages/core/dist && pnpm --filter @awc-ui/core build
```

Otherwise both generations sit in `dist/md3` at once and the unminified ones can
win. The docs' `sync-runtime` step fails loudly if it sees this.

### The docs serve a copy of the runtime

`apps/docs` does not import `@awc-ui/core`; it serves a copy of the built runtime
from `public/awc-runtime/`, produced by `pnpm --filter @awc-ui/docs sync-runtime`.
Nothing re-runs that on its own. If docs components render at zero height, check
the console for a 404 on a runtime chunk before suspecting CSS.

---

## Adding a component

Open an issue first (see [above](#requesting-a-new-component)) so the API is
agreed before you build.

### 1. Scaffold

```bash
mkdir -p packages/core/src/components/md-my-component
```

Five files, all required:

```
md-my-component.tsx        implementation
md-my-component.css        styles — MD3 tokens only
md-my-component.spec.ts    unit tests
md-my-component.e2e.ts     browser tests
readme.md                  API, do/don't, patterns
```

Every one of the 81 existing components ships all five. The readme is not
optional — the docs site and the API tables are generated from the source and
that file.

### 2. Implementation

```tsx
import { Component, Host, h, Prop, Event, EventEmitter } from '@stencil/core';

@Component({
  tag: 'md-my-component',
  styleUrl: 'md-my-component.css',
  shadow: true,
})
export class MdMyComponent {
  /** Visual variant. */
  @Prop({ reflect: true }) variant: 'default' | 'alternate' = 'default';

  /** Whether the control is disabled. */
  @Prop({ reflect: true }) disabled = false;

  /** Fired when the user activates the control. */
  @Event() mdAction: EventEmitter<void>;

  private handleClick = () => {
    if (!this.disabled) this.mdAction.emit();
  };

  render() {
    return (
      <Host
        class={{ 'md-my-component': true, [`md-my-component--${this.variant}`]: true }}
        role="button"
        tabindex={this.disabled ? -1 : 0}
        aria-disabled={this.disabled ? 'true' : 'false'}
        onClick={this.handleClick}
      >
        <span class="md-my-component__state-layer" part="state-layer" aria-hidden="true" />
        <slot />
      </Host>
    );
  }
}
```

House conventions, all enforced in review:

- **Shadow DOM always.** No `shadow: false`.
- **Events are prefixed `md`** and documented with a doc comment — the comment
  becomes the API table.
- **Reflect props** that CSS or consumers need to see as attributes.
- **A prop only gets an attribute if its type is primitive.** Arrays and objects
  are properties; if authors should be able to write them in markup, accept
  `T[] | string` and parse JSON (see `utils/json-prop.ts`).
- **Density.** If the component has padding or a hit target, support the
  `density` prop (0 to -4) via `--md-sys-density-scale`.
- **RTL.** Logical properties throughout (`inline-size`, `padding-inline`,
  `inset-inline-start`). Directional icons mirror; direction-neutral ones do not.
- **Form controls** participate via `ElementInternals` / `setFormValue` — never
  a hidden input in the shadow root. Spec mocks no-op `setFormValue`, so the
  real assertion has to be an e2e test.

### 3. Styles

Only `--md-sys-*` tokens — no hard-coded colours, radii, durations or easings.
Every token gets a fallback: `var(--md-sys-color-primary, #6750A4)`.

```css
:host {
  display: inline-flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  border-radius: var(--md-sys-shape-corner-full, 9999px);
  background-color: var(--md-sys-color-primary, #6750A4);
  color: var(--md-sys-color-on-primary, #FFFFFF);
}

.md-my-component__state-layer {
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--md-sys-motion-duration-short2, 100ms)
    var(--md-sys-motion-easing-standard, cubic-bezier(0.2, 0, 0, 1));
}

:host(:hover) .md-my-component__state-layer { opacity: 0.08; }
:host(:active) .md-my-component__state-layer { opacity: 0.12; }
:host(:focus-visible) .md-my-component__state-layer { opacity: 0.12; }

:host([disabled]) { opacity: 0.38; pointer-events: none; }

@media (prefers-reduced-motion: reduce) {
  .md-my-component__state-layer { transition: none; }
}
```

Expose customisation deliberately: a `--md-my-component-*` custom property for
values, `::part()` for elements. Both are public API from the moment they ship.

### 4. Tests

Spec tests cover rendering, props, events and ARIA. E2E covers real interaction,
focus, and anything needing layout or a real browser.

```ts
import { newSpecPage } from '@stencil/core/testing';
import { MdMyComponent } from './md-my-component';

it('emits mdAction on click', async () => {
  const page = await newSpecPage({
    components: [MdMyComponent],
    html: `<md-my-component>Hello</md-my-component>`,
  });
  const spy = jest.fn();
  page.root.addEventListener('mdAction', spy);
  page.root.click();
  await page.waitForChanges();
  expect(spy).toHaveBeenCalled();
});
```

Two traps that have cost real time here:

- **Never register `md-ripple` in a spec** — the WAAPI mock crashes.
- **Async `@Method` close-chains need a second `waitForChanges()`.**

For anything visual, measure rather than eyeball: assert computed styles or
bounding boxes in an e2e test. A screenshot cannot fail CI.

### 5. Story and docs

Add `apps/storybook/src/stories/MdMyComponent.stories.ts` with at least a
default story and one covering every variant. Prefer **slotted content** over
text props in stories, or the preview renders empty.

Adding a new `@Method` or member needs a **Storybook restart**, not just HMR.

### 6. Before you push

```bash
pnpm --filter @awc-ui/core lint        # tsc --noEmit
pnpm --filter @awc-ui/core test:spec
pnpm --filter @awc-ui/core build       # the build type-checks specs too
pnpm --filter @awc-ui/core size        # bundle budget
```

A green Jest run does **not** mean the build is green — a spec-only edit can
break `stencil build`. Check the exit code.

### Checklist

- [ ] `.tsx`, `.css`, `.spec.ts`, `.e2e.ts`, `readme.md`
- [ ] MD3 tokens only, every one with a fallback
- [ ] State layer for hover / active / focus-visible, and a visible focus ring
- [ ] Disabled state, correct ARIA role and attributes
- [ ] Keyboard support (Enter / Space, arrows where the pattern calls for it)
- [ ] `density` support if it has padding or a hit target
- [ ] RTL-safe (logical properties)
- [ ] `prefers-reduced-motion` respected
- [ ] Storybook story
- [ ] Changeset

---

## Pull requests

Work on a branch, open the PR against `main`, and keep it to one concern.

**Every PR that touches source needs a changeset** — CI enforces it:

```bash
pnpm changeset
```

Pick the bump honestly. No tooling can check this for you:

| Bump | When |
|---|---|
| `patch` | Bug fix, internal refactor, performance — no API change |
| `minor` | New component, prop, variant, event, or CSS custom property (backward compatible) |
| `major` | Removed or renamed API, changed default, changed event payload |

Exempt from needing one: `apps/`, `docs/`, `.github/`, `scripts/`, root configs,
`README.md`, `LICENSE`.

The summary you write lands in the CHANGELOG verbatim, so write it for a user of
the library, not for a reviewer.

Commit messages follow the same shape:

```
feat: add md-my-component — a thing that does X
fix: md-button — disabled state swallowed keyboard events
docs: md-meter — document the circular variant
test: md-checkbox — cover indeterminate keyboard toggle
```

> Backticks and `!` inside `git commit -m` get expanded by zsh and words vanish
> silently. Use `git commit -F <file>` when the message needs them.

### What CI runs

`core` (build + spec with coverage) · `e2e` (sharded) · `wrappers` (build +
publint + attw) · `test-ct` (Playwright component tests) · `lint` (ESLint,
Stylelint, tsc) · `changeset-check` · `storybook-build` · `test-a11y`
(axe via Storybook).

---

## Reviews

Expect questions about API shape, accessibility and RTL more than about style —
the linters cover style. Reviews are about the code; nobody is being judged.

If a PR goes quiet, bump it. That is a dropped ball on our side, not impatience
on yours.
