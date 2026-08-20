/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-segmented-button` /
 * `md-segmented-button-set`.
 *
 * Both components are registered so their shadow DOM — including `role`,
 * `aria-checked`, and `aria-disabled` — is serialised into the DSD string
 * that axe sees, avoiding false `aria-prohibited-attr` failures.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdSegmentedButton } from './md-segmented-button';
import { MdSegmentedButtonSet } from '../md-segmented-button-set/md-segmented-button-set';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [MdSegmentedButton, MdSegmentedButtonSet];

describe('md-segmented-button · axe', () => {
  function wrap(inner: string): string {
    return `<body><h1>Demo</h1>${inner}</body>`;
  }

  it('single-select with labels has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="View period">
          <md-segmented-button value="day" label="Day" selected></md-segmented-button>
          <md-segmented-button value="week" label="Week"></md-segmented-button>
          <md-segmented-button value="month" label="Month"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('multi-select with labels has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set multiselect aria-label="Text formatting">
          <md-segmented-button value="bold" label="Bold" selected></md-segmented-button>
          <md-segmented-button value="italic" label="Italic"></md-segmented-button>
          <md-segmented-button value="underline" label="Underline" selected></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('single-select with icons and labels has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="Transport mode">
          <md-segmented-button value="car" icon="directions_car" label="Car" selected></md-segmented-button>
          <md-segmented-button value="bus" icon="directions_bus" label="Bus"></md-segmented-button>
          <md-segmented-button value="train" icon="train" label="Train"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('icon-only segments with aria-label have no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="View mode">
          <md-segmented-button value="list" icon="view_list" aria-label="List view" selected></md-segmented-button>
          <md-segmented-button value="grid" icon="grid_view" aria-label="Grid view"></md-segmented-button>
          <md-segmented-button value="map" icon="map" aria-label="Map view"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('segment with disabled has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="Sort order">
          <md-segmented-button value="asc" label="Ascending" selected></md-segmented-button>
          <md-segmented-button value="desc" label="Descending"></md-segmented-button>
          <md-segmented-button value="custom" label="Custom" disabled></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('segment with soft-disabled has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="Export format">
          <md-segmented-button value="pdf" label="PDF" selected></md-segmented-button>
          <md-segmented-button value="csv" label="CSV"></md-segmented-button>
          <md-segmented-button value="xlsx" label="XLSX" soft-disabled></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('two-segment toggle has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="Layout">
          <md-segmented-button value="list" icon="view_list" label="List" selected></md-segmented-button>
          <md-segmented-button value="grid" icon="grid_view" label="Grid"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('five-segment set has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="Rating">
          <md-segmented-button value="1" label="1★" selected></md-segmented-button>
          <md-segmented-button value="2" label="2★"></md-segmented-button>
          <md-segmented-button value="3" label="3★"></md-segmented-button>
          <md-segmented-button value="4" label="4★"></md-segmented-button>
          <md-segmented-button value="5" label="5★"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('density variation has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="View period" density="-2">
          <md-segmented-button value="day" label="Day" selected></md-segmented-button>
          <md-segmented-button value="week" label="Week"></md-segmented-button>
          <md-segmented-button value="month" label="Month"></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('no-checkmark variant has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-segmented-button-set aria-label="Transport mode">
          <md-segmented-button value="car" icon="directions_car" label="Car" selected no-checkmark></md-segmented-button>
          <md-segmented-button value="bus" icon="directions_bus" label="Bus" no-checkmark></md-segmented-button>
          <md-segmented-button value="train" icon="train" label="Train" no-checkmark></md-segmented-button>
        </md-segmented-button-set>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});
