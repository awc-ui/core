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
   ranges. See the [iconography guide](https://awc-ui.dev/guides/iconography/).
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
[component list](https://awc-ui.dev/components/) — there are 56 components and
some hide under a name you might not guess (`md-otp-field`,
`md-transfer-list`, `md-organization-chart`).

---

## Development

### Setup

Use Node 22.13+ (22.x) or Node 24+ and the pinned `pnpm@9.5.0`.
The repository's `.nvmrc` selects Node 22.

```bash
nvm install                         # optional, for nvm users
corepack enable
node scripts/check-environment.mjs
pnpm install
pnpm dev                            # build theme/core and start Storybook
```

If Corepack is not installed, install `pnpm@9.5.0` using your package-manager
setup, then continue with `pnpm install`. The environment check validates the
contributor runtime before a large install. Framework consumer requirements are
listed in their own guides.

Most tools consume generated core output. `pnpm dev` and `pnpm dev:docs` build
their prerequisites; focused `pnpm --filter @awc-ui/core ...` commands assume
you have already built core when their task needs it.

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
| Docs site + component refresh | `pnpm dev:docs` |
| Contributor tooling checks | `pnpm verify:contributor` |
| Scaffold an action component | `pnpm generate:component md-my-component` |
| Bundle budget | `pnpm --filter @awc-ui/core size` |

**Run targeted tests while you iterate.** Stencil runs are slow, and an
unfiltered spec run under a live watcher can wedge. Save the full suite for a
final pass.

### Build and preview ownership

`stencil.config.ts` produces release and SSR output. Storybook's lean
`stencil.config.dev.ts` writes into the same `dist` directory. Run one core
preview at a time and stop it before a production build. The production build
already clears `dist`; a separate manual deletion is unnecessary.

```bash
pnpm --filter @awc-ui/core build
pnpm --filter @awc-ui/storybook build-storybook   # bootstrap dependencies via Turbo
```

The Storybook `build` task builds only Storybook; Turbo schedules core and theme
first. Use `build-storybook` for a standalone static build from a fresh checkout.
Turbo also caches core's `hydrate/` SSR renderer and waits for theme before
building the docs site.

### Docs preview

`pnpm dev:docs` builds core and theme, copies the runtime into
`apps/docs/public/awc-runtime`, generates the API reference, and starts Astro.
It watches core source/readmes, theme source, Storybook stories and generation
scripts. Saves are debounced and rebuilds are serialized, so a change during a
build gets a follow-up build. The last successful runtime stays available while
core compiles. A failed rebuild logs its error; fix the source and save to retry.
Ordinary docs edits use Astro's normal reload.

This uses the production core build so the preview matches the published
runtime; component rebuilds take longer than Storybook's lean preview. Use
Storybook for rapid visual iteration. The complete deployment build (including
showcases) remains `bash scripts/build-docs.sh`.

---

## Adding a component

Open an issue first (see [above](#requesting-a-new-component)) so the API is
agreed before you build.

### 1. Scaffold

```bash
pnpm generate:component md-my-component --dry-run
pnpm generate:component md-my-component
```

The generator creates an action-control scaffold, five co-located files, and
Default/Disabled Storybook stories. It refuses existing files. It starts with a
native button, which supplies Enter/Space activation and disabled semantics;
adapt the implementation to the agreed component pattern instead of assigning
a generic button role to every new component.

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
  /** Whether the control is disabled. */
  @Prop({ reflect: true }) disabled = false;

  /** Fired when the user activates the control. */
  @Event() mdAction!: EventEmitter<void>;

  private handleClick = () => {
    if (!this.disabled) this.mdAction.emit();
  };

  render() {
    return (
      <Host>
        <button type="button" part="control" disabled={this.disabled} onClick={this.handleClick}>
          <slot />
        </button>
      </Host>
    );
  }
}
```

The native button supplies keyboard activation, focus and disabled behavior.
Keep its default slot to a text label; do not nest interactive controls in it.
The generator also includes density, a visible focus ring, and browser tests
for Enter, Space and disabled behavior.

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
button {
  border: 0;
  border-radius: var(--md-sys-shape-corner-full, 9999px);
  background: var(--md-sys-color-primary, #6750a4);
  color: var(--md-sys-color-on-primary, #fff);
  font: inherit;
}

button:focus-visible {
  outline: 3px solid var(--md-sys-color-secondary, #625b71);
  outline-offset: 3px;
}

button:disabled { opacity: 0.38; }
```

The generated stylesheet includes hover/active state treatment, density,
logical spacing and reduced-motion behavior. Expand those rules for the
component's actual visual specification.

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
  page.root!.addEventListener('mdAction', spy);
  page.root!.shadowRoot!.querySelector('button')!.click();
  await page.waitForChanges();
  expect(spy).toHaveBeenCalled();
});
```

Two traps that have cost real time here:

- **Never register `md-ripple` in a spec** — the WAAPI mock crashes.
- **Async `@Method` close-chains need a second `waitForChanges()`.**

For visual behavior, assert computed styles or bounding boxes in an e2e test.
A manually inspected screenshot is useful evidence, but automated assertions
are what make regressions fail CI.

### 5. Story and docs

Add `apps/storybook/src/stories/MdMyComponent.stories.ts` with at least a
default story and one covering every variant. Prefer **slotted content** over
text props in stories, or the preview renders empty.

Adding a new `@Method` or member needs a **Storybook restart**, not just HMR.

### 6. Before you push

```bash
pnpm verify:contributor               # setup, generator and build-graph checks
pnpm lint:eslint
pnpm lint:stylelint
pnpm --filter @awc-ui/core lint
pnpm --filter @awc-ui/core exec stencil test --spec md-my-component
pnpm --filter @awc-ui/core exec stencil test --e2e md-my-component
pnpm --filter @awc-ui/core build
pnpm --filter @awc-ui/core test:ssr
pnpm --filter @awc-ui/core size
```

Replace `md-my-component` with the affected component. Run browser tests after
installing their browser prerequisites, and stop live core watchers before the
build. `verify:contributor` is a quick tooling check, not the full release gate.
For public API/package changes also run the consumer/package checks in CI;
for a new component, add its bundle budget and regenerate docs with
`pnpm generate:docs`.

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

**Every PR that touches published source needs a changeset** as a review
requirement. The automated changeset gate is currently disabled; maintainers
check this until release automation is re-enabled:

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
