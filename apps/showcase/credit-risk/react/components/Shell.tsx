'use client';

/**
 * The frame every screen sits in: masthead, section nav, breadcrumb trail,
 * screen heading, and the showcase dock.
 *
 * Not a single string is written here — `useT()` resolves all of them, including
 * the ones that look like constants (the brand name, the base-currency note).
 * The reporting date is formatted through the translator's `formatDate`, which
 * is pinned to `timeZone: 'UTC'`, so 2026-03-31 is 31 March in every locale and
 * every CI machine.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, type ReactNode } from 'react';
import { BASE_CURRENCY, REPORTING_DATE, REPORTING_QUARTER } from '@awc-ui/showcase-kit/data';
import { useT } from '@/lib/showcase';
import { route, withBase } from '@/lib/routes';
import { useCustomEvent } from './elements';
import { Dock } from './Dock';

export interface Crumb {
  label: string;
  /** Root-relative path WITHOUT the base path. Omit on the final crumb. */
  href?: string;
}

/** The breadcrumb trail, with `mdSelect` intercepted for client-side routing. */
function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const router = useRouter();
  const t = useT();
  const ref = useRef<HTMLElement | null>(null);

  // mdSelect is cancelable and bubbles from the item to the strip, so one
  // listener on the strip is enough. preventDefault() stops the anchor from
  // doing a full page load; the trail still works with JS off because the
  // anchors carry real hrefs.
  //
  // MODIFIER KEYS PASS THROUGH. Cancelling unconditionally would route a
  // ⌘-click in place instead of opening a new tab — the crumb would look like
  // a link, carry a real href, and then quietly refuse to behave like one.
  // `originalEvent` is the MouseEvent or KeyboardEvent that produced the
  // selection, so one check covers the Enter path too.
  useCustomEvent<CustomEvent<{ href: string; originalEvent?: MouseEvent | KeyboardEvent }>>(
    ref,
    'mdSelect',
    (event) => {
      const { href, originalEvent } = event.detail ?? {};
      if (!href) return;
      if (originalEvent?.metaKey || originalEvent?.ctrlKey || originalEvent?.shiftKey) return;
      event.preventDefault();
      router.push(href.replace(withBase(''), '') || '/');
    },
  );

  return (
    <md-breadcrumbs
      ref={ref}
      label={t('nav.breadcrumb')}
      max-items="4"
      items-before-collapse="1"
      items-after-collapse="2"
    >
      {crumbs.map((crumb, index) => (
        <md-breadcrumb-item key={`${crumb.label}-${index}`} href={crumb.href ? withBase(crumb.href) : undefined}>
          {crumb.label}
        </md-breadcrumb-item>
      ))}
    </md-breadcrumbs>
  );
}

export interface ScreenProps {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
  /** Chips, dots or counts that belong beside the heading. */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * The section nav.
 *
 * TWO THINGS, both about `href` on a custom element.
 *
 * It is a real anchor, which is why it works with JavaScript off and honours
 * ⌘-click — but left alone it also means every nav click was a FULL PAGE
 * RELOAD in a client-routed app: measured as `performance.navigation.type ===
 * 'navigate'` on each click, tearing down and rebuilding the whole document,
 * re-registering every component. That is what made the top row lurch. The
 * `mdClick` listener below vetoes the navigation and routes in place instead;
 * `preventDefault()` on `mdClick` is what gates it, not on the native click.
 *
 * And the current section is marked `tonal` rather than `text`, so the nav says
 * where you are. Without it three identical buttons give no feedback at all
 * when one of them is the page you are already on.
 */
function SectionNav() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLElement | null>(null);

  useCustomEvent<CustomEvent<{ href: string; originalEvent?: MouseEvent | KeyboardEvent }>>(
    ref,
    'mdClick',
    (event) => {
      const { href, originalEvent } = event.detail ?? {};
      if (!href) return;
      if (originalEvent?.metaKey || originalEvent?.ctrlKey || originalEvent?.shiftKey) return;
      event.preventDefault();
      router.push(href.replace(withBase(''), '') || '/');
    },
  );

  const sections = [
    { path: route.overview(), icon: 'dashboard', label: t('nav.overview') },
    { path: route.watchlist(), icon: 'warning', label: t('nav.watchlist') },
    { path: route.stress(), icon: 'stacked_line_chart', label: t('nav.stress') },
  ];

  // The overview owns `/` and would otherwise match every path.
  const current = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <nav className="shell__nav" ref={ref} aria-label={t('nav.label')}>
      {sections.map((section) => {
        const active = current(section.path);
        return (
          <md-button
            key={section.path}
            variant={active ? 'tonal' : 'text'}
            size="sm"
            icon={section.icon}
            href={withBase(section.path)}
            aria-current={active ? 'page' : undefined}
          >
            {section.label}
          </md-button>
        );
      })}
    </nav>
  );
}

export function Screen({ title, subtitle, crumbs, aside, children }: ScreenProps) {
  const t = useT();

  return (
    <>
      <div className="shell">
        {/* Identity, sections and reporting context share one bar. The nav is
            INSIDE the masthead rather than on its own row beneath it — it is
            still a real <nav> with its own accessible name, so nothing is lost
            to assistive tech by the two being visually joined. */}
        <header className="shell__masthead">
          <p className="shell__brand">{t('app.brand')}</p>
          <span className="muted">{t('app.title')}</span>

          <SectionNav />

          <div className="shell__meta">
            <span>{t('app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') })}</span>
            <span>{t('app.reportingQuarter', { quarter: REPORTING_QUARTER })}</span>
            <span>{t('app.baseCurrency', { currency: BASE_CURRENCY })}</span>
          </div>
        </header>

        {/* The trail has its own row above the heading.

            It appears on the drill path (sector → counterparty → facility),
            where it is the only thing showing where you are and the only way
            back up. Not on the three section screens: the nav already
            highlights the section, so a trail reading "Overview / Watchlist"
            would only say it twice.

            The ROW is always rendered even when empty, because a row that comes
            and goes is what was moving the heading and every panel under it by
            52px on each navigation. Its height is reserved in
            `.shell__trail`. */}
        <div className="shell__trail">
          {crumbs && crumbs.length > 1 ? <Breadcrumbs crumbs={crumbs} /> : null}
        </div>

        <div className="screen-head">
          <div className="screen-head__text">
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {aside ? <div className="screen-head__aside">{aside}</div> : null}
        </div>

        {children}
      </div>
      <Dock />
    </>
  );
}

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
  return (
    <md-card variant={variant} className="panel" full-width>
      <div className="panel__inner">
        {title ? (
          <div className="panel__head">
            <div>
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
 * `hint` defaults to false because most empty states here are facts, not
 * filter results: "this facility is unsecured" is the whole story, and telling
 * the reader to widen the filters underneath it would be nonsense. Pass
 * `hint` only where a filter or a search actually produced the emptiness.
 */
export function EmptyState({ message, hint = false }: { message: string; hint?: boolean }) {
  const t = useT();
  return (
    <div className="empty">
      <p>{message}</p>
      {hint ? <p>{t('empty.hint')}</p> : null}
    </div>
  );
}

/** A drill link into the next screen down. */
export function Drill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="drill" href={href}>
      {children}
    </Link>
  );
}
