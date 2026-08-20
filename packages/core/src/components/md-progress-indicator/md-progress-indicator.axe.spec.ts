/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-progress-indicator`.
 *
 * Renders the indicator across linear/circular × determinate/indeterminate ×
 * wavy/four-color configurations, hydrates the Declarative Shadow DOM into a
 * JSDOM, and runs axe-core inside that realm. Layout-only rules are disabled
 * in the shared bridge.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdProgressIndicator } from './md-progress-indicator';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

describe('md-progress-indicator · axe', () => {
  function wrap(inner: string): string {
    return `<body><h1>Status</h1><main>${inner}</main></body>`;
  }

  // ── Core matrix ────────────────────────────────────────────────────────────
  const cases: Array<[string, string]> = [
    // Linear variants
    ['linear determinate', '<md-progress-indicator value="60" label="Loading"></md-progress-indicator>'],
    ['linear determinate at 0%', '<md-progress-indicator value="0" label="Loading"></md-progress-indicator>'],
    ['linear determinate at 100%', '<md-progress-indicator value="100" label="Loading"></md-progress-indicator>'],
    ['linear indeterminate', '<md-progress-indicator indeterminate label="Loading"></md-progress-indicator>'],
    ['linear wavy determinate', '<md-progress-indicator wave value="60" label="Loading"></md-progress-indicator>'],
    ['linear wavy indeterminate', '<md-progress-indicator wave indeterminate label="Loading"></md-progress-indicator>'],
    ['custom max', '<md-progress-indicator value="3" max="10" label="Step 3 of 10"></md-progress-indicator>'],

    // Linear thickness variants
    ['linear thickness=2', '<md-progress-indicator value="60" thickness="2" label="Loading"></md-progress-indicator>'],
    ['linear thickness=8', '<md-progress-indicator value="60" thickness="8" label="Loading"></md-progress-indicator>'],

    // Circular flat variants
    ['circular determinate at 0%', '<md-progress-indicator variant="circular" value="0" label="Loading"></md-progress-indicator>'],
    ['circular determinate at 50%', '<md-progress-indicator variant="circular" value="50" label="Loading"></md-progress-indicator>'],
    ['circular determinate at 90%', '<md-progress-indicator variant="circular" value="90" label="Loading"></md-progress-indicator>'],
    ['circular determinate at 100%', '<md-progress-indicator variant="circular" value="100" label="Loading"></md-progress-indicator>'],
    ['circular indeterminate', '<md-progress-indicator variant="circular" indeterminate label="Loading"></md-progress-indicator>'],
    ['circular four-color', '<md-progress-indicator variant="circular" indeterminate four-color label="Loading"></md-progress-indicator>'],

    // Circular wavy variants
    ['circular wavy determinate', '<md-progress-indicator variant="circular" wave value="60" label="Loading"></md-progress-indicator>'],
    ['circular wavy indeterminate', '<md-progress-indicator variant="circular" wave indeterminate label="Loading"></md-progress-indicator>'],

    // Circular size variants
    ['circular small (24dp)', '<md-progress-indicator variant="circular" size="24" thickness="2" value="60" label="Loading"></md-progress-indicator>'],
    ['circular large (120dp)', '<md-progress-indicator variant="circular" size="120" thickness="10" value="60" label="Loading"></md-progress-indicator>'],

    // Edge: default label ("Progress")
    ['default label', '<md-progress-indicator value="50"></md-progress-indicator>'],
    ['circular default label', '<md-progress-indicator variant="circular" value="50"></md-progress-indicator>'],
  ];

  it.each(cases)('%s has no violations', async (_name, html) => {
    const page = await newSpecPage({ components: [MdProgressIndicator], html });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  // ── Context & layout variants ──────────────────────────────────────────────
  it('inside an aria-busy container has no violations', async () => {
    const page = await newSpecPage({
      components: [MdProgressIndicator],
      html: '<md-progress-indicator indeterminate label="Loading content"></md-progress-indicator>',
    });
    expect(
      await runAxe(page, {
        wrap: (inner) => `<body><h1>Status</h1><section aria-busy="true">${inner}</section></body>`,
      }),
    ).toHaveNoViolations();
  });

  it('dir="rtl" has no violations', async () => {
    const page = await newSpecPage({
      components: [MdProgressIndicator],
      html: '<md-progress-indicator wave value="60" label="Loading"></md-progress-indicator>',
    });
    expect(
      await runAxe(page, {
        wrap: (inner) => `<body dir="rtl"><h1>Status</h1><main>${inner}</main></body>`,
      }),
    ).toHaveNoViolations();
  });

  it('multiple indicators on the same page have no violations', async () => {
    const page = await newSpecPage({
      components: [MdProgressIndicator],
      html: `
        <md-progress-indicator value="30" label="Download progress"></md-progress-indicator>
        <md-progress-indicator variant="circular" indeterminate label="Loading"></md-progress-indicator>
        <md-progress-indicator wave value="70" label="Upload progress"></md-progress-indicator>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('circular wavy dir="rtl" has no violations', async () => {
    const page = await newSpecPage({
      components: [MdProgressIndicator],
      html: '<md-progress-indicator variant="circular" wave value="60" label="Loading"></md-progress-indicator>',
    });
    expect(
      await runAxe(page, {
        wrap: (inner) => `<body dir="rtl"><h1>Status</h1><main>${inner}</main></body>`,
      }),
    ).toHaveNoViolations();
  });

  it('circular flat in terminal track state has no violations', async () => {
    const page = await newSpecPage({
      components: [MdProgressIndicator],
      html: '<md-progress-indicator variant="circular" value="60" label="Complete"></md-progress-indicator>',
    });
    // Simulate the terminal track-ring state (active erased, track visible)
    const i = page.rootInstance as unknown as { _completedTrack: boolean };
    i._completedTrack = true;
    await page.waitForChanges();
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('inside a dialog has no violations', async () => {
    const page = await newSpecPage({
      components: [MdProgressIndicator],
      html: '<md-progress-indicator indeterminate label="Saving…"></md-progress-indicator>',
    });
    expect(
      await runAxe(page, {
        wrap: (inner) =>
          `<body><h1>App</h1><main><dialog open aria-label="Saving"><p>Please wait…</p>${inner}</dialog></main></body>`,
      }),
    ).toHaveNoViolations();
  });

  it('labeled with aria-labelledby has no violations', async () => {
    const page = await newSpecPage({
      components: [MdProgressIndicator],
      html: '<p id="lbl">Uploading file</p><md-progress-indicator value="45" label="Uploading file"></md-progress-indicator>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});
