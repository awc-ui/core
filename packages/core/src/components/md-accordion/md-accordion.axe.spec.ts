/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-accordion`.
 *
 * These tests render the parent component in many real-world
 * configurations, serialize the Declarative Shadow DOM into a JSDOM,
 * and run axe-core inside that realm. axe sees the full accessible
 * tree (all child items, their shadow content, ARIA wiring) and flags
 * any violation across ~80 rules.
 *
 * Layout-only rules are disabled in the bridge — they belong in e2e.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdAccordion } from './md-accordion';
import { MdAccordionItem } from '../md-accordion-item/md-accordion-item';
import { runAxe, toHaveNoViolations } from './test-utils/axe-spec';

expect.extend(toHaveNoViolations);

describe('md-accordion · axe', () => {
  function wrap(inner: string): string {
    return `<body><h1>Test</h1><h2>Settings</h2>${inner}</body>`;
  }

  const threeItems = `
    <md-accordion>
      <md-accordion-item headline="Account">Account body</md-accordion-item>
      <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
      <md-accordion-item headline="Notifications">Notifications body</md-accordion-item>
    </md-accordion>
  `;

  it('default (filled, three items, none expanded) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: threeItems,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('outlined variant has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion variant="outlined">
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('one item expanded by default has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion default-expanded="0">
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('multiple items expanded has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion default-expanded="0,2">
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
          <md-accordion-item headline="Notifications">Notifications body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('exclusive mode (radio-like) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion exclusive default-expanded="1">
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
          <md-accordion-item headline="Notifications">Notifications body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('keep-one-expanded (APG locked-open variant) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion keep-one-expanded default-expanded="0">
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('reorderable mode has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion reorderable>
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('floating mode (free-drag chassis) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion floating initial-x="24" initial-y="24">
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('many items (region auto-downgrade to group) has no violations', async () => {
    const items = Array.from({ length: 8 }, (_, i) => `<md-accordion-item headline="Item ${i + 1}">Body ${i + 1}</md-accordion-item>`).join('');
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `<md-accordion>${items}</md-accordion>`,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('region="always" with many items has no violations', async () => {
    const items = Array.from({ length: 8 }, (_, i) => `<md-accordion-item headline="Item ${i + 1}" expanded>Body ${i + 1}</md-accordion-item>`).join('');
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `<md-accordion region="always">${items}</md-accordion>`,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it('mixed enabled/disabled items has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion>
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy" disabled>Privacy body</md-accordion-item>
          <md-accordion-item headline="Notifications" expanded>Notifications body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, { wrap });
    expect(results).toHaveNoViolations();
  });

  it.each([1, 2, 3, 4, 5, 6] as const)(
    'heading-level=%i propagates without violations',
    async (level) => {
      const page = await newSpecPage({
        components: [MdAccordion, MdAccordionItem],
        html: `
          <md-accordion heading-level="${level}">
            <md-accordion-item headline="Account">Account body</md-accordion-item>
            <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
          </md-accordion>
        `,
      });
      const scaffold = Array.from(
        { length: Math.max(0, level - 1) },
        (_, i) => `<h${i + 1}>Lvl ${i + 1}</h${i + 1}>`,
      ).join('');
      const results = await runAxe(page, {
        wrap: (inner) => `<body>${scaffold}${inner}</body>`,
      });
      expect(results).toHaveNoViolations();
    },
  );

  it.each(['expressive', 'standard', 'fade', 'collapse', 'none'] as const)(
    'transition="%s" has no violations',
    async (transition) => {
      const page = await newSpecPage({
        components: [MdAccordion, MdAccordionItem],
        html: `
          <md-accordion transition="${transition}" default-expanded="0">
            <md-accordion-item headline="Account">Account body</md-accordion-item>
            <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
          </md-accordion>
        `,
      });
      const results = await runAxe(page, { wrap });
      expect(results).toHaveNoViolations();
    },
  );

  it('dir="rtl" wrapper has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: threeItems,
    });
    const results = await runAxe(page, {
      wrap: (inner) => `<body dir="rtl"><h1>Test</h1><h2>Settings</h2>${inner}</body>`,
    });
    expect(results).toHaveNoViolations();
  });

  it('floating + RTL has no violations', async () => {
    const page = await newSpecPage({
      components: [MdAccordion, MdAccordionItem],
      html: `
        <md-accordion floating>
          <md-accordion-item headline="Account">Account body</md-accordion-item>
          <md-accordion-item headline="Privacy">Privacy body</md-accordion-item>
        </md-accordion>
      `,
    });
    const results = await runAxe(page, {
      wrap: (inner) => `<body dir="rtl"><h1>Test</h1><h2>Settings</h2>${inner}</body>`,
    });
    expect(results).toHaveNoViolations();
  });
});
