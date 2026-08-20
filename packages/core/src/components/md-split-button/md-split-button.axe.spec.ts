/**
 * Axe (WCAG 2.1 A/AA) sweep + ARIA-contract checks for md-split-button.
 *
 * The split button is two adjacent buttons — a leading action and an icon-only
 * trailing menu toggle — so its accessible names, menu semantics
 * (`aria-haspopup` / `aria-expanded` / `aria-controls`) and disabled handling
 * are what assistive tech relies on. The slider's axe spec once caught a real
 * invalid-ARIA bug, so this sweep guards the same class of regression here.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdSplitButton } from './md-split-button';
import { MdRipple } from '../md-ripple/md-ripple';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [MdSplitButton, MdRipple];
const wrap = (inner: string) => `<body><h1>Page</h1><main>${inner}</main></body>`;

describe('md-split-button · axe', () => {
  it('filled, label only — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-split-button label="Save"></md-split-button>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('outlined, icon + label — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-split-button variant="outlined" icon="add" label="Create"></md-split-button>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('disabled — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-split-button label="Save" disabled></md-split-button>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('trailing-checked (menu open) — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-split-button label="Save" trailing-checked controls="sb-menu"></md-split-button>
             <ul id="sb-menu" role="menu"><li role="menuitem">A</li></ul>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('full-width, localized labels — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-split-button full-width label="Speichern" menu-label="Menü umschalten"></md-split-button>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('icon-only leading via aria-label — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-split-button icon="edit" aria-label="Edit"></md-split-button>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});

describe('md-split-button · ARIA contract', () => {
  async function build(html: string) {
    const page = await newSpecPage({ components: COMPONENTS, html });
    const root = page.root!;
    return {
      leading: root.shadowRoot!.querySelector('.md-split-button__leading')!,
      trailing: root.shadowRoot!.querySelector('.md-split-button__trailing')!,
      root,
    };
  }

  it('trailing button advertises the menu popup by default', async () => {
    const { trailing } = await build(`<md-split-button label="Save"></md-split-button>`);
    expect(trailing.getAttribute('aria-haspopup')).toBe('menu');
    expect(trailing.getAttribute('aria-expanded')).toBe('false');
  });

  it('trailing aria-expanded tracks the checked state', async () => {
    const { trailing } = await build(`<md-split-button label="Save" trailing-checked></md-split-button>`);
    expect(trailing.getAttribute('aria-expanded')).toBe('true');
  });

  it('menu-label localizes the trailing accessible name', async () => {
    const { trailing } = await build(`<md-split-button label="Save" menu-label="Menü umschalten"></md-split-button>`);
    expect(trailing.getAttribute('aria-label')).toBe('Menü umschalten');
  });

  it('controls wires aria-controls to the popup', async () => {
    const { trailing } = await build(`<md-split-button label="Save" controls="my-menu"></md-split-button>`);
    expect(trailing.getAttribute('aria-controls')).toBe('my-menu');
  });

  it('haspopup="false" removes aria-haspopup (toggle, not a popup)', async () => {
    const { trailing } = await build(`<md-split-button label="Save" haspopup="false"></md-split-button>`);
    expect(trailing.hasAttribute('aria-haspopup')).toBe(false);
  });

  it('haspopup accepts other ARIA popup roles', async () => {
    const { trailing } = await build(`<md-split-button label="Save" haspopup="listbox"></md-split-button>`);
    expect(trailing.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('leading button takes its name from the label', async () => {
    const { leading } = await build(`<md-split-button label="Save"></md-split-button>`);
    expect(leading.textContent).toContain('Save');
    expect(leading.hasAttribute('aria-label')).toBe(false);
  });

  it('leading button falls back to the host aria-label when icon-only', async () => {
    const { leading } = await build(`<md-split-button icon="edit" aria-label="Edit"></md-split-button>`);
    expect(leading.getAttribute('aria-label')).toBe('Edit');
  });

  it('disabled marks both segments unfocusable', async () => {
    const { leading, trailing } = await build(`<md-split-button label="Save" disabled></md-split-button>`);
    expect(leading.getAttribute('tabindex')).toBe('-1');
    expect(trailing.getAttribute('tabindex')).toBe('-1');
    expect(leading.hasAttribute('disabled')).toBe(true);
    expect(trailing.hasAttribute('disabled')).toBe(true);
  });

  it('soft-disabled keeps both segments focusable for screen readers', async () => {
    const { leading, trailing } = await build(`<md-split-button label="Save" soft-disabled></md-split-button>`);
    expect(leading.getAttribute('tabindex')).toBe('0');
    expect(trailing.getAttribute('tabindex')).toBe('0');
    expect(leading.getAttribute('aria-disabled')).toBe('true');
    expect(trailing.getAttribute('aria-disabled')).toBe('true');
  });
});
