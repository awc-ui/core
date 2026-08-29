/**
 * The frame every screen sits in: app bar, navigation rail (desktop),
 * navigation bar (compact), breadcrumb trail, screen heading, screen toolbar,
 * and the showcase dock.
 *
 * Not a single visible string is written here — `useT()` resolves all of them,
 * including the ones that look like constants (the brand name, the base-currency
 * note). The reporting date is formatted through the translator's `formatDate`,
 * which is pinned to `timeZone: 'UTC'`, so 2026-06-30 is 30 June in every locale
 * and on every machine.
 *
 * WHY THE NAVIGATION IS SHAPED THIS WAY — the three rules from §7 of
 * `main-llm.md` that this file exists to obey:
 *
 *   - Destinations are `md-navigation-rail` / `md-navigation-bar`, never
 *     `md-tabs`. `md-tabs` switches sibling views of the SAME data; a screen
 *     agent that wants a tabbed panel inside one screen may use it there.
 *   - The rail's primary action is an `md-fab` in `slot="fab"`, which is the
 *     only slot it belongs in. The rail morphs its `extended` state, so this
 *     file never sets it.
 *   - Exactly ONE navigation surface is present at a time. The rail and the bar
 *     render the same five destinations from the kit's `DESTINATIONS`, and
 *     `app.css` shows one and `display: none`s the other at 900px — hidden, not
 *     merely invisible, so a screen reader never finds two "Main navigation"
 *     landmarks claiming different current destinations.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BASE_CURRENCY,
  DESTINATIONS,
  getAdvisor,
  getBookTotals,
  REPORTING_DATE,
  REPORTING_QUARTER,
  type CrumbSpec,
} from '@awc-ui/showcase-kit/wealth';
import { isPlainActivation, usePathname, useRouter } from '@/lib/router';
import { destinationIndex, route, withBase } from '@/lib/routes';
import { useT } from '@/lib/showcase';
import { ScreenSkeleton, SKELETON_MS } from './skeletons';
import { useCustomEvent, useDomEvent } from './elements';
import { Dock } from './Dock';

/* --------------------------------------------------------------- shell state */

/**
 * State that belongs to the FRAME rather than to a screen, and therefore has to
 * outlive one.
 *
 * `App` returns a different component per route, so React sees a different
 * element type and unmounts the whole subtree — `Screen` included — on every
 * navigation. Anything held in `useState` inside `Screen` is therefore reset by
 * each click: expand the rail, go to Holdings, and it silently collapses again.
 * The provider sits ABOVE the router in `main.tsx`, where nothing unmounts it.
 *
 * Only the rail's expansion lives here today. Resist adding screen state to it:
 * a screen's filters SHOULD reset when you leave the screen, and this is
 * exactly the mechanism that makes them.
 */
interface ShellState {
  railExpanded: boolean;
  toggleRail(): void;
}

const ShellContext = createContext<ShellState>({ railExpanded: false, toggleRail: () => {} });

export function ShellProvider({ children }: { children: ReactNode }) {
  // Collapsed by default: the rail's labels cost 140px of the width a
  // twelve-column holdings table wants, and the icons plus the active indicator
  // already say where you are.
  const [railExpanded, setRailExpanded] = useState(false);
  const toggleRail = useCallback(() => setRailExpanded((open) => !open), []);
  const value = useMemo<ShellState>(() => ({ railExpanded, toggleRail }), [railExpanded, toggleRail]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/* --------------------------------------------------------------- app bar */

/**
 * The masthead. One per page — the host carries `role="banner"`.
 *
 * The leading affordance toggles the rail between its collapsed and expanded
 * variants. It lives HERE rather than in the rail's own `expandable` toggle for
 * one reason: at compact width the rail is not rendered at all, and a control
 * that vanishes with the surface it controls is fine, whereas two toggles for
 * one thing is not. `mdLeadingClick` fires only for the prop-based button,
 * which is exactly the one being used.
 *
 * The trailing slot is CAPPED AT THREE elements by the component (the fourth is
 * hidden and warned about), and M3 wants it sparse. Two are used: the reporting
 * context, and the signed-in advisor. There is no notifications bell, because
 * there is nothing behind it — a control that does nothing is worse than an
 * empty corner.
 */
function AppBar() {
  const t = useT();
  const advisor = getAdvisor();
  const { toggleRail } = useContext(ShellContext);
  const ref = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent>(ref, 'mdLeadingClick', () => toggleRail());

  return (
    <md-app-bar
      ref={ref}
      class="shell__appbar"
      variant="small"
      subtitle={t('wealth.app.title')}
      leading-icon="menu"
      leading-icon-label={t('wealth.nav.menu')}
    >
      {/*
        THE DISCLAIMER IS PART OF THE CHROME, not a footnote.

        Every proper noun in this app is invented — the bank, the households,
        the instruments, the advisors — and it is all presented in the shape of
        a real private-banking console, which is exactly the combination a
        reader could mistake for one. So the disclaimer sits in the app bar,
        beside the brand it qualifies, visible on every screen rather than at
        the bottom of one.

        It goes in the `headline` SLOT rather than the `headline` prop because
        the two are alternatives, and the slot renders inside the same
        `part="title"` span the prop does — so the brand keeps the app bar's own
        title typography and the chip simply sits next to it.

        `md-tooltip` carries the full sentence, and the chip's own label already
        says the load-bearing part: the tooltip is elaboration, never the only
        place the disclaimer exists (§7.2 — a tooltip DESCRIBES, it does not
        name).
      */}
      <span slot="headline" className="shell__brand">
        {t('wealth.app.brand')}
        <md-tooltip text={t('wealth.app.demoNotice')}>
          <md-chip
            label={t('wealth.app.demo')}
            appearance="outlined"
            color="warning"
            icon="science"
          />
        </md-tooltip>
      </span>

      <div slot="trailing" className="shell__meta">
        <span>{t('wealth.app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') })}</span>
        <span>{t('wealth.app.reportingQuarter', { quarter: REPORTING_QUARTER })}</span>
        <span>{t('wealth.app.baseCurrency', { currency: BASE_CURRENCY })}</span>
      </div>
      {/* `label` is the accessible name; `name` only supplies the initials.
          Presentational — the avatar is not a control and opens nothing. */}
      <md-avatar
        slot="trailing"
        name={advisor.name}
        label={t('wealth.app.advisor', { name: advisor.name })}
        size="small"
      />
    </md-app-bar>
  );
}

/* ------------------------------------------------------------------- rail */

/**
 * Top-level destinations at desktop width.
 *
 * `href` IS SET ON EVERY DESTINATION, and that has two consequences worth
 * knowing. It makes each tab a real anchor, so ⌘-click opens a tab and "copy
 * link address" copies something that resolves. And because a link cannot be an
 * ARIA `tab`, the rail drops the `tablist` role from its destinations region —
 * documented behaviour, and the right trade: these ARE links.
 *
 * Routing is driven from the NATIVE click rather than from `mdTabChange`. The
 * anchor is what navigates, so only `preventDefault()` on the click can stop a
 * full page reload — and `mdTabChange` does not fire when you re-activate the
 * destination you are already on, which would leave that one click doing a
 * reload while the other four routed in place.
 *
 * `active-index` is CONTROLLED from the pathname, so the indicator is a
 * function of the URL and never of what was clicked last. Back and forward move
 * it correctly for free.
 */
function Rail() {
  const t = useT();
  const router = useRouter();
  const totals = getBookTotals();
  const { railExpanded } = useContext(ShellContext);
  const ref = useRef<HTMLElement | null>(null);
  const activeIndex = destinationIndex(router.pathname);

  useDomEvent(ref, 'click', (event) => {
    if (!isPlainActivation(event)) return;
    const tab = event
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.tagName === 'MD-NAVIGATION-RAIL-TAB',
      );
    const value = tab?.getAttribute('value');
    const destination = DESTINATIONS.find((d) => d.value === value);
    if (!destination) return;
    event.preventDefault();
    router.push(destination.path);
  });

  return (
    <md-navigation-rail
      ref={ref}
      class="shell__rail"
      label={t('wealth.nav.label')}
      variant={railExpanded ? 'expanded' : 'standard'}
      active-index={activeIndex}
      label-visibility="all"
    >
      {/*
        The one FAB on the screen, and the rail is where M3 puts it: at the top,
        above the destinations. The rail drives its `extended` state from its own
        expansion, so `extended` is never set here.

        `mdClick` on md-fab is dispatched cancelable but the component never
        reads `defaultPrevented` — there is no veto hook — so this listens and
        routes rather than pretending to intercept.
      */}
      <Fab />

      {DESTINATIONS.map((destination) => (
        <md-navigation-rail-tab
          key={destination.value}
          icon={destination.icon}
          label={t(destination.labelKey)}
          value={destination.value}
          href={withBase(destination.path)}
          badge-value={
            destination.value === 'proposals' && totals.openProposalCount > 0
              ? String(totals.openProposalCount)
              : undefined
          }
        />
      ))}
    </md-navigation-rail>
  );
}

/**
 * The rail's primary action. Split out only so its ref does not fight the
 * rail's own.
 *
 * IT ROUTES TO THE PROPOSALS SCREEN, and that is a placeholder. Raising a
 * proposal is a five-step flow, which means `md-stepper` inside ONE
 * `md-dialog` — and that dialog belongs to the proposals screen, which owns the
 * steps and the form. When it exists, this should open it rather than navigate.
 * The label already names the real action, because the FAB IS the app's primary
 * action; only the wiring is temporary.
 *
 * `mdClick` is dispatched cancelable but `md-fab` never reads
 * `defaultPrevented` — there is no veto hook on this component — so this
 * listens and acts rather than pretending to intercept.
 */
function Fab() {
  const t = useT();
  const router = useRouter();
  const ref = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent>(ref, 'mdClick', () => router.push(route.proposals()));

  return <md-fab ref={ref} slot="fab" icon="add" label={t('wealth.action.newProposal')} />;
}

/* -------------------------------------------------------------------- bar */

/**
 * The same five destinations, docked at the bottom, below 900px.
 *
 * FIVE IS THE CEILING. `md-navigation-bar` is specified for 3–5 and its manual
 * says so twice; the kit's `DESTINATIONS` is sized for that, which is why the
 * household drill is not a destination.
 *
 * The click is vetoed in the CAPTURE phase, and that is not a style choice:
 * `md-navigation-tab` reads `event.defaultPrevented` before it acts, and with
 * `href` set it navigates by `window.location.assign()` — a full page load of a
 * single-page application. A bubbling listener would run after that has already
 * been decided. The manual names this exact hook for SPA routing.
 *
 * There is no ⌘-click concession here as there is on the rail: the bar tab is
 * not an anchor at all (`href` does not render one), so the browser has nothing
 * to open in a new tab either way.
 */
function Bar() {
  const t = useT();
  const router = useRouter();
  const totals = getBookTotals();
  const ref = useRef<HTMLElement | null>(null);
  const activeIndex = destinationIndex(router.pathname);

  useDomEvent(
    ref,
    'click',
    (event) => {
      const tab = event
        .composedPath()
        .find(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && node.tagName === 'MD-NAVIGATION-TAB',
        );
      const value = tab?.dataset.value;
      const destination = DESTINATIONS.find((d) => d.value === value);
      if (!destination) return;
      event.preventDefault();
      router.push(destination.path);
    },
    true,
  );

  return (
    <md-navigation-bar
      ref={ref}
      class="shell__bar"
      aria-label={t('wealth.nav.label')}
      active-index={activeIndex}
      label-behavior="always"
    >
      {DESTINATIONS.map((destination) => (
        <md-navigation-tab
          key={destination.value}
          // `value` is not a prop on this component (the rail tab has one, this
          // one reports an index), so the routing key rides on a data attribute
          // — which `dataset` reads back without any coupling to the component.
          data-value={destination.value}
          icon={destination.icon}
          active-icon={destination.activeIcon}
          label={t(destination.labelKey)}
          href={withBase(destination.path)}
          badge-value={
            destination.value === 'proposals' && totals.openProposalCount > 0
              ? String(totals.openProposalCount)
              : undefined
          }
        />
      ))}
    </md-navigation-bar>
  );
}

/* ------------------------------------------------------------ breadcrumbs */

/**
 * The trail, with `mdSelect` intercepted for client-side routing.
 *
 * `mdSelect` is cancelable and bubbles from the item to the strip, so one
 * listener on the strip is enough, and `preventDefault()` stops the anchor from
 * doing a full page load. The crumbs still carry real, fully-prefixed hrefs,
 * because a real href is what makes ⌘-click, middle-click and "copy link
 * address" behave. `originalEvent` is the MouseEvent or KeyboardEvent that
 * produced the selection, so one modifier check covers the Enter path too.
 */
function Breadcrumbs({ crumbs }: { crumbs: CrumbSpec[] }) {
  const t = useT();
  const router = useRouter();
  const ref = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<{ href: string; originalEvent?: MouseEvent | KeyboardEvent }>>(
    ref,
    'mdSelect',
    (event) => {
      const { href, originalEvent } = event.detail ?? {};
      if (!href) return;
      if (!isPlainActivation(originalEvent as MouseEvent | undefined)) return;
      event.preventDefault();
      router.push(href.replace(withBase(''), '') || '/');
    },
  );

  return (
    <md-breadcrumbs
      ref={ref}
      label={t('wealth.nav.breadcrumb')}
      max-items="4"
      items-before-collapse="1"
      items-after-collapse="2"
    >
      {crumbs.map((crumb, index) => (
        <md-breadcrumb-item
          key={`${crumb.labelKey ?? crumb.label}-${index}`}
          // The last crumb is the page you are already on, so it is never a
          // link — md-breadcrumbs promotes it to `current` and gives it
          // `aria-current="page"` itself. `crumbsFor` already returns a null
          // href for every deep trail's tail; the overview's single crumb is
          // the one case that would otherwise link to itself.
          href={crumb.href && index < crumbs.length - 1 ? withBase(crumb.href) : undefined}
        >
          {/* A crumb is either a translated label or a proper noun. The kit
              returns exactly one of the two and never a pre-translated string. */}
          {crumb.labelKey ? t(crumb.labelKey) : crumb.label}
        </md-breadcrumb-item>
      ))}
    </md-breadcrumbs>
  );
}

/* ------------------------------------------------------------------ screen */

/**
 * Screens already visited in this session. Module scope, so it outlives every
 * component and every navigation.
 */
const seen = new Set<string>();

/**
 * False for a beat the FIRST time a screen is opened, true immediately after.
 *
 * WHY NOT ON EVERY NAVIGATION, which is what this did at first. These screens
 * read synchronous selectors out of the kit — there is no fetch, and the real
 * render cost is a few milliseconds. A placeholder on every click therefore
 * does not cover a wait, it MANUFACTURES one: measured at 603ms from click to
 * content, of which 550ms was this timer. That is the difference between an
 * application and a website, and it was the wrong trade — an SPA's whole
 * proposition is that the second visit is instant.
 *
 * So the skeleton shows once per screen, where it is honest about a first
 * paint, and never again. Going back to a screen you have already opened is
 * immediate.
 *
 * Keyed on the PATHNAME, not on mount: two visits to the same screen TYPE — one
 * household then another — reuse the component instance, so a mount-only effect
 * would never re-run for the second.
 */
/**
 * `?skeleton=` — an inspection handle on a state that is otherwise 550ms long.
 *
 * The placeholders are the one part of this app you cannot sit and look at:
 * they show once per screen, for half a second, and then the thing they are
 * standing in for replaces them. That makes them almost impossible to critique,
 * and getting them WRONG is expensive — a placeholder whose blocks are the
 * wrong height moves the whole page when the data lands.
 *
 *   ?skeleton=hold   the placeholder stays up and never resolves
 *   ?skeleton=4000   the placeholder lasts 4000ms instead of 550
 *
 * Either form also defeats the once-per-screen rule, so the placeholder shows
 * again every time you navigate rather than only on a first visit.
 *
 * Read once, at module scope: it is a URL flag for looking at the app, not
 * state, and re-reading it per render would invite someone to treat it as
 * something that can change.
 */
const SKELETON_FLAG = (() => {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search).get('skeleton');
  if (raw === null) return null;
  if (raw === 'hold' || raw === '') return { hold: true, ms: 0 };
  const ms = Number.parseInt(raw, 10);
  return Number.isFinite(ms) && ms > 0 ? { hold: false, ms } : { hold: true, ms: 0 };
})();

function useScreenReady(): boolean {
  const pathname = usePathname();
  const [ready, setReady] = useState(() => (SKELETON_FLAG ? false : seen.has(pathname)));

  useEffect(() => {
    // Held open on purpose — nothing to schedule, and nothing is ever marked
    // seen, so every navigation shows the placeholder again.
    if (SKELETON_FLAG?.hold) {
      setReady(false);
      return;
    }
    if (!SKELETON_FLAG && seen.has(pathname)) {
      setReady(true);
      return;
    }
    setReady(false);
    const id = setTimeout(() => {
      seen.add(pathname);
      setReady(true);
    }, SKELETON_FLAG?.ms ?? SKELETON_MS);
    // Cleared on the way out, so a fast click-through does not leave a pending
    // timeout that flips a screen the reader has already left.
    return () => clearTimeout(id);
  }, [pathname]);

  return ready;
}

export interface ScreenProps {
  title: string;
  subtitle?: string;
  /**
   * The placeholder shown while the screen settles after a navigation.
   *
   * Omit it and the screen gets `<ScreenSkeleton>`, which is a KPI row and two
   * panels — what five of the six screens open with. Pass one when the opening
   * is materially different, so the swap does not move the page.
   */
  skeleton?: ReactNode;
  /** From the kit's `crumbsFor()`. A trail of one is shown — see below. */
  crumbs?: CrumbSpec[];
  /** Chips, dots or counts that belong beside the heading. */
  aside?: ReactNode;
  /**
   * Screen-level actions, rendered inside an `md-toolbar`.
   *
   * A toolbar is ONE tab stop with arrow-key movement between the controls, so
   * put related actions here rather than scattering loose buttons across the
   * heading. `md-icon-button` and `md-button` join the roving group; a
   * `md-text-field` or `md-select` keeps its own tab stop. Emphasise at most
   * one of them — the FAB in the rail is already the screen's loudest control.
   */
  actions?: ReactNode;
  children: ReactNode;
}

export function Screen({
  title,
  subtitle,
  crumbs,
  aside,
  actions,
  skeleton,
  children,
}: ScreenProps) {
  const t = useT();
  const ready = useScreenReady();

  return (
    <>
      {/* The trail row is ALWAYS rendered, even when empty.
          A row that comes and goes moves the heading and every panel under it
          on each navigation, which is what "jumpy" means; its height is
          reserved in `.shell__trail`.

          A trail of ONE is now shown rather than dropped. The old rule was that
          the heading beneath already says it — true, but it left the overview
          as the only screen with a reserved band and nothing in it, and a
          consistently-placed trail is worth more than avoiding one repetition
          of a word. The single crumb is link-less, so it reads as the current
          page rather than as somewhere else to go. */}
      <div className="shell__trail">
        {crumbs && crumbs.length > 0 ? <Breadcrumbs crumbs={crumbs} /> : null}
      </div>

      <div className="screen-head">
        <div className="screen-head__text">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {aside ? <div className="screen-head__aside">{aside}</div> : null}
      </div>

      {actions ? (
        <div className="screen-toolbar">
          {/* `floating`, not `docked`: a docked toolbar is `position: sticky`
              against the BOTTOM edge, where the navigation bar and the dock
              already are. A floating one is an inline pill.

              `vibrant` puts the pill on primary-container instead of
              surface-container and applies the MD3 expressive toolbar-only
              token map to the icon buttons inside it — which is scoped to
              slotted children, so it does not touch icon buttons elsewhere on
              the screen. This is the app's ONLY `md-toolbar`; every screen's
              actions pass through here, so one attribute is every toolbar. */}
          <md-toolbar variant="floating" color="vibrant" aria-label={t('wealth.nav.toolbar')}>
            {actions}
          </md-toolbar>
        </div>
      ) : null}

      {/*
        Only the body is ever a placeholder — the frame above never is.

        THE LAYOUT IS ALWAYS THE REAL CONTENT'S. THE PLACEHOLDER IS PAINTED OVER
        IT.

        Two problems had to die here, and the second one killed three attempts.

        FIRST: `md-*` components hydrate from lazily-loaded chunks, so a subtree
        mounted at the moment a placeholder is removed is revealed still
        un-upgraded and contributing no size — `md-tab-panels` measured 0 for two
        frames and everything below the tab bar rode 906px up the page. That is
        why the children go into the tree from the FIRST render and their chunks
        load during the placeholder's window.

        SECOND: a placeholder that occupies the layout has to be the same height
        as what replaces it, and it cannot be. The real heights are not
        constants — measured on holdings, `.grid-3` is 268 at 1600 and 464 at
        1024, the concentration panel 498 at 1600 and 1384 at 720, and the KPI
        grid's SECOND ROW is shorter than its first because those two tiles hold
        less, which no placeholder can know. Hard-coded heights matched at the
        one width they were measured at and drifted up to 1102px elsewhere.

        So the placeholder stops occupying layout at all. The real content keeps
        its box the whole time and is merely `visibility: hidden`; the
        placeholder is absolutely positioned over it. Revealing is then a
        visibility flip with no reflow — exactly 0px of movement at every width,
        density and locale, by construction rather than by arithmetic.

        `visibility` and not `display`, deliberately: `display: none` would take
        the box away and put the problem straight back, and it also takes the
        content out of the accessibility tree — which is what we want here, since
        the placeholder is the thing announcing.

        Rendered ONCE, never as a second copy: element ids in this app are
        literals (`md-menu` resolves `anchor` with `getElementById`), so two
        mounted copies would give two `#wealth-holdings-export` triggers and the
        menus would anchor to whichever came first.
      */}
      <div className="screen-stage">
        <div className="screen-body" data-placeholder={ready ? undefined : ''}>
          {children}
        </div>
        {ready ? null : (
          <div className="screen-stage__placeholder">
            {skeleton ?? <ScreenSkeleton label={title} />}
          </div>
        )}
      </div>
    </>
  );
}


/**
 * The chrome that OUTLIVES navigation.
 *
 * `App` returns a different component per route, so everything it renders is
 * unmounted and rebuilt on every click. When the app bar and the rail lived
 * inside `<Screen>`, that meant a BRAND NEW `md-navigation-rail` on each
 * navigation — and a new element has nothing to animate FROM, so the active
 * indicator jumped to its destination instead of sliding, and the rail's
 * expand/collapse width transition never ran either. It was also why the rail
 * silently collapsed on each click until its state was hoisted into
 * `ShellProvider`; that fixed the symptom, this fixes the cause.
 *
 * Rendered ONCE, above the router, with the routed screen dropped into `main`.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="shell">
        <AppBar />

        <div className="shell__body">
          <Rail />

          <main className="shell__main">{children}</main>
        </div>

        <Bar />
      </div>
      <Dock />
    </>
  );
}

/* -------------------------------------------------------------- the bits */

/** A titled surface. Everything on every screen lives in one of these. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  variant = 'outlined',
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined';
}) {
  /*
   * `class`, NOT `className`.
   *
   * React 18 maps `className` to the `class` attribute for HOST elements only.
   * On a custom element it passes the prop through under the name it was given,
   * so `className="panel"` emits a literal `className="panel"` attribute and
   * the `.panel` rule never matches. Every `md-*` element in this app that
   * needs a class uses `class`.
   */
  return (
    <md-card variant={variant} class="panel" full-width>
      <div className="panel__inner">
        {title ? (
          <div className="panel__head">
            {/*
              Title and subtitle are ONE heading and share a row, so the pair
              needs a box of its own to sit in — an unclassed `div` here is a
              block container, which stacks them and reads as two headings.
              `.panel__heading` in `app.css` lays the two out side by side and
              drops the subtitle beneath the title only when the card is too
              narrow to hold both.
            */}
            <div className="panel__heading">
              <h2 className="panel__title">{title}</h2>
              {subtitle ? <p className="panel__sub">{subtitle}</p> : null}
            </div>
            {actions ?? null}
          </div>
        ) : null}
        {children}
      </div>
    </md-card>
  );
}

/**
 * The shared empty state.
 *
 * `hint` defaults to false because most empty states here are facts, not filter
 * results: "every mandate is within its bands" is the whole story, and telling
 * the reader to widen the filters underneath it would be nonsense. Pass `hint`
 * only where a filter or a search actually produced the emptiness.
 */
export function EmptyState({ message, hint = false }: { message: string; hint?: boolean }) {
  const t = useT();
  return (
    <div className="empty">
      <p>{message}</p>
      {hint ? <p>{t('wealth.empty.hint')}</p> : null}
    </div>
  );
}
