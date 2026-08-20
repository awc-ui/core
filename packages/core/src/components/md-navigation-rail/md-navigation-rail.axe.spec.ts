/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-navigation-rail`.
 *
 * Renders the rail + its destinations in many real-world configurations,
 * serializes the Declarative Shadow DOM into a JSDOM, and runs axe-core
 * inside that realm. axe sees the full accessible tree (the navigation
 * landmark, the `tablist`, every `tab`/`link` child, badges, the toggle
 * button) and flags any violation across ~80 rules.
 *
 * Layout-only rules (color-contrast, target-size) are disabled in the
 * bridge — they belong in e2e against a real browser.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdNavigationRail } from './md-navigation-rail';
import { MdNavigationRailTab } from '../md-navigation-rail-tab/md-navigation-rail-tab';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

describe('md-navigation-rail · axe', () => {
  // A page scaffold with a heading so heading-order has an anchor; the rail
  // itself is the page's `navigation` landmark.
  function wrap(inner: string): string {
    return `<body><h1>App</h1><main>${inner}</main></body>`;
  }

  const threeTabs = `
    <md-navigation-rail label="Primary">
      <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
      <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
      <md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab>
    </md-navigation-rail>
  `;

  it('default (standard, three destinations) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: threeTabs,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('expanded variant has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: `
        <md-navigation-rail label="Primary" variant="expanded">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('an active destination has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: `
        <md-navigation-rail label="Primary" active-index="1">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it.each(['all', 'selected', 'none'] as const)(
    'label-visibility="%s" has no violations (labels remain in the a11y tree)',
    async (visibility) => {
      const page = await newSpecPage({
        components: [MdNavigationRail, MdNavigationRailTab],
        html: `
          <md-navigation-rail label="Primary" label-visibility="${visibility}" active-index="0">
            <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
          </md-navigation-rail>
        `,
      });
      expect(await runAxe(page, { wrap })).toHaveNoViolations();
    },
  );

  it.each(['top', 'middle', 'bottom'] as const)(
    'alignment="%s" has no violations',
    async (alignment) => {
      const page = await newSpecPage({
        components: [MdNavigationRail, MdNavigationRailTab],
        html: `
          <md-navigation-rail label="Primary" alignment="${alignment}">
            <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
            <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
          </md-navigation-rail>
        `,
      });
      expect(await runAxe(page, { wrap })).toHaveNoViolations();
    },
  );

  it('destinations with badges (dot + value) have no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: `
        <md-navigation-rail label="Primary">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="mail" label="Mail" badge></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="notifications" label="Alerts" badge-value="12"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('a mix of enabled and disabled destinations has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: `
        <md-navigation-rail label="Primary" active-index="0">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search" disabled></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('link-mode destinations (href + aria-current) have no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: `
        <md-navigation-rail label="Primary" active-index="0">
          <md-navigation-rail-tab icon="home" label="Home" href="/home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search" href="/search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('expandable rail (built-in toggle button) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab, MdIconButton],
      html: `
        <md-navigation-rail label="Primary" expandable toggle-label="Toggle navigation">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('expandable + expanded rail has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab, MdIconButton],
      html: `
        <md-navigation-rail label="Primary" expandable variant="expanded" toggle-label="Toggle navigation">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('rail with header / footer slotted content has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: `
        <md-navigation-rail label="Primary">
          <button slot="header" aria-label="Open menu">menu</button>
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
          <button slot="footer" aria-label="Account settings">account</button>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('modal expanded overlay has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab, MdIconButton],
      html: `
        <md-navigation-rail label="Primary" modal variant="expanded" expandable toggle-label="Toggle navigation">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('dir="rtl" wrapper has no violations', async () => {
    const page = await newSpecPage({
      components: [MdNavigationRail, MdNavigationRailTab],
      html: threeTabs,
    });
    expect(
      await runAxe(page, {
        wrap: (inner) => `<body dir="rtl"><h1>App</h1><main>${inner}</main></body>`,
      }),
    ).toHaveNoViolations();
  });
});
