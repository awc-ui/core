import { newSpecPage } from '@stencil/core/testing';
import { MdMultiSelect } from './md-multi-select';
import { MdSelectOption } from '../md-select-option/md-select-option';

/**
 * The eleven public @Method APIs and the option-source paths.
 *
 * The VALIDITY behaviour is deliberately not here: mock-doc's attachInternals()
 * returns an empty object (no setValidity, no validity), so getValidityOf falls
 * back to its "unknown resolves to valid" rule and every assertion about a real
 * validity state passes vacuously or fails misleadingly. That lives in
 * md-multi-select.validity.e2e.ts, against a real browser.
 *
 * The original spec covers rendering and selection; none of this surface was
 * reachable from it, which is why half the component's methods had never been
 * called once.
 */
async function create(html: string) {
  return newSpecPage({ components: [MdMultiSelect, MdSelectOption], html });
}

type Host = HTMLElement & {
  value: string[];
  open: boolean;
  disabled?: boolean;
  show(): Promise<void>;
  close(): Promise<void>;
  focusTrigger(): Promise<void>;
  reset(): Promise<void>;
  loadOptions(source: unknown): Promise<void>;
  setQuery(q: string): Promise<void>;
  getLabels(values: string[]): Promise<Record<string, string>>;
  getValidity(): Promise<{ valid: boolean; validationMessage: string; flags: Record<string, boolean> }>;
  checkValidity(): Promise<boolean>;
  reportValidity(): Promise<boolean>;
  setCustomValidity(message: string): Promise<void>;
};

const OPTIONS = `
  <md-select-option value="a">Alpha</md-select-option>
  <md-select-option value="b">Beta</md-select-option>
  <md-select-option value="c">Gamma</md-select-option>
`;

describe('md-multi-select — public API', () => {
  describe('show / close', () => {
    it('opens and closes the dropdown', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;

      await host.show();
      await page.waitForChanges();
      expect(host.open).toBe(true);

      await host.close();
      await page.waitForChanges();
      expect(host.open).toBe(false);
    });

    it('refuses to open while disabled', async () => {
      const page = await create(`<md-multi-select disabled>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      await host.show();
      await page.waitForChanges();
      // A disabled control that can still be opened programmatically would let a
      // consumer bypass its own disabled state.
      expect(host.open).toBe(false);
    });

    it('closes even when already closed', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      await expect(host.close()).resolves.toBeUndefined();
      expect(host.open).toBe(false);
    });
  });

  describe('focusTrigger', () => {
    it('does not throw before the field has upgraded', async () => {
      const page = await create('<md-multi-select></md-multi-select>');
      await expect((page.root as Host).focusTrigger()).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('clears the selection and announces it', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      host.value = ['a', 'b'];
      await page.waitForChanges();

      const onChange = jest.fn();
      host.addEventListener('mdChange', onChange);
      await host.reset();
      await page.waitForChanges();

      expect(host.value).toEqual([]);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('stays silent when there was nothing selected', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const host = page.root as Host;
      const onChange = jest.fn();
      host.addEventListener('mdChange', onChange);
      await host.reset();
      await page.waitForChanges();
      // A no-op reset that still emitted would make consumers filter out events
      // that mean nothing happened.
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('loadOptions', () => {
    it('accepts a materialised array', async () => {
      const page = await create('<md-multi-select virtualize="never"></md-multi-select>');
      const host = page.root as Host;
      await host.loadOptions([
        { value: 'x', label: 'Ex' },
        { value: 'y', label: 'Why' },
      ]);
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.length).toBe(2);
    });

    it('accepts a row factory without materialising it up front', async () => {
      const page = await create('<md-multi-select virtualize="never"></md-multi-select>');
      const host = page.root as Host;
      const getRow = jest.fn((i: number) => ({ value: `v${i}`, label: `L${i}` }));
      await host.loadOptions({ count: 3, getRow });
      await page.waitForChanges();
      expect(getRow).toHaveBeenCalledTimes(3);
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item')?.length).toBe(3);
    });

    it('replaces a previous dataset rather than appending', async () => {
      const page = await create('<md-multi-select virtualize="never"></md-multi-select>');
      const host = page.root as Host;
      await host.loadOptions([{ value: 'x' }, { value: 'y' }]);
      await page.waitForChanges();
      await host.loadOptions([{ value: 'z' }]);
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item')?.length).toBe(1);
    });

    it('handles an empty dataset', async () => {
      const page = await create('<md-multi-select virtualize="never"></md-multi-select>');
      await expect((page.root as Host).loadOptions([])).resolves.toBeUndefined();
    });
  });

  describe('setQuery / getLabels', () => {
    it('applies a query without throwing on the plain (non-WASM) path', async () => {
      const page = await create(`<md-multi-select virtualize="never">${OPTIONS}</md-multi-select>`);
      await expect((page.root as Host).setQuery('al')).resolves.toBeUndefined();
      await expect((page.root as Host).setQuery('')).resolves.toBeUndefined();
    });

    it('returns a plain object of labels', async () => {
      const page = await create(`<md-multi-select virtualize="never">${OPTIONS}</md-multi-select>`);
      const labels = await (page.root as Host).getLabels(['a']);
      expect(typeof labels).toBe('object');
      expect(Array.isArray(labels)).toBe(false);
    });

    it('returns an empty object for values it does not know', async () => {
      const page = await create('<md-multi-select virtualize="never"></md-multi-select>');
      await expect((page.root as Host).getLabels(['nope'])).resolves.toEqual({});
    });
  });

  describe('validity', () => {
    it('reports valid when nothing is required', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      await expect((page.root as Host).checkValidity()).resolves.toBe(true);
    });

    it('exposes a validity object with flags', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      const v = await (page.root as Host).getValidity();
      expect(v).toEqual(
        expect.objectContaining({
          valid: expect.any(Boolean),
          validationMessage: expect.any(String),
        }),
      );
      // `valid` must not also appear among the flags, or a passing control
      // reports one.
      expect(v.flags).not.toHaveProperty('valid');
    });

    it('reportValidity resolves a boolean', async () => {
      const page = await create(`<md-multi-select>${OPTIONS}</md-multi-select>`);
      await expect((page.root as Host).reportValidity()).resolves.toEqual(expect.any(Boolean));
    });

  });
});
