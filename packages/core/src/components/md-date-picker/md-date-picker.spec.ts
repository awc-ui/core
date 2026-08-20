import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdDatePicker } from './md-date-picker';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { MdRipple } from '../md-ripple/md-ripple';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { MdButton } from '../md-button/md-button';
import { MdTooltip } from '../md-tooltip/md-tooltip';

describe('md-date-picker', () => {
  let originalAnimateDescriptor: PropertyDescriptor | undefined;

  beforeAll(() => {
    // mock-doc's CSSStyleDeclaration has no `getPropertyPriority`, so
    // `resolveDockedPanelBlockSize` throws before it can measure anything and
    // every panel-positioning test dies on the same TypeError. Real browsers
    // (and therefore the e2e suite) have it; this only fills the mock gap.
    const styleProto = Object.getPrototypeOf(
      document.createElement('div').style,
    ) as CSSStyleDeclaration;
    if (typeof styleProto.getPropertyPriority !== 'function') {
      styleProto.getPropertyPriority = () => '';
    }

    // jsdom lacks Element.animate — stub for md-ripple on day md-buttons.
    originalAnimateDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'animate',
    );
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function () {
        return {
          cancel: () => undefined,
          finish: () => undefined,
          addEventListener: (_type: string, cb: () => void) => {
            cb();
          },
          removeEventListener: () => undefined,
          finished: Promise.resolve(),
        };
      },
    });
  });

  afterAll(() => {
    if (originalAnimateDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimateDescriptor);
    } else {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });

  afterEach(() => {
    // A test that installs fake timers and then hangs never reaches its own
    // `finally`, so they stay installed for the rest of the FILE — and every
    // later test that awaits a real timeout (panel close, bloom-out) then dies
    // at the 5s limit. That turns one broken test into a whole-file wedge.
    jest.useRealTimers();
  });

  async function create(html: string) {
    return newSpecPage({
      components: [MdDatePicker, MdTextField, MdIconButton, MdButton, MdRipple, MdMenu, MdMenuItem, MdTooltip],
      html,
    });
  }

  const shadow = (page: Awaited<ReturnType<typeof create>>) =>
    page.root?.shadowRoot;

  const textField = (page: Awaited<ReturnType<typeof create>>) =>
    shadow(page)?.querySelector('md-text-field') as HTMLElement | null;

  const textFieldInput = (page: Awaited<ReturnType<typeof create>>) =>
    textField(page)?.shadowRoot?.querySelector('.md-text-field__input') as
      | HTMLInputElement
      | null;

  const calendarButton = (page: Awaited<ReturnType<typeof create>>) =>
    textField(page)?.querySelector('[part="calendar-button"]') as
      | (HTMLElement & { variant?: string })
      | null;

  /** Panel bloom-out duration — keep in sync with `PANEL_BLOOM_OUT_MS` in tsx. */
  const PANEL_CLOSE_MS = 250;

  /** Selection menu / year-grid bloom-out — keep in sync with `DOCKED_SELECTION_BLOOM_OUT_MS`. */
  const SELECTION_CLOSE_MS = 250;

  /** Selection menu bloom-in — keep in sync with `DOCKED_SELECTION_BLOOM_IN_MS`. */
  const SELECTION_BLOOM_IN_MS = 500;

  async function waitForPanelClose(page: Awaited<ReturnType<typeof create>>) {
    await new Promise((r) => setTimeout(r, PANEL_CLOSE_MS));
    await page.waitForChanges();
  }

  describe('rendering', () => {
    it('renders with defaults (modal-input)', async () => {
      const page = await create('<md-date-picker></md-date-picker>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-date-picker');
      expect(page.root).toHaveClass('md-date-picker--modal-input');
    });

    it('reflects the variant attribute', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      expect(page.root?.getAttribute('variant')).toBe('docked');
      expect(page.root).toHaveClass('md-date-picker--docked');
    });

    it('renders a trigger field for field-bearing variants', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      expect(shadow(page)?.querySelector('[part="field"]')).toBeTruthy();
      expect(textField(page)).toBeTruthy();
      expect(textFieldInput(page)).toBeTruthy();
    });

    it('omits the trigger field for the bare modal variant', async () => {
      const page = await create('<md-date-picker variant="modal"></md-date-picker>');
      expect(shadow(page)?.querySelector('[part="field"]')).toBeNull();
    });

    it('renders the floating label', async () => {
      const page = await create('<md-date-picker label="Birthday"></md-date-picker>');
      expect((textField(page) as HTMLElement & { label?: string })?.label).toBe('Birthday');
    });
  });

  describe('props', () => {
    it('reflects value, min, max', async () => {
      const page = await create(
        '<md-date-picker value="2025-06-15" min="2025-01-01" max="2025-12-31"></md-date-picker>',
      );
      expect(page.rootInstance.value).toBe('2025-06-15');
      expect(page.rootInstance.min).toBe('2025-01-01');
      expect(page.rootInstance.max).toBe('2025-12-31');
    });

    it('honors first-day-of-week', async () => {
      const page = await create(
        '<md-date-picker first-day-of-week="1"></md-date-picker>',
      );
      expect(page.rootInstance.firstDayOfWeek).toBe(1);
    });

    it('shows supporting text', async () => {
      const page = await create(
        '<md-date-picker supporting-text="Pick a day"></md-date-picker>',
      );
      const tf = textField(page) as HTMLElement & { supportingText?: string };
      expect(tf?.supportingText).toBe('Pick a day');
    });

    it('shows error text and marks input invalid when error is set', async () => {
      const page = await create(
        '<md-date-picker error error-text="Required"></md-date-picker>',
      );
      const tf = textField(page) as HTMLElement & {
        error?: boolean;
        errorText?: string;
      };
      expect(tf?.error).toBe(true);
      expect(tf?.errorText).toBe('Required');
      expect(textFieldInput(page)?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('open / methods', () => {
    it('show() opens and renders the dialog panel', async () => {
      const page = await create('<md-date-picker variant="modal"></md-date-picker>');
      await page.rootInstance.show();
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]');
      expect(panel).toBeTruthy();
      expect(panel?.getAttribute('role')).toBe('dialog');
      expect(panel?.getAttribute('aria-modal')).toBe('true');
    });

    it('close() closes the dialog', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
      expect(shadow(page)?.querySelector('[part="panel"]')).toBeNull();
    });

    it('does not open when disabled', async () => {
      const page = await create('<md-date-picker disabled></md-date-picker>');
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('emits mdOpen on open and mdClose on close', async () => {
      const page = await create('<md-date-picker variant="modal"></md-date-picker>');
      const onOpen = jest.fn();
      const onClose = jest.fn();
      page.root?.addEventListener('mdOpen', onOpen);
      page.root?.addEventListener('mdClose', onClose);
      await page.rootInstance.show();
      await page.waitForChanges();
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clear() resets the value and emits mdChange', async () => {
      const page = await create('<md-date-picker value="2025-06-15"></md-date-picker>');
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      await page.rootInstance.clear();
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('');
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('navigation events', () => {
    it('does not emit navigation events when the view syncs programmatically', async () => {
      const page = await create('<md-date-picker value="2025-06-15"></md-date-picker>');
      const onViewChange = jest.fn();
      const onMenuOpen = jest.fn();
      page.root?.addEventListener('mdViewChange', onViewChange);
      page.root?.addEventListener('mdMenuOpen', onMenuOpen);
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(onViewChange).not.toHaveBeenCalled();
      expect(onMenuOpen).not.toHaveBeenCalled();
    });

    it('emits mdViewChange when modal month chevrons are clicked', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const onViewChange = jest.fn();
      page.root?.addEventListener('mdViewChange', onViewChange);
      (shadow(page)?.querySelector('[part="prev-button"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0][0].detail).toEqual({
        month: 4,
        year: 2025,
        source: 'chevron-month',
      });
    });

    it('emits mdViewChange when docked month and year chevrons are clicked', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-08-17" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onViewChange = jest.fn();
      page.root?.addEventListener('mdViewChange', onViewChange);
      (shadow(page)?.querySelector('[part="prev-month-button"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(onViewChange.mock.calls[0][0].detail).toEqual({
        month: 6,
        year: 2025,
        source: 'chevron-month',
      });
      (shadow(page)?.querySelector('[part="next-year-button"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(onViewChange.mock.calls[1][0].detail).toEqual({
        month: 6,
        year: 2026,
        source: 'chevron-year',
      });
    });

    it('emits mdMenuOpen when docked month and year menus open', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-08-17" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onMenuOpen = jest.fn();
      page.root?.addEventListener('mdMenuOpen', onMenuOpen);
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(onMenuOpen).toHaveBeenCalledTimes(1);
      expect(onMenuOpen.mock.calls[0][0].detail).toEqual({ type: 'month' });
      (shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(onMenuOpen).toHaveBeenCalledTimes(2);
      expect(onMenuOpen.mock.calls[1][0].detail).toEqual({ type: 'year' });
    });

    it('does not emit mdMenuOpen when closing a docked menu via toggle', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-08-17" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onMenuOpen = jest.fn();
      page.root?.addEventListener('mdMenuOpen', onMenuOpen);
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      monthBtn.click();
      await page.waitForChanges();
      onMenuOpen.mockClear();
      monthBtn.click();
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      expect(onMenuOpen).not.toHaveBeenCalled();
    });

    it('emits mdMenuSelect and mdViewChange when a docked month is picked', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-08-17" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onMenuSelect = jest.fn();
      const onViewChange = jest.fn();
      page.root?.addEventListener('mdMenuSelect', onMenuSelect);
      page.root?.addEventListener('mdViewChange', onViewChange);
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      const options = shadow(page)?.querySelectorAll('md-menu-item[part~="month-option"]');
      (options?.[0] as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 400));
      await page.waitForChanges();
      expect(onMenuSelect).toHaveBeenCalledTimes(1);
      expect(onMenuSelect.mock.calls[0][0].detail).toEqual({
        type: 'month',
        value: 0,
        label: 'January',
      });
      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0][0].detail).toEqual({
        month: 0,
        year: 2025,
        source: 'month-menu',
      });
    });

    it('emits mdMenuSelect and mdViewChange when a docked year is picked', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-08-17" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onMenuSelect = jest.fn();
      const onViewChange = jest.fn();
      page.root?.addEventListener('mdMenuSelect', onMenuSelect);
      page.root?.addEventListener('mdViewChange', onViewChange);
      (shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      const yearItem = Array.from(
        shadow(page)?.querySelectorAll('md-menu-item[part~="year-option"]') ?? [],
      ).find(
        (el) => (el as HTMLElement & { headline?: string }).headline === '2010',
      ) as HTMLElement;
      yearItem.click();
      await new Promise((r) => setTimeout(r, 400));
      await page.waitForChanges();
      expect(onMenuSelect).toHaveBeenCalledTimes(1);
      expect(onMenuSelect.mock.calls[0][0].detail).toEqual({
        type: 'year',
        value: 2010,
        label: '2010',
      });
      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0][0].detail).toEqual({
        month: 7,
        year: 2010,
        source: 'year-menu',
      });
    });

    it('emits mdMenuOpen when modal year grid opens via month-year toggle', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const onMenuOpen = jest.fn();
      page.root?.addEventListener('mdMenuOpen', onMenuOpen);
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(onMenuOpen).toHaveBeenCalledTimes(1);
      expect(onMenuOpen.mock.calls[0][0].detail).toEqual({ type: 'year' });
    });

    it('emits mdMenuSelect and mdViewChange when a modal year is picked', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const onMenuSelect = jest.fn();
      const onViewChange = jest.fn();
      page.root?.addEventListener('mdMenuSelect', onMenuSelect);
      page.root?.addEventListener('mdViewChange', onViewChange);
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      (shadow(page)?.querySelector('[data-year="2020"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(onMenuSelect).toHaveBeenCalledTimes(1);
      expect(onMenuSelect.mock.calls[0][0].detail).toEqual({
        type: 'year',
        value: 2020,
        label: '2020',
      });
      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0][0].detail).toEqual({
        month: 5,
        year: 2020,
        source: 'year-menu',
      });
    });
  });

  describe('calendar grid', () => {
    it('renders 7 weekday headers and 42 day cells', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      expect(shadow(page)?.querySelectorAll('[part="weekday"]').length).toBe(7);
      expect(shadow(page)?.querySelectorAll('[data-date]').length).toBe(42);
    });

    it('renders day cells as md-button gridcells', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]');
      expect(cell?.tagName.toLowerCase()).toBe('md-button');
      expect(cell).toHaveClass('md-date-picker__day');
      expect(cell?.getAttribute('role')).toBe('gridcell');
      expect(cell?.textContent?.trim()).toBe('15');
    });

    it('weekday headers are presentational with hover full names via md-tooltip', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const row = shadow(page)?.querySelector('[part="weekdays"]') as HTMLElement;
      expect(row?.getAttribute('aria-hidden')).toBe('true');
      const weekdays = shadow(page)?.querySelectorAll('[part="weekday"]') ?? [];
      expect(weekdays.length).toBe(7);
      weekdays.forEach((el) => {
        expect(el.getAttribute('role')).toBe('presentation');
        expect(el.hasAttribute('aria-label')).toBe(false);
        expect(el.hasAttribute('tabindex')).toBe(false);
        // Uses the shared md-tooltip rather than a native title attribute.
        expect(el.hasAttribute('title')).toBe(false);
        const tooltip = el.closest('md-tooltip');
        expect(tooltip).toBeTruthy();
        // md-tooltip mirrors its text onto the trigger as aria-description.
        expect(el.getAttribute('aria-description')).toBeTruthy();
      });
      const sunday = weekdays[0] as HTMLElement;
      expect(sunday.textContent?.trim()).toBe('S');
      const sundayTooltip = sunday.closest('md-tooltip') as (HTMLElement & { text?: string }) | null;
      expect(sundayTooltip?.text).toBe('Sunday');
      expect(sunday.getAttribute('aria-description')).toBe('Sunday');
    });

    it('weekday tooltips open immediately on host hover', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const sunday = shadow(page)?.querySelector('[part="weekday"]') as HTMLElement;
      const tooltip = sunday.closest('md-tooltip') as HTMLElement & { open: boolean; showDelay: number };
      expect(tooltip.showDelay).toBe(0);

      tooltip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();

      expect(tooltip.open).toBe(true);
      const popup = tooltip.shadowRoot?.querySelector('.md-tooltip__popup--visible');
      expect(popup).toBeTruthy();
    });

    it('hovering tooltip triggers does not emit mdOpen on the picker', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const onOpen = jest.fn();
      page.root?.addEventListener('mdOpen', onOpen);
      onOpen.mockClear();

      const sunday = shadow(page)?.querySelector('[part="weekday"]') as HTMLElement;
      const weekdayTooltip = sunday.closest('md-tooltip') as HTMLElement;
      weekdayTooltip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();
      expect(onOpen).not.toHaveBeenCalled();

      const prevBtn = shadow(page)?.querySelector('[part="prev-button"]') as HTMLElement;
      prevBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();
      expect(onOpen).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });

    it('hovering docked nav controls does not emit mdOpen on the picker', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onOpen = jest.fn();
      page.root?.addEventListener('mdOpen', onOpen);
      onOpen.mockClear();

      const hover = async (part: string) => {
        const el = shadow(page)?.querySelector(`[part="${part}"]`) as HTMLElement;
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await page.waitForChanges();
      };

      await hover('prev-month-button');
      await hover('next-month-button');
      await hover('prev-year-button');
      await hover('next-year-button');
      await hover('month-menu-button');
      await hover('year-menu-button');

      expect(onOpen).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });

    it('hovering switch-to-input control does not emit mdOpen/mdClose on the picker', async () => {
      const page = await create(
        '<md-date-picker variant="modal-input" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onOpen = jest.fn();
      const onClose = jest.fn();
      page.root?.addEventListener('mdOpen', onOpen);
      page.root?.addEventListener('mdClose', onClose);
      onOpen.mockClear();
      onClose.mockClear();

      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLElement;
      toggle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();
      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      toggle.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();
      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });

    it('tooltip hover cycles do not emit mdClose on the picker (controlled consumers)', async () => {
      const page = await newSpecPage({
        components: [MdDatePicker, MdTextField, MdIconButton, MdButton, MdRipple, MdMenu, MdMenuItem, MdTooltip],
        html: '<div id="host"><md-date-picker variant="modal-input" value="2025-06-15" open></md-date-picker></div>',
      });
      await page.waitForChanges();
      const host = page.body.querySelector('#host') as HTMLElement;
      const onOpen = jest.fn();
      const onClose = jest.fn();
      host.addEventListener('mdOpen', onOpen);
      host.addEventListener('mdClose', onClose);
      onOpen.mockClear();
      onClose.mockClear();

      const hover = async (part: string) => {
        const el = shadow(page)?.querySelector(`[part="${part}"]`) as HTMLElement;
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await page.waitForChanges();
      };
      const unhover = async (part: string) => {
        const el = shadow(page)?.querySelector(`[part="${part}"]`) as HTMLElement;
        el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await page.waitForChanges();
      };

      await hover('prev-button');
      await hover('next-button');
      await unhover('next-button');
      await hover('month-toggle');
      await unhover('month-toggle');
      await hover('mode-toggle');
      await unhover('mode-toggle');

      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });

    it('opening docked month menu does not emit mdOpen on the picker host', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const onOpen = jest.fn();
      const onMenuOpen = jest.fn();
      page.root?.addEventListener('mdOpen', onOpen);
      page.root?.addEventListener('mdMenuOpen', onMenuOpen);
      onOpen.mockClear();

      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      monthBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await page.waitForChanges();

      expect(onMenuOpen).toHaveBeenCalled();
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('weekday headers are not keyboard focusable', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const weekdays = shadow(page)?.querySelectorAll('[part="weekday"]') ?? [];
      weekdays.forEach((el) => {
        expect((el as HTMLElement).tabIndex).toBe(-1);
      });
    });

    it('marks the selected (pending) day', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]');
      expect(cell?.getAttribute('aria-selected')).toBe('true');
    });

    it('enables shape morph on day cells for M3 expressive select animation', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement | null;
      expect(cell?.classList.contains('md-button--shape-morph')).toBe(true);
      expect(cell?.classList.contains('md-button--square')).toBe(true);
      expect(cell?.classList.contains('md-button--filled')).toBe(true);
    });

    it('disables out-of-range days', async () => {
      const page = await create(
        '<md-date-picker value="2025-06-15" min="2025-06-10" max="2025-06-20" open></md-date-picker>',
      );
      await page.waitForChanges();
      const before = shadow(page)?.querySelector('[data-date="2025-06-05"]') as HTMLButtonElement;
      expect(before?.getAttribute('aria-disabled')).toBe('true');
    });

    it('styles modal month-year toggle like docked menu buttons', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement & {
        classList: DOMTokenList;
      };
      expect(toggle?.classList.contains('md-date-picker__menu-button')).toBe(true);
      expect(toggle?.classList.contains('md-date-picker__menu-button--expanded')).toBe(false);
      expect(toggle?.classList.contains('md-button--selected')).toBe(false);
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      const caret = shadow(page)?.querySelector('[part="menu-caret"]');
      expect(caret).toBeTruthy();
    });

    it('shows selected pill state when year grid is open', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement & {
        classList: DOMTokenList;
      };
      expect(toggle?.classList.contains('md-date-picker__menu-button--expanded')).toBe(true);
      expect(toggle?.classList.contains('md-button--selected')).toBe(true);
      expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    });

    it('opens the year grid via the month-year toggle', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement;
      toggle.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="year-grid"]')).toBeTruthy();
      const wrap = shadow(page)?.querySelector('[part="year-grid-wrap"]');
      expect(wrap?.classList.contains('md-date-picker__year-grid-wrap--bloom-out')).toBe(false);
    });

    it('wraps modal year grid in a scroll viewport for overflow scrolling', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      const scroll = shadow(page)?.querySelector(
        '.md-date-picker__year-grid-scroll',
      ) as HTMLElement | null;
      expect(scroll).toBeTruthy();
    });

    it('exposes the year grid viewport part', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      const scroll = shadow(page)?.querySelector(
        // `~=` — the element carries TWO part names, so an exact-value
        // selector can never match it.
        '[part~="year-grid-scroll"]',
      ) as HTMLElement;
      const parts = scroll?.getAttribute('part') ?? '';
      expect(parts).toContain('year-grid-viewport');
    });

    it('scrolls selected year into view when modal year grid opens', async () => {
      const scrollSpy = jest.spyOn(
        MdDatePicker.prototype as MdDatePicker & {
          scrollModalYearGridIntoView: () => void;
        },
        'scrollModalYearGridIntoView',
      );
      const page = await create('<md-date-picker value="1742-06-15" open></md-date-picker>');
      await page.waitForChanges();
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(scrollSpy).toHaveBeenCalled();
      scrollSpy.mockRestore();
    });

    it('scrolls modal year grid before selection bloom completes', async () => {
      const scrollSpy = jest.spyOn(
        MdDatePicker.prototype as MdDatePicker & {
          scrollModalYearGridIntoView: () => void;
        },
        'scrollModalYearGridIntoView',
      );
      const page = await create('<md-date-picker value="1742-06-15" open></md-date-picker>');
      await page.waitForChanges();
      // Deterministic immediacy proof (the old wall-clock `Date.now() - started
      // < SELECTION_BLOOM_IN_MS` flaked under parallel CI load): with fake
      // timers advanced only 50ms, a scroll scheduled behind the 500ms bloom
      // timer could NOT have run — being called at all proves it's immediate.
      try {
        (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
        // `waitForChanges()` drains the RENDER queue; it does not advance the
        // clock. So a scroll scheduled behind the 500ms bloom-in timer could not
        // have run by the time this resolves — being called at all proves it is
        // immediate. (Fake timers deadlock here: the render queue they gate is
        // exactly what `waitForChanges` awaits, so the await never returns.)
        await page.waitForChanges();
        expect(scrollSpy).toHaveBeenCalled();
      } finally {
        scrollSpy.mockRestore();
      }
    });

    it('renders year grid cells as md-button gridcells', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      const year = shadow(page)?.querySelector('[data-year="2025"]') as HTMLElement | null;
      expect(year?.tagName).toBe('MD-BUTTON');
      expect(year?.getAttribute('role')).toBe('gridcell');
      expect(year?.classList.contains('md-button--square')).toBe(true);
      expect(year?.classList.contains('md-button--shape-morph')).toBe(true);
    });

    it('marks the selected year with filled variant', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      const year = shadow(page)?.querySelector('[data-year="2025"]') as HTMLElement | null;
      expect(year?.getAttribute('aria-selected')).toBe('true');
      expect(year?.classList.contains('md-button--filled')).toBe(true);
      expect(year?.classList.contains('md-date-picker__year--selected')).toBe(true);
    });

    it('selects a year and returns to the calendar', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      (shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      (shadow(page)?.querySelector('[data-year="2020"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.viewYear).toBe(2020);
      expect(page.rootInstance.yearViewClosing).toBe(true);
      await new Promise((r) => setTimeout(r, SELECTION_CLOSE_MS));
      await page.waitForChanges();
      expect(page.rootInstance.viewMode).toBe('calendar');
      expect(shadow(page)?.querySelector('[part="calendar"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="year-grid"]')).toBeFalsy();
      expect(
        shadow(page)?.querySelector('[part="calendar"]')?.classList.contains(
          'md-date-picker__calendar--content-bloom-in',
        ),
      ).toBe(true);
    });

    it('animates year grid bloom-out when toggling back to calendar', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement;
      toggle.click();
      await page.waitForChanges();
      toggle.click();
      await page.waitForChanges();
      expect(page.rootInstance.yearViewClosing).toBe(true);
      const wrap = shadow(page)?.querySelector('[part="year-grid-wrap"]');
      expect(wrap?.classList.contains('md-date-picker__year-grid-wrap--bloom-out')).toBe(true);
      await new Promise((r) => setTimeout(r, SELECTION_CLOSE_MS));
      await page.waitForChanges();
      expect(page.rootInstance.viewMode).toBe('calendar');
      expect(shadow(page)?.querySelector('[part="year-grid"]')).toBeFalsy();
    });
  });

  describe('commit-on-select', () => {
    it('renders no built-in action row when set', async () => {
      const page = await create('<md-date-picker commit-on-select open></md-date-picker>');
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part~="ok-button"]')).toBeFalsy();
      expect(shadow(page)?.querySelector('[part~="cancel-button"]')).toBeFalsy();
    });

    it('keeps the action row by default', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part~="ok-button"]')).toBeTruthy();
    });

    it('still honours a slotted actions row', async () => {
      const page = await create(
        '<md-date-picker commit-on-select open><div slot="actions">mine</div></md-date-picker>',
      );
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part~="actions"]')).toBeTruthy();
    });

    it('keeps the OK button in input mode — typing has no click to collapse', async () => {
      const page = await create(
        '<md-date-picker variant="modal-input" commit-on-select open></md-date-picker>',
      );
      await page.waitForChanges();
      // `modal-input` opens on the calendar; the header toggle switches to typing.
      (shadow(page)?.querySelector('[part~="mode-toggle"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.inputMode).toBe(true);
      expect(shadow(page)?.querySelector('[part~="ok-button"]')).toBeTruthy();
    });
  });

  describe('outside-click dismissal (docked)', () => {
    const pointerDownOn = (target: EventTarget) =>
      target.dispatchEvent(new CustomEvent('pointerdown', { bubbles: true, composed: true }));

    it('dismisses a docked panel on an outside pointerdown', async () => {
      const page = await create('<md-date-picker variant="docked" open></md-date-picker>');
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      pointerDownOn(page.doc.body);
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('stays open when outside-click-dismissible is false', async () => {
      const page = await create(
        '<md-date-picker variant="docked" open outside-click-dismissible="false"></md-date-picker>',
      );
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      pointerDownOn(page.doc.body);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });

    it('ignores a pointerdown inside the panel', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      pointerDownOn(panel);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });

    it('leaves the modal to its scrim', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      pointerDownOn(page.doc.body);
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(true);
    });
  });

  describe('selection & commit', () => {
    it('emits mdSelected when a day is clicked', async () => {
      const page = await create(
        '<md-date-picker value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const selectedSpy = jest.fn();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdSelected', selectedSpy);
      page.root?.addEventListener('mdChange', changeSpy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-20"]') as HTMLButtonElement;
      cell.click();
      await page.waitForChanges();
      expect(selectedSpy).toHaveBeenCalledTimes(1);
      expect(selectedSpy.mock.calls[0][0].detail).toEqual({
        value: '2025-06-20',
        date: expect.any(Date),
      });
      expect(selectedSpy.mock.calls[0][0].detail.date.getFullYear()).toBe(2025);
      expect(selectedSpy.mock.calls[0][0].detail.date.getMonth()).toBe(5);
      expect(selectedSpy.mock.calls[0][0].detail.date.getDate()).toBe(20);
      expect(changeSpy).not.toHaveBeenCalled();
      expect(page.rootInstance.value).toBe('2025-06-15');
    });

    it('emits mdSelected on Space when a day is focused', async () => {
      const page = await create(
        '<md-date-picker value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const selectedSpy = jest.fn();
      page.root?.addEventListener('mdSelected', selectedSpy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      expect(selectedSpy).toHaveBeenCalledTimes(1);
      expect(selectedSpy.mock.calls[0][0].detail.value).toBe('2025-06-15');
    });

    it('emits mdSelected then mdChange when Enter selects and commits a day', async () => {
      const page = await create(
        '<md-date-picker value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const selectedSpy = jest.fn();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdSelected', selectedSpy);
      page.root?.addEventListener('mdChange', changeSpy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      for (let i = 0; i < 5; i++) {
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
        );
        await page.waitForChanges();
      }
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]') as HTMLElement;
      expect(focused.getAttribute('data-date')).toBe('2025-06-20');
      focused.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      expect(selectedSpy).toHaveBeenCalledTimes(1);
      expect(selectedSpy.mock.calls[0][0].detail.value).toBe('2025-06-20');
      expect(changeSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy.mock.calls[0][0].detail.value).toBe('2025-06-20');
      expect(page.rootInstance.value).toBe('2025-06-20');
    });

    it('does not emit mdSelected on programmatic value changes', async () => {
      const page = await create('<md-date-picker value="2025-06-15"></md-date-picker>');
      await page.waitForChanges();
      const selectedSpy = jest.fn();
      page.root?.addEventListener('mdSelected', selectedSpy);
      page.rootInstance.value = '2025-06-20';
      await page.waitForChanges();
      expect(selectedSpy).not.toHaveBeenCalled();
    });

    it('does not emit mdSelected when a disabled day is clicked', async () => {
      const page = await create(
        '<md-date-picker min="2025-06-10" max="2025-06-25" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const selectedSpy = jest.fn();
      page.root?.addEventListener('mdSelected', selectedSpy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-05"]') as HTMLButtonElement;
      cell.click();
      await page.waitForChanges();
      expect(selectedSpy).not.toHaveBeenCalled();
    });

    it('docked variant stages selection and commits on OK', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-20"]') as HTMLButtonElement;
      cell.click();
      await page.waitForChanges();
      // Not committed until OK.
      expect(page.rootInstance.value).toBe('2025-06-15');
      const ok = shadow(page)?.querySelector('[part="ok-button"]') as HTMLButtonElement;
      ok.click();
      await waitForPanelClose(page);
      expect(page.rootInstance.value).toBe('2025-06-20');
      expect(spy).toHaveBeenCalled();
      expect(page.rootInstance.open).toBe(false);
    });

    it('modal variant stages selection and commits on OK', async () => {
      const page = await create(
        '<md-date-picker value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-20"]') as HTMLButtonElement;
      cell.click();
      await page.waitForChanges();
      // Not committed yet
      expect(page.rootInstance.value).toBe('2025-06-15');
      const ok = shadow(page)?.querySelector('[part="ok-button"]') as HTMLButtonElement;
      ok.click();
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-06-20');
    });

    it('Cancel emits mdCancel and does not commit', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-20"]') as HTMLButtonElement;
      cell.click();
      await page.waitForChanges();
      const cancel = shadow(page)?.querySelector('[part="cancel-button"]') as HTMLButtonElement;
      cancel.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
      expect(page.rootInstance.value).toBe('2025-06-15');
    });
  });

  describe('docked variant anatomy', () => {
    async function dockedOpen(extra = '') {
      const page = await create(
        `<md-date-picker variant="docked" value="2025-08-17" ${extra} open></md-date-picker>`,
      );
      await page.waitForChanges();
      return page;
    }

    it('anchors docked popup to the field via docked-anchor wrapper', async () => {
      const page = await dockedOpen();
      const sh = shadow(page);
      const anchor = sh?.querySelector('.md-date-picker__docked-anchor');
      const field = sh?.querySelector('.md-date-picker__textfield');
      const popup = sh?.querySelector('.md-date-picker__docked-popup');
      const panel = sh?.querySelector('.md-date-picker__panel--docked');
      expect(anchor).toBeTruthy();
      expect(field?.parentElement).toBe(anchor);
      expect(popup?.parentElement).toBe(anchor);
      expect(panel?.parentElement).toBe(popup);
    });

    it('does not render docked popup outside the anchor when closed', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      const sh = shadow(page);
      expect(sh?.querySelector('.md-date-picker__docked-anchor')).toBeTruthy();
      expect(sh?.querySelector('.md-date-picker__docked-popup')).toBeNull();
    });

    describe('positionDockedPanel', () => {
      function mockDockedAnchor(page: SpecPage, rect: Partial<DOMRect>) {
        const anchor = page.root!.shadowRoot!.querySelector(
          '.md-date-picker__docked-anchor',
        ) as HTMLElement;
        anchor.getBoundingClientRect = () =>
          ({
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
            ...rect,
          }) as DOMRect;
        return anchor;
      }

      function mockDockedPanel(page: SpecPage, w: number, h: number) {
        const panel = page.root!.shadowRoot!.querySelector(
          '.md-date-picker__panel--docked',
        ) as HTMLElement;
        Object.defineProperty(panel, 'offsetWidth', { value: w, configurable: true });
        // `h` is the panel's NATURAL height. A fixed value can't express the
        // clamp check: `resolveDockedPanelBlockSize` lifts `max-block-size` to
        // `none`, measures, then restores it — so a real panel reports its
        // natural height mid-measurement and its capped height the rest of the
        // time. Modelling that is what makes "stays clamped" testable at all.
        Object.defineProperty(panel, 'offsetHeight', {
          configurable: true,
          get() {
            const cap = panel.style.getPropertyValue('max-block-size');
            if (!cap || cap === 'none') return h;
            const px = parseFloat(cap);
            return Number.isFinite(px) ? Math.min(h, px) : h;
          },
        });
        panel.getBoundingClientRect = () =>
          ({
            top: 0,
            bottom: h,
            left: 0,
            right: w,
            width: w,
            height: h,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect;
        return panel;
      }

      it('keeps start alignment when the panel fits inline-end', async () => {
        const page = await dockedOpen();
        mockDockedAnchor(page, { top: 100, bottom: 156, left: 50, right: 330, width: 280, height: 56 });
        mockDockedPanel(page, 360, 420);
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        page.rootInstance.positionDockedPanel();
        await page.waitForChanges();

        expect(page.rootInstance.dockedPanelAlign).toBe('start');
        expect(page.rootInstance.dockedPanelPlacement).toBe('below');
        const panel = shadow(page)?.querySelector('.md-date-picker__panel--docked');
        expect(panel).not.toHaveClass('md-date-picker__panel--align-end');
      });

      it('flips to end alignment when start overflows inline-end', async () => {
        const page = await dockedOpen();
        mockDockedAnchor(page, { top: 100, bottom: 156, left: 700, right: 980, width: 280, height: 56 });
        mockDockedPanel(page, 360, 420);
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        page.rootInstance.positionDockedPanel();
        await page.waitForChanges();

        expect(page.rootInstance.dockedPanelAlign).toBe('end');
        const panel = shadow(page)?.querySelector('.md-date-picker__panel--docked');
        expect(panel).toHaveClass('md-date-picker__panel--align-end');
      });

      it('flips above the field when block-end overflows', async () => {
        const page = await dockedOpen();
        mockDockedAnchor(page, { top: 600, bottom: 656, left: 50, right: 330, width: 280, height: 56 });
        mockDockedPanel(page, 360, 420);
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        page.rootInstance.positionDockedPanel();
        await page.waitForChanges();

        expect(page.rootInstance.dockedPanelPlacement).toBe('above');
        const popup = shadow(page)?.querySelector('.md-date-picker__docked-popup');
        const panel = shadow(page)?.querySelector('.md-date-picker__panel--docked');
        expect(popup).toHaveClass('md-date-picker__docked-popup--above');
        expect(panel).toHaveClass('md-date-picker__panel--placement-above');
      });

      it('clamps max block-size when below overflows and above cannot fit', async () => {
        const page = await dockedOpen();
        mockDockedAnchor(page, { top: 200, bottom: 256, left: 50, right: 330, width: 280, height: 56 });
        mockDockedPanel(page, 360, 600);
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        page.rootInstance.positionDockedPanel();
        await page.waitForChanges();

        expect(page.rootInstance.dockedPanelPlacement).toBe('below');
        expect(page.rootInstance.dockedPanelMaxBlockSize).toBe('492px');
        const panel = shadow(page)?.querySelector('.md-date-picker__panel--docked') as HTMLElement;
        expect(panel.style.maxBlockSize).toBe('492px');
      });

      it('keeps max block-size stable after clamping (no render loop)', async () => {
        const page = await dockedOpen();
        mockDockedAnchor(page, { top: 200, bottom: 256, left: 50, right: 330, width: 280, height: 56 });
        mockDockedPanel(page, 360, 600);
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        page.rootInstance.positionDockedPanel();
        await page.waitForChanges();
        expect(page.rootInstance.dockedPanelMaxBlockSize).toBe('492px');

        // Re-position repeatedly against the now-clamped panel. The mock reports
        // the natural 600 whenever the cap is lifted for measurement, so a
        // correct implementation recomputes the same 492px every time; one that
        // measured the clamped height would ratchet the panel smaller each pass.
        for (let i = 0; i < 5; i++) {
          page.rootInstance.positionDockedPanel();
          await page.waitForChanges();
        }

        expect(page.rootInstance.dockedPanelMaxBlockSize).toBe('492px');
      });

      it('resets alignment when the docked panel closes', async () => {
        const page = await dockedOpen();
        mockDockedAnchor(page, { top: 100, bottom: 156, left: 700, right: 980, width: 280, height: 56 });
        mockDockedPanel(page, 360, 420);
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

        page.rootInstance.positionDockedPanel();
        await page.waitForChanges();
        expect(page.rootInstance.dockedPanelAlign).toBe('end');

        page.rootInstance.open = false;
        await page.waitForChanges();

        expect(page.rootInstance.dockedPanelAlign).toBe('start');
        expect(page.rootInstance.dockedPanelPlacement).toBe('below');
        expect(page.rootInstance.dockedPanelMaxBlockSize).toBeNull();
      });
    });

    it('renders month + year menu buttons and flanking chevrons', async () => {
      const page = await dockedOpen();
      const sh = shadow(page);
      const monthBtn = sh?.querySelector('[part="month-menu-button"]');
      const yearBtn = sh?.querySelector('[part="year-menu-button"]');
      expect(monthBtn?.tagName).toBe('MD-BUTTON');
      expect(yearBtn?.tagName).toBe('MD-BUTTON');
      expect((monthBtn as HTMLElement & { variant?: string })?.variant).toBe('text');
      expect((monthBtn as HTMLElement & { trailingIcon?: string })?.trailingIcon).toBe(
        'arrow_drop_down',
      );
      expect(
        (monthBtn as HTMLElement & { suppressExpandIconFlip?: boolean })
          ?.suppressExpandIconFlip,
      ).toBe(true);
      expect(
        (yearBtn as HTMLElement & { suppressExpandIconFlip?: boolean })
          ?.suppressExpandIconFlip,
      ).toBe(true);
      const nav = sh?.querySelector('.md-date-picker__docked-nav');
      expect(nav?.querySelectorAll('.md-date-picker__nav-group').length).toBe(2);
      expect(sh?.querySelector('[part="prev-month-button"]')?.tagName).toBe('MD-ICON-BUTTON');
      expect(sh?.querySelector('[part="next-month-button"]')?.tagName).toBe('MD-ICON-BUTTON');
      expect(sh?.querySelector('[part="prev-year-button"]')?.tagName).toBe('MD-ICON-BUTTON');
      expect(sh?.querySelector('[part="next-year-button"]')?.tagName).toBe('MD-ICON-BUTTON');
      expect(
        sh?.querySelector('[part="prev-month-chevron-spacer"]')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(false);
      expect(
        sh?.querySelector('[part="prev-year-chevron-spacer"]')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(false);
    });

    it('renders Cancel and OK action buttons', async () => {
      const page = await dockedOpen();
      const sh = shadow(page);
      expect(sh?.querySelector('[part="cancel-button"]')).toBeTruthy();
      expect(sh?.querySelector('[part="ok-button"]')).toBeTruthy();
    });

    function navChevronTabIndex(el: HTMLElement | null | undefined): number {
      return (el as HTMLElement | null)?.tabIndex ?? NaN;
    }

    it('year nav chevrons are in tab order when day grid is visible', async () => {
      const page = await dockedOpen();
      const sh = shadow(page);
      const prevYear = sh?.querySelector('[part="prev-year-button"]') as HTMLElement;
      const nextYear = sh?.querySelector('[part="next-year-button"]') as HTMLElement;
      expect(prevYear?.hasAttribute('aria-hidden')).toBe(false);
      expect(nextYear?.hasAttribute('aria-hidden')).toBe(false);
      expect(prevYear?.hasAttribute('disabled')).toBe(false);
      expect(nextYear?.hasAttribute('disabled')).toBe(false);
      expect(navChevronTabIndex(prevYear)).toBe(0);
      expect(navChevronTabIndex(nextYear)).toBe(0);
    });

    it('year nav chevrons leave tab order while month menu is open', async () => {
      const page = await dockedOpen();
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      const prevYear = shadow(page)?.querySelector('[part="prev-year-button"]') as HTMLElement;
      const nextYear = shadow(page)?.querySelector('[part="next-year-button"]') as HTMLElement;
      expect(prevYear?.hasAttribute('disabled')).toBe(true);
      expect(nextYear?.hasAttribute('disabled')).toBe(true);
      expect(navChevronTabIndex(prevYear)).toBe(-1);
      expect(navChevronTabIndex(nextYear)).toBe(-1);
    });

    it('year nav chevrons re-enter tab order after month menu closes', async () => {
      const page = await dockedOpen();
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      monthBtn.click();
      await page.waitForChanges();
      monthBtn.click();
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      const prevYear = shadow(page)?.querySelector('[part="prev-year-button"]') as HTMLElement;
      const nextYear = shadow(page)?.querySelector('[part="next-year-button"]') as HTMLElement;
      expect(prevYear?.hasAttribute('aria-hidden')).toBe(false);
      expect(nextYear?.hasAttribute('aria-hidden')).toBe(false);
      expect(prevYear?.hasAttribute('disabled')).toBe(false);
      expect(nextYear?.hasAttribute('disabled')).toBe(false);
      expect(navChevronTabIndex(prevYear)).toBe(0);
      expect(navChevronTabIndex(nextYear)).toBe(0);
    });

    it('docked nav tab order is month chevrons, year chevrons, then day grid', async () => {
      const page = await dockedOpen();
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      expect(panel).toBeTruthy();

      const tabOrder: string[] = [];
      for (const node of Array.from(panel.querySelectorAll<HTMLElement>('*'))) {
        if (node.tabIndex < 0) continue;
        const part = node.getAttribute('part');
        if (
          part === 'prev-month-button' ||
          part === 'month-menu-button' ||
          part === 'next-month-button' ||
          part === 'prev-year-button' ||
          part === 'year-menu-button' ||
          part === 'next-year-button'
        ) {
          tabOrder.push(part);
        } else if (node.hasAttribute('data-date') && node.tabIndex === 0) {
          tabOrder.push(node.getAttribute('data-date') ?? 'day');
          break;
        }
      }

      expect(tabOrder).toEqual([
        'prev-month-button',
        'month-menu-button',
        'next-month-button',
        'prev-year-button',
        'year-menu-button',
        'next-year-button',
        '2025-08-17',
      ]);
    });

    it('shows month chevrons and omits year chevrons when month menu is open', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="prev-month-button"]')?.tagName).toBe(
        'MD-ICON-BUTTON',
      );
      expect(shadow(page)?.querySelector('[part="next-month-button"]')?.tagName).toBe(
        'MD-ICON-BUTTON',
      );
      expect(
        shadow(page)?.querySelector('[part="prev-year-button"]')?.closest('md-tooltip')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(false);
      expect(
        shadow(page)?.querySelector('[part="prev-month-button"]')?.closest('md-tooltip')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(true);
      expect(
        shadow(page)?.querySelector('[part="prev-year-chevron-spacer"]')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(true);
    });

    it('shows year chevrons and omits month chevrons when year menu is open', async () => {
      const page = await dockedOpen('min="1900-01-01" max="2100-12-31"');
      const btn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="prev-year-button"]')?.tagName).toBe(
        'MD-ICON-BUTTON',
      );
      expect(shadow(page)?.querySelector('[part="next-year-button"]')?.tagName).toBe(
        'MD-ICON-BUTTON',
      );
      expect(
        shadow(page)?.querySelector('[part="prev-month-button"]')?.closest('md-tooltip')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(false);
      expect(
        shadow(page)?.querySelector('[part="prev-year-button"]')?.closest('md-tooltip')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(true);
      expect(
        shadow(page)?.querySelector('[part="prev-month-chevron-spacer"]')?.classList.contains(
          'md-date-picker__nav-chevron--visible',
        ),
      ).toBe(true);
    });

    it('renders docked-below-nav only while month/year selection is open', async () => {
      const page = await dockedOpen();
      expect(shadow(page)?.querySelector('[part="docked-below-nav"]')).toBeNull();
      expect(shadow(page)?.querySelector('[part="selection-divider"]')).toBeNull();
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="docked-below-nav"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="selection-divider"]')).toBeTruthy();
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="docked-below-nav"]')).toBeNull();
      expect(shadow(page)?.querySelector('[part="selection-divider"]')).toBeNull();
    });

    it('sizes docked calendar and selection menus to the same content block', async () => {
      const page = await dockedOpen();
      const sh = shadow(page);
      const calendar = sh?.querySelector('.md-date-picker__calendar') as HTMLElement | null;
      expect(calendar).toBeTruthy();
      expect(calendar?.classList.contains('md-date-picker__calendar')).toBe(true);

      const readBlockSize = (el: HTMLElement | null) => {
        if (!el || typeof getComputedStyle !== 'function') return null;
        const value = getComputedStyle(el).blockSize || getComputedStyle(el).height;
        const px = parseFloat(value);
        return Number.isFinite(px) ? px : null;
      };
      const readFlexBasis = (el: HTMLElement | null) => {
        if (!el || typeof getComputedStyle !== 'function') return null;
        const px = parseFloat(getComputedStyle(el).flexBasis);
        return Number.isFinite(px) ? px : null;
      };
      const calendarSize = readBlockSize(calendar);
      const calendarBasis = readFlexBasis(calendar);
      const panel = sh?.querySelector('[part="panel"]') as HTMLElement | null;
      const panelDaySize = readBlockSize(panel);

      (sh?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();

      const menuWrap = sh?.querySelector('.md-date-picker__selection-menu-wrap') as HTMLElement | null;
      const divider = sh?.querySelector('.md-date-picker__selection-divider') as HTMLElement | null;
      expect(menuWrap).toBeTruthy();
      expect(divider).toBeTruthy();
      expect(menuWrap?.classList.contains('md-date-picker__selection-menu-wrap')).toBe(true);
      expect(sh?.querySelector('.md-date-picker__calendar')).toBeNull();
      expect(sh?.querySelector('[part="actions"]')).toBeTruthy();

      const menuSize = readBlockSize(menuWrap);
      const menuBasis = readFlexBasis(menuWrap);
      const dividerSize = readBlockSize(divider);
      const panelMenuSize = readBlockSize(panel);

      if (calendarSize != null && menuSize != null) {
        // Menu wrap is 1px shorter to account for the selection divider row above it.
        expect(menuSize).toBe(calendarSize - 1);
      }
      if (calendarBasis != null && menuBasis != null && dividerSize != null) {
        expect(menuBasis + dividerSize).toBe(calendarBasis);
      }
      if (panelDaySize != null && panelMenuSize != null) {
        expect(panelMenuSize).toBe(panelDaySize);
      }
    });

    it('scrolls selected month into view when month menu opens', async () => {
      const scrollSpy = jest.spyOn(
        MdDatePicker.prototype as MdDatePicker & {
          scrollDockedSelectionMenuIntoView: (kind: 'month' | 'year') => void;
        },
        'scrollDockedSelectionMenuIntoView',
      );
      const page = await dockedOpen();
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, SELECTION_BLOOM_IN_MS));
      expect(scrollSpy).toHaveBeenCalledWith('month');
      scrollSpy.mockRestore();
    });

    it('scrolls selected year into view when year menu opens', async () => {
      const scrollSpy = jest.spyOn(
        MdDatePicker.prototype as MdDatePicker & {
          scrollDockedSelectionMenuIntoView: (kind: 'month' | 'year') => void;
        },
        'scrollDockedSelectionMenuIntoView',
      );
      const page = await dockedOpen('min="1900-01-01" max="2100-12-31"');
      (shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, SELECTION_BLOOM_IN_MS));
      expect(scrollSpy).toHaveBeenCalledWith('year');
      scrollSpy.mockRestore();
    });

    it('scrolls selected month into view when switching from year menu', async () => {
      const scrollSpy = jest.spyOn(
        MdDatePicker.prototype as MdDatePicker & {
          scrollDockedSelectionMenuIntoView: (kind: 'month' | 'year') => void;
        },
        'scrollDockedSelectionMenuIntoView',
      );
      const page = await dockedOpen('value="2025-12-25" min="1900-01-01" max="2100-12-31"');
      (shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      scrollSpy.mockClear();
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, SELECTION_BLOOM_IN_MS));
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      expect(scrollSpy).toHaveBeenCalledWith('month');
      const selected = shadow(page)?.querySelector(
        'md-menu-item[part~="month-option-selected"]',
      ) as HTMLElement;
      expect(selected).toBeTruthy();
      scrollSpy.mockRestore();
    });

    it('keeps year dropdown caret when month menu is open', async () => {
      const page = await dockedOpen();
      const yearBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
      };
      expect(yearBtn?.trailingIcon).toBe('arrow_drop_down');
      expect(yearBtn?.classList.contains('md-date-picker__menu-button--expanded')).toBe(false);
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      const monthBtnOpen = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
        mirrorIcon?: boolean;
      };
      expect(monthBtnOpen?.trailingIcon).toBe('arrow_drop_up');
      expect(monthBtnOpen?.mirrorIcon).toBe(true);
      const yearBtnOpen = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
      };
      expect(yearBtnOpen?.trailingIcon).toBe('arrow_drop_down');
      expect(yearBtnOpen?.classList.contains('md-date-picker__menu-button--expanded')).toBe(false);
      expect(
        yearBtnOpen?.querySelector(
          '.md-date-picker__menu-caret-glyph--down.md-date-picker__menu-caret-glyph--visible',
        )?.textContent?.trim(),
      ).toBe('arrow_drop_down');
    });

    it('shows caret up on active month menu trigger', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
      };
      expect(btn?.trailingIcon).toBe('arrow_drop_down');
      btn.click();
      await page.waitForChanges();
      const openBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
        mirrorIcon?: boolean;
        suppressExpandIconFlip?: boolean;
      };
      expect(openBtn?.trailingIcon).toBe('arrow_drop_up');
      expect(openBtn?.mirrorIcon).toBe(true);
      expect(openBtn?.suppressExpandIconFlip).toBe(true);
      expect(
        openBtn?.querySelector(
          '.md-date-picker__menu-caret-glyph--up.md-date-picker__menu-caret-glyph--visible',
        )?.textContent?.trim(),
      ).toBe('arrow_drop_up');
    });

    it('shows caret up on active year menu trigger', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
      };
      btn.click();
      await page.waitForChanges();
      const openBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
        mirrorIcon?: boolean;
        suppressExpandIconFlip?: boolean;
      };
      expect(openBtn?.trailingIcon).toBe('arrow_drop_up');
      expect(openBtn?.mirrorIcon).toBe(true);
      expect(openBtn?.suppressExpandIconFlip).toBe(true);
    });

    it('opens the month menu, hides the day grid, and selects a month', async () => {
      const page = await dockedOpen();
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="cancel-button"]')).toBeTruthy();
      const btn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeNull();
      expect(shadow(page)?.querySelector('[part="cancel-button"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="ok-button"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="selection-divider"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('.md-date-picker__body--docked-selection')).toBeTruthy();
      const menuWrap = shadow(page)?.querySelector('[part="month-menu-wrap"]');
      expect(menuWrap).toBeTruthy();
      expect(menuWrap?.classList.contains('md-date-picker__selection-menu-wrap--bloom-out')).toBe(
        false,
      );
      const menu = shadow(page)?.querySelector('[part="month-menu"]') as HTMLElement & {
        variant?: string;
      };
      expect(menu).toBeTruthy();
      expect(menu?.tagName).toBe('MD-MENU');
      expect(menu?.variant).toBe('baseline');
      expect(menu?.classList.contains('md-menu--inline-fill')).toBe(true);
      expect(menu?.shadowRoot?.querySelector('.md-menu__scroll-shadow')).toBeTruthy();
      const options = shadow(page)?.querySelectorAll('md-menu-item[part~="month-option"]');
      expect(options?.length).toBe(12);
      const selected = shadow(page)?.querySelector(
        'md-menu-item[part~="month-option-selected"]',
      ) as HTMLElement & { selected?: boolean };
      expect(selected?.selected).toBe(true);
      // pick January (first option) — closes after ripple settles
      (options?.[0] as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 400));
      await page.waitForChanges();
      expect(page.rootInstance.viewMonth).toBe(0);
      expect(shadow(page)?.querySelector('[part="month-menu"]')).toBeNull();
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="cancel-button"]')).toBeTruthy();
    });

    it('keeps the month menu open until the selection ripple settles', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      const options = shadow(page)?.querySelectorAll('md-menu-item[part~="month-option"]');
      (options?.[0] as HTMLElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      expect(shadow(page)?.querySelector('[part="month-menu"]')).toBeTruthy();
      await new Promise((r) => setTimeout(r, 40));
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      await new Promise((r) => setTimeout(r, 400));
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(false);
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeTruthy();
    });

    it('keeps caret expanded during menu bloom-out close', async () => {
      const page = await dockedOpen();
      const openBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      openBtn.click();
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      let monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
      };
      expect(monthBtn?.classList.contains('md-date-picker__menu-button--expanded')).toBe(true);
      expect(monthBtn?.classList.contains('md-button--selected')).toBe(true);
      expect(monthBtn?.getAttribute('aria-pressed')).toBe('true');
      expect(monthBtn?.trailingIcon).toBe('arrow_drop_up');
      monthBtn!.click();
      await page.waitForChanges();
      expect(page.rootInstance.selectionMenuClosing).toBe('month');
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement & {
        trailingIcon?: string;
      };
      expect(monthBtn?.classList.contains('md-date-picker__menu-button--expanded')).toBe(true);
      expect(monthBtn?.classList.contains('md-button--selected')).toBe(true);
      expect(monthBtn?.getAttribute('aria-pressed')).toBe('true');
      expect(monthBtn?.trailingIcon).toBe('arrow_drop_up');
    });

    it('marks month menu button selected when month menu is open', async () => {
      const page = await dockedOpen();
      const closedBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      expect(closedBtn?.classList.contains('md-button--selected')).toBe(false);
      closedBtn!.click();
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      expect(monthBtn?.classList.contains('md-button--selected')).toBe(true);
      expect(monthBtn?.getAttribute('aria-pressed')).toBe('true');
      const yearBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      expect(yearBtn?.classList.contains('md-button--selected')).toBe(false);
    });

    it('marks year menu button selected when year menu is open', async () => {
      const page = await dockedOpen('min="1900-01-01" max="2100-12-31"');
      (shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.yearMenuOpen).toBe(true);
      const yearBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      expect(yearBtn?.classList.contains('md-button--selected')).toBe(true);
      expect(yearBtn?.getAttribute('aria-pressed')).toBe('true');
    });

    it('animates menu bloom-out when toggling the month menu closed', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.selectionMenuClosing).toBe('month');
      const wrap = shadow(page)?.querySelector('[part="month-menu-wrap"]');
      expect(wrap?.classList.contains('md-date-picker__selection-menu-wrap--bloom-out')).toBe(
        true,
      );
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(false);
      expect(page.rootInstance.selectionMenuClosing).toBeNull();
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeTruthy();
    });

    it('blooms in the day grid after a month is selected', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      const options = shadow(page)?.querySelectorAll('md-menu-item[part~="month-option"]');
      (options?.[0] as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 400));
      await page.waitForChanges();
      const calendar = shadow(page)?.querySelector('[part="calendar"]');
      expect(calendar?.classList.contains('md-date-picker__calendar--docked-bloom-in')).toBe(
        true,
      );
      expect(page.rootInstance.dockedCalendarBloom).toBe(true);
    });

    it('animates panel bloom-out when closing the docked picker', async () => {
      const page = await dockedOpen();
      const cancel = shadow(page)?.querySelector('[part="cancel-button"]') as HTMLButtonElement;
      cancel.click();
      await page.waitForChanges();
      expect(page.rootInstance.panelClosing).toBe(true);
      expect(page.root).toHaveClass('md-date-picker--panel-closing');
      const panel = shadow(page)?.querySelector('[part="panel"]');
      expect(panel?.classList.contains('md-date-picker__panel--bloom-out')).toBe(true);
      expect(shadow(page)?.querySelector('[part="panel"]')).toBeTruthy();
      await waitForPanelClose(page);
      expect(page.rootInstance.open).toBe(false);
      expect(page.rootInstance.panelClosing).toBe(false);
      expect(shadow(page)?.querySelector('[part="panel"]')).toBeNull();
    });

    it('marks calendar trigger active while docked panel is open', async () => {
      const page = await create('<md-date-picker variant="docked" value="2025-08-17"></md-date-picker>');
      await page.waitForChanges();
      const tf = shadow(page)?.querySelector('md-text-field');
      const closedBtn = tf?.querySelector('[part="calendar-button"]') as
        | (HTMLElement & { variant?: string })
        | null;
      expect(closedBtn?.variant).toBe('standard');
      expect(closedBtn?.getAttribute('aria-expanded')).toBe('false');

      closedBtn!.click();
      await page.waitForChanges();
      const openBtn = tf?.querySelector('[part="calendar-button"]') as
        | (HTMLElement & { variant?: string })
        | null;
      expect(page.rootInstance.open).toBe(true);
      expect(openBtn?.variant).toBe('tonal');
      expect(openBtn?.getAttribute('aria-expanded')).toBe('true');
      expect(openBtn?.classList.contains('md-icon-button--tonal')).toBe(true);
    });

    it('clears calendar trigger active state during panel bloom-out', async () => {
      const page = await dockedOpen();
      const tf = shadow(page)?.querySelector('md-text-field');
      const openBtn = tf?.querySelector('[part="calendar-button"]') as
        | (HTMLElement & { variant?: string })
        | null;
      expect(openBtn?.variant).toBe('tonal');

      const cancel = shadow(page)?.querySelector('[part="cancel-button"]') as HTMLButtonElement;
      cancel.click();
      await page.waitForChanges();
      const closingBtn = tf?.querySelector('[part="calendar-button"]') as
        | (HTMLElement & { variant?: string })
        | null;
      expect(page.rootInstance.panelClosing).toBe(true);
      expect(closingBtn?.variant).toBe('standard');
      expect(closingBtn?.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens the year menu, hides the day grid, and marks the current year', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeNull();
      expect(shadow(page)?.querySelector('[part="cancel-button"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="ok-button"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="selection-divider"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('.md-date-picker__body--docked-selection')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="year-menu-wrap"]')).toBeTruthy();
      const menuWrap = shadow(page)?.querySelector('[part="year-menu-wrap"]');
      expect(menuWrap?.classList.contains('md-date-picker__selection-menu-wrap--bloom-out')).toBe(
        false,
      );
      const menu = shadow(page)?.querySelector('[part="year-menu"]');
      expect(menu?.tagName).toBe('MD-MENU');
      expect(menu?.shadowRoot?.querySelector('.md-menu__scroll-shadow')).toBeTruthy();
      const selected = shadow(page)?.querySelector(
        'md-menu-item[part~="year-option-selected"]',
      ) as (HTMLElement & { headline?: string; selected?: boolean; type?: string; checkPosition?: string }) | null;
      expect(selected?.headline).toBe('2025');
      expect(selected?.selected).toBe(true);
      expect(selected?.type).toBe('radio');
      expect(selected?.checkPosition).toBe('start');
    });

    it('animates menu bloom-out when toggling the year menu closed', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.yearMenuOpen).toBe(true);
      btn.click();
      await page.waitForChanges();
      expect(page.rootInstance.selectionMenuClosing).toBe('year');
      const wrap = shadow(page)?.querySelector('[part="year-menu-wrap"]');
      expect(wrap?.classList.contains('md-date-picker__selection-menu-wrap--bloom-out')).toBe(
        true,
      );
      await new Promise((r) => setTimeout(r, SELECTION_CLOSE_MS));
      await page.waitForChanges();
      expect(page.rootInstance.yearMenuOpen).toBe(false);
      expect(page.rootInstance.selectionMenuClosing).toBeNull();
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeTruthy();
    });

    it('blooms in the day grid after a year is selected', async () => {
      const page = await dockedOpen();
      const btn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      btn.click();
      await page.waitForChanges();
      const options = shadow(page)?.querySelectorAll('md-menu-item[part~="year-option"]');
      const target = Array.from(options ?? []).find(
        (el) => (el as HTMLElement & { headline?: string }).headline === '2010',
      ) as HTMLElement;
      target.click();
      await new Promise((r) => setTimeout(r, SELECTION_CLOSE_MS + 200));
      await page.waitForChanges();
      const calendar = shadow(page)?.querySelector('[part="calendar"]');
      expect(calendar?.classList.contains('md-date-picker__calendar--docked-bloom-in')).toBe(
        true,
      );
      expect(page.rootInstance.dockedCalendarBloom).toBe(true);
    });

    it('exports the month menu viewport part via exportparts', async () => {
      const page = await dockedOpen();
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      const menu = shadow(page)?.querySelector('[part="month-menu"]') as HTMLElement;
      const parts = menu?.getAttribute('exportparts') ?? '';
      expect(parts).toContain('month-menu-viewport');
    });

    it('keeps year menu option range stable when selecting a year', async () => {
      const page = await dockedOpen();
      (shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      const optionsBefore = shadow(page)?.querySelectorAll(
        'md-menu-item[part~="year-option"]',
      );
      const countBefore = optionsBefore?.length ?? 0;
      const firstBefore = (optionsBefore?.[0] as HTMLElement & { headline?: string })
        ?.headline;
      const lastBefore = (
        optionsBefore?.[optionsBefore.length - 1] as HTMLElement & { headline?: string }
      )?.headline;
      expect(countBefore).toBe(201);
      expect(firstBefore).toBe('1925');
      expect(lastBefore).toBe('2125');

      const target = Array.from(optionsBefore ?? []).find(
        (el) => (el as HTMLElement & { headline?: string }).headline === '2010',
      ) as HTMLElement;
      target.click();
      await page.waitForChanges();

      const optionsAfter = shadow(page)?.querySelectorAll(
        'md-menu-item[part~="year-option"]',
      );
      expect(optionsAfter?.length).toBe(countBefore);
      expect((optionsAfter?.[0] as HTMLElement & { headline?: string })?.headline).toBe(
        firstBefore,
      );
      expect(
        (optionsAfter?.[optionsAfter.length - 1] as HTMLElement & { headline?: string })
          ?.headline,
      ).toBe(lastBefore);

      await new Promise((r) => setTimeout(r, 400));
      await page.waitForChanges();
      expect(page.rootInstance.viewYear).toBe(2010);
    });

    it('prev / next month chevrons change the view month', async () => {
      const page = await dockedOpen();
      expect(page.rootInstance.viewMonth).toBe(7); // August
      (shadow(page)?.querySelector('[part="prev-month-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.viewMonth).toBe(6);
      (shadow(page)?.querySelector('[part="next-month-button"]') as HTMLButtonElement).click();
      (shadow(page)?.querySelector('[part="next-month-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.viewMonth).toBe(8);
    });

    it('prev / next year chevrons change the view year', async () => {
      const page = await dockedOpen();
      expect(page.rootInstance.viewYear).toBe(2025);
      (shadow(page)?.querySelector('[part="prev-year-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.viewYear).toBe(2024);
      (shadow(page)?.querySelector('[part="next-year-button"]') as HTMLButtonElement).click();
      (shadow(page)?.querySelector('[part="next-year-button"]') as HTMLButtonElement).click();
      await page.waitForChanges();
      expect(page.rootInstance.viewYear).toBe(2026);
    });

    it('does not show selection divider or docked-below-nav when day grid is visible', async () => {
      const page = await dockedOpen();
      expect(shadow(page)?.querySelector('[part="docked-below-nav"]')).toBeNull();
      expect(shadow(page)?.querySelector('[part="selection-divider"]')).toBeNull();
    });

    it('distinguishes selected / outside / unselected day-cell states', async () => {
      const page = await dockedOpen();
      const sh = shadow(page);
      // selected (filled) — the staged value 2025-08-17
      expect(sh?.querySelector('[data-date="2025-08-17"]')?.getAttribute('part')).toContain(
        'day-selected',
      );
      // outside month (muted) — a July trailing day in the grid
      expect(sh?.querySelector('[part~="day-outside"]')).toBeTruthy();
      // unselected in-month box — a plain August day
      expect(sh?.querySelector('[data-date="2025-08-10"]')?.getAttribute('part')).toContain(
        'day-unselected',
      );
    });

    it("marks today's cell with the day-today (ring) part", async () => {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const page = await create(
        `<md-date-picker variant="docked" value="${iso}" open></md-date-picker>`,
      );
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector(`[data-date="${iso}"]`);
      expect(cell?.getAttribute('part')).toContain('day-today');
    });

    it('accepts day-selected-shape and day-today-shape host vars for customization', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-08-17" open style="--md-date-picker-day-selected-shape: 0px; --md-date-picker-day-today-shape: 12px;"></md-date-picker>',
      );
      await page.waitForChanges();
      expect(
        page.root?.style.getPropertyValue('--md-date-picker-day-selected-shape').trim(),
      ).toBe('0px');
      expect(
        page.root?.style.getPropertyValue('--md-date-picker-day-today-shape').trim(),
      ).toBe('12px');
      expect(shadow(page)?.querySelector('[data-date="2025-08-17"]')).toBeTruthy();
    });
  });

  describe('input mode toggle', () => {
    it('emits mdModeChange with mode input when switching to text entry', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      const modeSpy = jest.fn();
      page.root?.addEventListener('mdModeChange', modeSpy);
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      expect(modeSpy).toHaveBeenCalledTimes(1);
      expect(modeSpy.mock.calls[0][0].detail).toEqual({ mode: 'input' });
    });

    it('emits mdModeChange with mode calendar when switching back from text entry', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const modeSpy = jest.fn();
      page.root?.addEventListener('mdModeChange', modeSpy);
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      toggle.click();
      await page.waitForChanges();
      expect(modeSpy).toHaveBeenCalledTimes(2);
      expect(modeSpy.mock.calls[0][0].detail).toEqual({ mode: 'input' });
      expect(modeSpy.mock.calls[1][0].detail).toEqual({ mode: 'calendar' });
    });

    it('does not emit mdModeChange when switching back fails validation', async () => {
      const page = await create('<md-date-picker variant="modal-input" open></md-date-picker>');
      await page.waitForChanges();
      const modeSpy = jest.fn();
      page.root?.addEventListener('mdModeChange', modeSpy);
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as HTMLElement;
      entry.dispatchEvent(new CustomEvent('mdInput', { detail: 'not-a-date', bubbles: true }));
      await page.waitForChanges();
      toggle.click();
      await page.waitForChanges();
      expect(modeSpy).toHaveBeenCalledTimes(1);
      expect(modeSpy.mock.calls[0][0].detail).toEqual({ mode: 'input' });
      expect(shadow(page)?.querySelector('[part="entry-input"]')).toBeTruthy();
    });

    it('does not emit mdModeChange on open (programmatic reset)', async () => {
      const page = await create('<md-date-picker variant="modal-input" open></md-date-picker>');
      await page.waitForChanges();
      const modeSpy = jest.fn();
      page.root?.addEventListener('mdModeChange', modeSpy);
      page.rootInstance.open = false;
      await page.waitForChanges();
      page.rootInstance.open = true;
      await page.waitForChanges();
      expect(modeSpy).not.toHaveBeenCalled();
    });

    it('switches the dialog to a typed-entry field', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="entry-input"]')).toBeTruthy();
    });

    it('shows "Enter dates" headline and outlined entry field in input mode', async () => {
      const page = await create('<md-date-picker label="Date" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="headline"]')?.textContent).toBe('Enter dates');
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as
        | (HTMLElement & { placeholder?: string })
        | null;
      expect(entry?.tagName.toLowerCase()).toBe('md-text-field');
      expect(entry?.placeholder).toBe('MM/DD/YYYY');
    });

    it('formats flexible input on Enter in modal input mode', async () => {
      const page = await create('<md-date-picker variant="modal-input" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as HTMLElement;
      entry.dispatchEvent(new CustomEvent('mdInput', { detail: '1/5/2025', bubbles: true }));
      await page.waitForChanges();
      entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitForPanelClose(page);
      expect(page.rootInstance.error).toBe(false);
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(page.rootInstance.open).toBe(false);
    });

    it('formats flexible input on Enter from entry md-text-field shadow input', async () => {
      const page = await create('<md-date-picker variant="modal-input" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as HTMLElement;
      const input = entry.shadowRoot?.querySelector('.md-text-field__input') as HTMLInputElement;
      input.value = '06122025';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await page.waitForChanges();
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
      );
      await waitForPanelClose(page);
      expect(page.rootInstance.error).toBe(false);
      expect(page.rootInstance.value).toBe('2025-06-12');
      expect(page.rootInstance.open).toBe(false);
    });

    it('shows error for invalid input on Enter in modal input mode', async () => {
      const page = await create('<md-date-picker variant="modal-input" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as HTMLElement;
      entry.dispatchEvent(new CustomEvent('mdInput', { detail: 'not-a-date', bubbles: true }));
      await page.waitForChanges();
      entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.error).toBe(true);
      expect(page.rootInstance.value).toBe('');
      expect(page.rootInstance.open).toBe(true);
    });

    it('commits parsed input on Enter and closes modal', async () => {
      const page = await create('<md-date-picker variant="modal-input" open></md-date-picker>');
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as HTMLElement;
      entry.dispatchEvent(new CustomEvent('mdInput', { detail: '1/5/2025', bubbles: true }));
      await page.waitForChanges();
      entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitForPanelClose(page);
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(page.rootInstance.open).toBe(false);
      expect(changeSpy).toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('moves the focused day with ArrowRight', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const grid = shadow(page)?.querySelector('[part="grid"]') as HTMLElement;
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-06-16');
      expect(grid).toBeTruthy();
    });

    it('Home moves focus to the first day of the month', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-06-01');
    });

    it('End moves focus to the last day of the month', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-06-30');
    });

    it('PageUp moves to the same day in the previous month', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-05-15');
    });

    it('PageDown clamps same-day navigation across short months (Jan 31 → Feb 28)', async () => {
      const page = await create('<md-date-picker value="2025-01-31" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-01-31"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-02-28');
    });

    it('PageUp from the panel navigates when focus is on a nav control', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      panel.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-05-15');
    });

    it('PageUp works after clicking non-focusable docked panel chrome', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const grid = shadow(page)?.querySelector('[part="grid"]') as HTMLElement;
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      expect(grid).toBeTruthy();
      expect(panel).toBeTruthy();
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(down, 'target', { value: grid });
      panel.dispatchEvent(down);
      await page.waitForChanges();
      page.rootInstance.handleDocumentKeyDown(
        new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-05-15');
    });

    it('Shift+M works after clicking non-focusable docked panel chrome', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const weekdays = shadow(page)?.querySelector('[part="weekdays"]') as HTMLElement;
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      expect(weekdays).toBeTruthy();
      expect(panel).toBeTruthy();
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(down, 'target', { value: weekdays });
      panel.dispatchEvent(down);
      await page.waitForChanges();
      page.rootInstance.handleDocumentKeyDown(
        new KeyboardEvent('keydown', {
          key: 'M',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="month-menu"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="calendar"]')).toBeNull();
    });

    it('PageUp from a nested nav chevron (shadow DOM) navigates the day grid', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const chevron = shadow(page)?.querySelector(
        '[part="prev-month-button"]',
      ) as HTMLElement;
      expect(chevron).toBeTruthy();
      chevron.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true, composed: true }),
      );
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-05-15');
    });

    it('PageUp via host capture when focus is on the docked trigger input', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      const input = tf?.shadowRoot?.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      const ev = new KeyboardEvent('keydown', {
        key: 'PageUp',
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(ev, 'target', { value: input });
      page.rootInstance.handleHostKeyDown(ev);
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-05-15');
    });

    it('Alt+ArrowUp maps to PageUp (Mac compact-keyboard fallback)', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          altKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-05-15');
    });

    it('PageUp is recognized when only KeyboardEvent.code is set', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'PageUp', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2025-05-15');
    });

    it('Shift+PageDown moves to the same day next year', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'PageDown', shiftKey: true, bubbles: true }),
      );
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]');
      expect(focused?.getAttribute('data-date')).toBe('2026-06-15');
    });

    it('Enter on the day grid commits and closes (modal-input)', async () => {
      const page = await create(
        '<md-date-picker variant="modal-input" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]') as HTMLElement;
      expect(focused?.getAttribute('data-date')).toBe('2025-06-16');
      focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitForPanelClose(page);
      expect(page.rootInstance.value).toBe('2025-06-16');
      expect(page.rootInstance.open).toBe(false);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { value: '2025-06-16', date: expect.any(Date) } }),
      );
    });

    it('Enter on the day grid commits and closes (docked)', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      let focused = shadow(page)?.querySelector('[tabindex="0"][data-date]') as HTMLElement;
      for (let i = 0; i < 5; i++) {
        focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await page.waitForChanges();
        focused = shadow(page)?.querySelector('[tabindex="0"][data-date]') as HTMLElement;
      }
      expect(focused.getAttribute('data-date')).toBe('2025-06-20');
      focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitForPanelClose(page);
      expect(page.rootInstance.value).toBe('2025-06-20');
      expect(page.rootInstance.open).toBe(false);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { value: '2025-06-20', date: expect.any(Date) } }),
      );
    });

    it('Enter on the day grid commits and closes (modal)', async () => {
      const page = await create(
        '<md-date-picker variant="modal" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await page.waitForChanges();
      const focused = shadow(page)?.querySelector('[tabindex="0"][data-date]') as HTMLElement;
      focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await waitForPanelClose(page);
      expect(page.rootInstance.value).toBe('2025-06-16');
      expect(page.rootInstance.open).toBe(false);
      expect(spy).toHaveBeenCalled();
    });

    it('Enter on modal prev chevron navigates month without closing', async () => {
      const page = await create(
        '<md-date-picker variant="modal-input" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const prev = shadow(page)?.querySelector('[part="prev-button"]') as HTMLElement;
      prev.focus();
      prev.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(page.rootInstance.viewMonth).toBe(4);
      expect(changeSpy).not.toHaveBeenCalled();
    });

    it('Enter on docked month menu button toggles menu without closing', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      monthBtn.focus();
      monthBtn.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(shadow(page)?.querySelector('[part="month-menu"]')).toBeTruthy();
      expect(changeSpy).not.toHaveBeenCalled();
    });

    it('Enter on modal month/year toggle opens year grid without closing', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const toggle = shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement;
      toggle.focus();
      toggle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(page.rootInstance.viewMode).toBe('year');
      expect(changeSpy).not.toHaveBeenCalled();
    });

    it('Enter on panel with nav focus does not commit day selection', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const prev = shadow(page)?.querySelector('[part="prev-month-button"]') as HTMLElement;
      prev.focus();
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      panel.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
      expect(changeSpy).not.toHaveBeenCalled();
    });

    it('Shift+M opens the docked month menu from the day grid', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'M', shiftKey: true, bubbles: true }),
      );
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="month-menu"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="calendar"]')).toBeNull();
    });

    it('Shift+M opens the docked month menu from the panel when focus is on nav', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      panel.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'm',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="month-menu"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="calendar"]')).toBeNull();
    });

    it('Shift+M opens the docked month menu from the trigger field while open', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      const input = tf?.shadowRoot?.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      const ev = new KeyboardEvent('keydown', {
        key: 'M',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(ev, 'target', { value: input });
      page.rootInstance.handleHostKeyDown(ev);
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="month-menu"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="calendar"]')).toBeNull();
    });

    it('Shift+Y opens the docked year menu from the day grid', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      cell.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Y', shiftKey: true, bubbles: true }),
      );
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="year-menu"]')).toBeTruthy();
      expect(shadow(page)?.querySelector('[part="calendar"]')).toBeNull();
    });

    it('Shift+M closes the docked month menu when already open', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      const shiftM = () =>
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'M', shiftKey: true, bubbles: true }),
        );
      shiftM();
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(true);
      shiftM();
      await page.waitForChanges();
      expect(page.rootInstance.selectionMenuClosing).toBe('month');
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(false);
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeTruthy();
    });

    it('Shift+M restores focus to the month menu button when closing', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      const focusSpy = jest.spyOn(monthBtn, 'focus');
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      const shiftM = () =>
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'M', shiftKey: true, bubbles: true }),
        );
      shiftM();
      await page.waitForChanges();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      focusSpy.mockClear();
      shiftM();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(page.rootInstance.monthMenuOpen).toBe(false);
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('Shift+M with month menu open does not jump view to March', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      expect(page.rootInstance.viewMonth).toBe(5); // June

      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      const shiftM = () =>
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'M', shiftKey: true, bubbles: true }),
        );

      shiftM();
      await page.waitForChanges();
      expect(page.rootInstance.monthMenuOpen).toBe(true);

      shiftM();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();

      expect(page.rootInstance.viewMonth).toBe(5);
      expect(page.rootInstance.monthMenuOpen).toBe(false);
    });

    it('Shift+Y closes the docked year menu when already open', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open min="1900-01-01" max="2100-12-31"></md-date-picker>',
      );
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      const shiftY = () =>
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Y', shiftKey: true, bubbles: true }),
        );
      shiftY();
      await page.waitForChanges();
      expect(page.rootInstance.yearMenuOpen).toBe(true);
      shiftY();
      await page.waitForChanges();
      expect(page.rootInstance.selectionMenuClosing).toBe('year');
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      expect(page.rootInstance.yearMenuOpen).toBe(false);
      expect(shadow(page)?.querySelector('[part="grid"]')).toBeTruthy();
    });

    it('Shift+Y restores focus to the year menu button when closing', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open min="1900-01-01" max="2100-12-31"></md-date-picker>',
      );
      await page.waitForChanges();
      const yearBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      const focusSpy = jest.spyOn(yearBtn, 'focus');
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]') as HTMLElement;
      const shiftY = () =>
        cell.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Y', shiftKey: true, bubbles: true }),
        );
      shiftY();
      await page.waitForChanges();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      focusSpy.mockClear();
      shiftY();
      await page.waitForChanges();
      await new Promise((r) => setTimeout(r, 250));
      await page.waitForChanges();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(page.rootInstance.yearMenuOpen).toBe(false);
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('Escape requests dismiss', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('text-field entry (docked / modal-input)', () => {
    it('docked trigger renders the shared md-text-field (outlined)', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      await page.waitForChanges();
      const tf = shadow(page)?.querySelector('md-text-field') as
        | (HTMLElement & { variant?: string })
        | null;
      expect(tf).toBeTruthy();
      expect(tf?.variant).toBe('outlined');
      // trailing calendar icon button lives in the field
      expect(tf?.querySelector('[part="calendar-button"]')).toBeTruthy();
    });

    it('renders filled field variant when field-variant="filled"', async () => {
      const page = await create(
        '<md-date-picker field-variant="filled" value="2025-06-15"></md-date-picker>',
      );
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement & { variant?: string };
      expect(tf?.variant).toBe('filled');
    });

    it('exposes field part on the trigger md-text-field', async () => {
      const page = await create('<md-date-picker></md-date-picker>');
      await page.waitForChanges();
      expect(textField(page)?.getAttribute('part')).toBe('field');
    });

    it('trigger gets appear-focused while the panel is open', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      expect(textField(page)?.hasAttribute('appear-focused')).toBe(true);
    });

    it('trigger does NOT have appear-focused while the panel is closed', async () => {
      const page = await create('<md-date-picker></md-date-picker>');
      await page.waitForChanges();
      expect(textField(page)?.hasAttribute('appear-focused')).toBe(false);
    });

    it('keeps trigger field visually focused while panel is open', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      expect(textField(page)?.classList.contains('md-text-field--focused')).toBe(true);
    });

    it('exposes independent resting and focus field colour tokens on the host', async () => {
      const page = await create(
        '<md-date-picker style="--md-date-picker-field-color: red; --md-date-picker-field-focus-color: blue;"></md-date-picker>',
      );
      await page.waitForChanges();
      expect(page.root?.style.getPropertyValue('--md-date-picker-field-color').trim()).toBe('red');
      expect(page.root?.style.getPropertyValue('--md-date-picker-field-focus-color').trim()).toBe(
        'blue',
      );
    });

    it('host gains md-date-picker--open while panel is open', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-date-picker--open')).toBe(true);
    });

    it('shows trailing calendar toggle on first paint (modal-input)', async () => {
      const page = await create(
        '<md-date-picker variant="modal-input" value="2025-06-15"></md-date-picker>',
      );
      const tf = textField(page);
      const wrapper = tf?.shadowRoot?.querySelector(
        '.md-text-field__trailing-icon-button',
      ) as HTMLElement | null;
      expect(wrapper).toBeTruthy();
      expect(wrapper?.style.display).not.toBe('none');
      const btn = calendarButton(page) as HTMLElement & { icon?: string };
      expect(btn?.icon).toBe('calendar_today');
    });

    it('docked field shows formatted preset value on initial load', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15"></md-date-picker>',
      );
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      const input = tf?.shadowRoot?.querySelector(
        '.md-text-field__input',
      ) as HTMLInputElement;
      expect(input?.value).toMatch(/06[/.]15[/.]2025/);
      expect(page.rootInstance.inputDraft).toMatch(/06[/.]15[/.]2025/);
    });

    it('re-emits mdInput when the docked text-field input changes', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '2025-06-15', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('modal-input uses the shared md-text-field trigger', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', spy);
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '2025-06-15', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('marks modal-input calendar trigger active while panel is open', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      await page.waitForChanges();
      const closedBtn = calendarButton(page);
      expect(closedBtn?.variant).toBe('standard');
      expect(closedBtn?.getAttribute('aria-expanded')).toBe('false');

      closedBtn!.click();
      await page.waitForChanges();
      const openBtn = calendarButton(page);
      expect(page.rootInstance.open).toBe(true);
      expect(openBtn?.variant).toBe('tonal');
      expect(openBtn?.getAttribute('aria-expanded')).toBe('true');
      expect(openBtn?.classList.contains('md-icon-button--tonal')).toBe(true);
    });

    it('modal-input keeps raw typed value until blur', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '1/5/2025', bubbles: true }));
      await page.waitForChanges();
      expect(textFieldInput(page)?.value).toBe('1/5/2025');
      expect(page.rootInstance.value).toBe('');
    });

    it('modal-input formats flexible input on blur', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '1/5/2025', bubbles: true }));
      tf.dispatchEvent(new CustomEvent('mdChange', { detail: '1/5/2025', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(changeSpy).toHaveBeenCalled();
      expect(textFieldInput(page)?.value).toMatch(/01[/.]05[/.]2025/);
      expect(page.rootInstance.error).toBe(false);
    });

    it('modal-input commits flexible input on Enter', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '01-05-2025', bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-01-05');
    });

    it('modal-input commits typed input on Enter while calendar is open', async () => {
      const page = await create('<md-date-picker variant="modal-input" open></md-date-picker>');
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '1/5/2025', bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(page.rootInstance.error).toBe(false);
      expect(page.rootInstance.open).toBe(true);
      expect(textFieldInput(page)?.value).toMatch(/01[/.]05[/.]2025/);
    });

    it('modal-input shows error for invalid typed input on blur', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: 'not-a-date', bubbles: true }));
      tf.dispatchEvent(new CustomEvent('mdChange', { detail: 'not-a-date', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.error).toBe(true);
      expect(page.rootInstance.value).toBe('');
    });

    it('docked text-field formats flexible input on mdChange (blur)', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '1.5.2025', bubbles: true }));
      tf.dispatchEvent(new CustomEvent('mdChange', { detail: '1.5.2025', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(changeSpy).toHaveBeenCalled();
      expect(page.rootInstance.error).toBe(false);
    });

    it('docked text-field commits 8-digit compact input on blur', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '06122025', bubbles: true }));
      tf.dispatchEvent(new CustomEvent('mdChange', { detail: '06122025', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-06-12');
      expect(changeSpy).toHaveBeenCalled();
      expect(page.rootInstance.error).toBe(false);
    });

    it('modal-input commits 8-digit compact input on Enter', async () => {
      const page = await create('<md-date-picker variant="modal-input"></md-date-picker>');
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '06122025', bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-06-12');
      expect(page.rootInstance.error).toBe(false);
      expect(textFieldInput(page)?.value).toMatch(/06[/.]12[/.]2025/);
    });

    it('docked commits flexible input on Enter', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '1/5/2025', bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(page.rootInstance.error).toBe(false);
      expect(changeSpy).toHaveBeenCalled();
    });

    it('docked commits typed input on Enter from md-text-field shadow input', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      const input = tf.shadowRoot?.querySelector('.md-text-field__input') as HTMLInputElement;
      input.dispatchEvent(new Event('focus', { bubbles: true }));
      await page.waitForChanges();
      input.value = '06122025';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await page.waitForChanges();
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-06-12');
      expect(page.rootInstance.error).toBe(false);
      expect(changeSpy).toHaveBeenCalled();
      expect(input.value).toMatch(/06[/.]12[/.]2025/);
    });

    it('docked Enter formats display while calendar stays open', async () => {
      const page = await create('<md-date-picker variant="docked" open></md-date-picker>');
      await page.waitForChanges();
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      const input = tf.shadowRoot?.querySelector('.md-text-field__input') as HTMLInputElement;
      input.dispatchEvent(new Event('focus', { bubbles: true }));
      await page.waitForChanges();
      input.value = '1/5/2025';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await page.waitForChanges();
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(page.rootInstance.open).toBe(true);
      expect(input.value).toMatch(/01[/.]05[/.]2025/);
    });

    it('docked commits 8-digit compact input on Enter', async () => {
      const page = await create('<md-date-picker variant="docked"></md-date-picker>');
      await page.waitForChanges();
      const tf = shadow(page)?.querySelector('md-text-field') as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '06122025', bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-06-12');
      expect(page.rootInstance.error).toBe(false);
    });
  });

  describe('accessibility', () => {
    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-date-picker disabled></md-date-picker>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('calendar trigger advertises a dialog popup', async () => {
      const page = await create('<md-date-picker></md-date-picker>');
      expect(calendarButton(page)?.getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('day cells expose accessible labels and gridcell role', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector('[data-date="2025-06-15"]');
      expect(cell?.getAttribute('role')).toBe('gridcell');
      expect(cell?.getAttribute('aria-label')).toBeTruthy();
    });

    it('marks today with aria-current', async () => {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const page = await create(`<md-date-picker value="${iso}" open></md-date-picker>`);
      await page.waitForChanges();
      const cell = shadow(page)?.querySelector(`[data-date="${iso}"]`);
      expect(cell?.getAttribute('aria-current')).toBe('date');
    });

    it('docked nav chevrons expose shortcut hints via md-tooltip aria-description', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const prevYear = shadow(page)?.querySelector('[part="prev-year-button"]') as HTMLElement;
      const nextMonth = shadow(page)?.querySelector('[part="next-month-button"]') as HTMLElement;
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      const yearBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      expect(prevYear?.getAttribute('aria-label')).toBe('Previous year');
      expect(nextMonth?.getAttribute('aria-label')).toBe('Next month');
      expect(prevYear?.getAttribute('aria-description')).toBe('Previous year (Shift+Page Up)');
      expect(nextMonth?.getAttribute('aria-description')).toBe('Next month (Page Down)');
      expect(monthBtn?.getAttribute('aria-description')).toBe('June · Choose month (Shift+M)');
      expect(yearBtn?.getAttribute('aria-description')).toBe('Choose year (Shift+Y)');
    });

    it('docked menu button tooltips widen plain popup for full shortcut text', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-08-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      const yearBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      const monthTooltip = monthBtn.closest('md-tooltip') as HTMLElement & {
        open: boolean;
        showDelay: number;
      };
      const yearTooltip = yearBtn.closest('md-tooltip') as HTMLElement & {
        open: boolean;
        showDelay: number;
      };
      expect(monthTooltip.classList.contains('md-date-picker__menu-button-tooltip')).toBe(true);
      expect(yearTooltip.classList.contains('md-date-picker__menu-button-tooltip')).toBe(true);

      monthBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();
      expect(monthTooltip.open).toBe(true);
      expect(monthTooltip.shadowRoot?.querySelector('.md-tooltip__text')?.textContent).toBe(
        'August · Choose month (Shift+M)',
      );
    });

    it('modal nav chevrons expose month shortcut hints via md-tooltip aria-description', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const prev = shadow(page)?.querySelector('[part="prev-button"]') as HTMLElement;
      const next = shadow(page)?.querySelector('[part="next-button"]') as HTMLElement;
      expect(prev?.tagName).toBe('MD-ICON-BUTTON');
      expect(next?.tagName).toBe('MD-ICON-BUTTON');
      expect(prev?.getAttribute('aria-label')).toBe('Previous month');
      expect(next?.getAttribute('aria-label')).toBe('Next month');
      expect(prev?.getAttribute('aria-description')).toBe('Previous month (Page Up)');
      expect(next?.getAttribute('aria-description')).toBe('Next month (Page Down)');
    });

    it('modal panel exposes dialog role and aria-modal', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('role')).toBe('dialog');
      expect(panel?.getAttribute('aria-modal')).toBe('true');
      expect(panel?.getAttribute('aria-label')).toBe('Date');
    });

    it('docked panel exposes dialog role without aria-modal', async () => {
      const page = await create(
        '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
      );
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]');
      expect(panel?.getAttribute('role')).toBe('dialog');
      expect(panel?.getAttribute('aria-modal')).toBeNull();
    });

    it('typed-entry field exposes label and placeholder in input mode', async () => {
      const page = await create('<md-date-picker label="Birthday" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as
        | (HTMLElement & { label?: string; placeholder?: string })
        | null;
      expect(entry?.label).toBe('Birthday');
      expect(entry?.placeholder).toBe('MM/DD/YYYY');
      expect(shadow(page)?.querySelector('[part="headline"]')?.textContent).toBe('Enter dates');
    });

    it('typed-entry mode toggle exposes an accessible label', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLElement;
      expect(toggle?.getAttribute('aria-label')).toBe('Switch to text input');
      toggle.click();
      await page.waitForChanges();
      const toggleBack = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLElement;
      expect(toggleBack?.getAttribute('aria-label')).toBe('Switch to calendar input');
    });

    it('modal panel is a focusable dialog container', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]') as HTMLElement;
      expect(panel?.getAttribute('tabindex')).toBe('-1');
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      expect(focusables.length).toBeGreaterThan(2);
    });

    it('calendar trigger reflects expanded state while panel is open', async () => {
      const page = await create('<md-date-picker value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const btn = calendarButton(page);
      expect(btn?.getAttribute('aria-expanded')).toBe('true');
      expect(btn?.getAttribute('aria-label')).toBe('Close calendar');
    });
  });

  describe('i18n / localization', () => {
    it('keeps English label defaults when locale is set without explicit overrides', async () => {
      const page = await create('<md-date-picker locale="ja-JP" open></md-date-picker>');
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="supporting"]')?.textContent).toBe('Select date');
      expect(shadow(page)?.querySelector('[part="headline"]')?.textContent).toBe('Select date');
      expect(shadow(page)?.querySelector('[part="cancel-button"]')?.textContent?.trim()).toBe(
        'Cancel',
      );
      expect(shadow(page)?.querySelector('[part="ok-button"]')?.textContent?.trim()).toBe('OK');
      expect((textField(page) as HTMLElement & { label?: string })?.label).toBe('Date');
    });

    it('uses enter-dates-label prop in typed-entry mode', async () => {
      const page = await create(
        '<md-date-picker locale="ja-JP" enter-dates-label="日付を入力" open></md-date-picker>',
      );
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="headline"]')?.textContent).toBe('日付を入力');
    });

    it('derives locale-aware date format hint for trigger supporting text', async () => {
      const page = await create('<md-date-picker locale="de-DE"></md-date-picker>');
      const tf = textField(page) as HTMLElement & { supportingText?: string };
      expect(tf?.supportingText).toBe('DD.MM.YYYY');
    });

    it('derives locale-aware placeholder in modal input mode', async () => {
      const page = await create('<md-date-picker locale="de-DE" open></md-date-picker>');
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as
        | (HTMLElement & { placeholder?: string })
        | null;
      expect(entry?.placeholder).toBe('DD.MM.YYYY');
    });

    it('renders custom header and action label props in modal variant', async () => {
      const page = await create(`
        <md-date-picker
          variant="modal-input"
          open
          headline="日付を選択"
          select-date-label="日付を選択してください"
          enter-dates-label="日付を入力"
          cancel-label="キャンセル"
          ok-label="OK"
        ></md-date-picker>
      `);
      await page.waitForChanges();
      const supporting = shadow(page)?.querySelector('[part="supporting"]');
      const headline = shadow(page)?.querySelector('[part="headline"]');
      const cancelBtn = shadow(page)?.querySelector('[part="cancel-button"]');
      const okBtn = shadow(page)?.querySelector('[part="ok-button"]');
      expect(supporting?.textContent?.trim()).toBe('日付を選択');
      expect(headline?.textContent?.trim()).toBe('日付を選択してください');
      expect(cancelBtn?.textContent?.trim()).toBe('キャンセル');
      expect(okBtn?.textContent?.trim()).toBe('OK');

      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      expect(shadow(page)?.querySelector('[part="headline"]')?.textContent?.trim()).toBe(
        '日付を入力',
      );
    });

    it('respects custom label props for nav, actions, and toggles', async () => {
      const page = await create(`
        <md-date-picker
          variant="docked"
          locale="ro-RO"
          value="2025-06-15"
          open
          cancel-label="Anulează"
          ok-label="OK"
          previous-month-label="Luna anterioară"
          next-month-label="Luna următoare"
          previous-year-label="Anul anterior"
          next-year-label="Anul următor"
          choose-month-label="Alege luna"
          choose-year-label="Alege anul"
          open-calendar-label="Deschide calendarul"
          close-calendar-label="Închide calendarul"
          enter-dates-label="Introduceți datele"
          select-date-label="Selectați data"
          invalid-date-label="Dată invalidă"
        ></md-date-picker>
      `);
      await page.waitForChanges();
      const prevMonth = shadow(page)?.querySelector('[part="prev-month-button"]') as HTMLElement;
      const chooseMonth = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      const cancelBtn = shadow(page)?.querySelector('[part="cancel-button"]');
      const okBtn = shadow(page)?.querySelector('[part="ok-button"]');
      expect(prevMonth?.getAttribute('aria-label')).toBe('Luna anterioară');
      expect(chooseMonth?.getAttribute('aria-label')).toBe('Alege luna');
      expect(cancelBtn?.textContent?.trim()).toBe('Anulează');
      expect(okBtn?.textContent?.trim()).toBe('OK');
      expect(calendarButton(page)?.getAttribute('aria-label')).toBe('Închide calendarul');
    });

    it('uses custom label props in tooltip aria-description text', async () => {
      const page = await create(`
        <md-date-picker
          variant="docked"
          locale="ja-JP"
          value="2025-06-15"
          open
          previous-month-label="前の月"
          next-month-label="次の月"
          previous-year-label="前の年"
          next-year-label="次の年"
          choose-month-label="月を選択"
          choose-year-label="年を選択"
        ></md-date-picker>
      `);
      await page.waitForChanges();
      const prevMonth = shadow(page)?.querySelector('[part="prev-month-button"]') as HTMLElement;
      const prevYear = shadow(page)?.querySelector('[part="prev-year-button"]') as HTMLElement;
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      const yearBtn = shadow(page)?.querySelector('[part="year-menu-button"]') as HTMLElement;
      expect(prevMonth?.getAttribute('aria-description')).toBe('前の月 (Page Up)');
      expect(prevYear?.getAttribute('aria-description')).toBe('前の年 (Shift+Page Up)');
      expect(monthBtn?.getAttribute('aria-description')).toBe('6月 · 月を選択 (Shift+M)');
      expect(yearBtn?.getAttribute('aria-description')).toBe('年を選択 (Shift+Y)');
    });

    it('uses custom toggle labels on modal mode-toggle tooltip', async () => {
      const page = await create(`
        <md-date-picker
          value="2025-06-15"
          open
          toggle-text-label="テキスト入力に切り替え"
          toggle-calendar-label="カレンダー入力に切り替え"
        ></md-date-picker>
      `);
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLElement;
      const tooltip = toggle?.closest('md-tooltip') as (HTMLElement & { text?: string }) | null;
      expect(tooltip).toBeTruthy();
      expect(toggle?.getAttribute('aria-label')).toBe('テキスト入力に切り替え');
      expect(tooltip?.text).toBe('テキスト入力に切り替え');
      toggle.click();
      await page.waitForChanges();
      expect(toggle?.getAttribute('aria-label')).toBe('カレンダー入力に切り替え');
      expect(tooltip?.text).toBe('カレンダー入力に切り替え');
    });

    it('uses choose-month-and-year-label in modal month/year nav tooltip', async () => {
      const page = await create(`
        <md-date-picker
          locale="ja-JP"
          value="2025-06-15"
          open
          choose-month-and-year-label="月と年を選択"
        ></md-date-picker>
      `);
      await page.waitForChanges();
      const monthToggle = shadow(page)?.querySelector('[part="month-toggle"]') as HTMLElement;
      const tooltip = monthToggle?.closest('md-tooltip') as (HTMLElement & { text?: string }) | null;
      expect(tooltip?.text).toMatch(/月と年を選択$/);
    });

    it('uses invalid-date-label when typed input cannot be parsed', async () => {
      const page = await create(
        '<md-date-picker invalid-date-label="Dată invalidă" open></md-date-picker>',
      );
      await page.waitForChanges();
      const toggle = shadow(page)?.querySelector('[part="mode-toggle"]') as HTMLButtonElement;
      toggle.click();
      await page.waitForChanges();
      const entry = shadow(page)?.querySelector('[part="entry-input"]') as HTMLElement;
      entry.dispatchEvent(new CustomEvent('mdInput', { detail: 'not-a-date', bubbles: true }));
      await page.waitForChanges();
      entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.error).toBe(true);
      expect(page.rootInstance.errorText).toBe('Dată invalidă');
    });

    it('formats weekday and month names via locale', async () => {
      const page = await create('<md-date-picker locale="fr-FR" value="2025-06-15" open></md-date-picker>');
      await page.waitForChanges();
      const grid = shadow(page)?.querySelector('[part="calendar"]') as HTMLElement;
      expect(grid?.getAttribute('aria-label')).toMatch(/juin/i);
    });
  });

  describe('parts', () => {
    it('exposes field parts', async () => {
      const page = await create('<md-date-picker></md-date-picker>');
      const sh = shadow(page);
      expect(sh?.querySelector('[part="field"]')).toBeTruthy();
      expect(textField(page)).toBeTruthy();
      expect(textFieldInput(page)).toBeTruthy();
      expect(calendarButton(page)).toBeTruthy();
    });

    it('exposes dialog parts when open', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      const sh = shadow(page);
      expect(sh?.querySelector('[part="scrim"]')).toBeTruthy();
      expect(sh?.querySelector('[part="panel"]')).toBeTruthy();
      expect(sh?.querySelector('[part="header"]')).toBeTruthy();
      expect(sh?.querySelector('[part="headline"]')).toBeTruthy();
      expect(sh?.querySelector('[part="body"]')).toBeTruthy();
      expect(sh?.querySelector('[part="actions"]')).toBeTruthy();
    });
  });

  describe('panel dimensions', () => {
    it('accepts panel width and max block-size CSS custom properties', async () => {
      const page = await create(
        '<md-date-picker style="--md-date-picker-panel-width: 400px; --md-date-picker-panel-max-block-size: 600px;" open></md-date-picker>',
      );
      expect(page.root).toBeTruthy();
      const panel = shadow(page)?.querySelector('[part="panel"]');
      expect(panel).toBeTruthy();
    });

    it('modal panel renders header, flex body, and actions', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      const panel = shadow(page)?.querySelector('[part="panel"]');
      const header = shadow(page)?.querySelector('[part="header"]');
      const body = shadow(page)?.querySelector('.md-date-picker__body');
      const calendar = shadow(page)?.querySelector('.md-date-picker__calendar');
      const actions = shadow(page)?.querySelector('[part="actions"]');
      expect(panel).not.toHaveClass('md-date-picker__panel--docked');
      expect(header).toBeTruthy();
      expect(body).toBeTruthy();
      expect(calendar).toBeTruthy();
      expect(actions).toBeTruthy();
      expect(header?.nextElementSibling).toBe(body);
      expect(body?.nextElementSibling).toBe(actions);
    });

    it('renders modal nav chevrons as md-icon-button', async () => {
      const page = await create('<md-date-picker open></md-date-picker>');
      await page.waitForChanges();
      const prev = shadow(page)?.querySelector('[part="prev-button"]');
      const next = shadow(page)?.querySelector('[part="next-button"]');
      expect(prev?.tagName).toBe('MD-ICON-BUTTON');
      expect(next?.tagName).toBe('MD-ICON-BUTTON');
    });

    it('renders docked panel with docked modifier class', async () => {
      const page = await create('<md-date-picker variant="docked" open></md-date-picker>');
      await page.waitForChanges();
      const panel = shadow(page)?.querySelector('[part="panel"]');
      expect(panel).toHaveClass('md-date-picker__panel--docked');
    });
  });

  describe('slots', () => {
    it('renders named header / actions / leading-icon slots', async () => {
      const page = await newSpecPage({
        components: [MdDatePicker],
        html: `<md-date-picker open><span slot="header">H</span><span slot="actions">A</span><svg slot="leading-icon"></svg></md-date-picker>`,
      });
      await page.waitForChanges();
      const sh = page.root?.shadowRoot;
      expect(sh?.querySelector('slot[name="header"]')).toBeTruthy();
      expect(sh?.querySelector('slot[name="actions"]')).toBeTruthy();
      expect(sh?.querySelector('slot[name="leading-icon"]')).toBeTruthy();
    });

    it('renders calendar-icon slot bridge on the trigger button', async () => {
      const page = await newSpecPage({
        components: [MdDatePicker],
        html: `<md-date-picker><svg slot="calendar-icon" id="cal-slot"></svg></md-date-picker>`,
      });
      await page.waitForChanges();
      const btn = calendarButton(page);
      const bridge = btn?.querySelector('slot[name="calendar-icon"]') as HTMLElement | null;
      expect(bridge).toBeTruthy();
      expect(bridge?.getAttribute('slot')).toBe('');
      expect(page.root?.querySelector('#cal-slot')).toBeTruthy();
    });
  });

  describe('calendar trigger icon', () => {
    it('renders calendar-icon prop on the trailing toggle', async () => {
      const page = await create('<md-date-picker calendar-icon="event"></md-date-picker>');
      const btn = calendarButton(page) as HTMLElement & { icon?: string };
      expect(btn?.icon).toBe('event');
    });

    it('defaults calendar-icon prop to calendar_today', async () => {
      const page = await create('<md-date-picker></md-date-picker>');
      const btn = calendarButton(page) as HTMLElement & { icon?: string };
      expect(btn?.icon).toBe('calendar_today');
    });

    it('renders prop-based icon glyph when no calendar-icon slot is provided', async () => {
      const page = await create('<md-date-picker calendar-icon="schedule"></md-date-picker>');
      const btn = calendarButton(page);
      const glyph = btn?.shadowRoot?.querySelector('.md-icon-button__icon-font');
      expect(glyph?.textContent?.trim()).toBe('schedule');
    });

    it('leading-icon slot does not suppress the calendar trigger icon', async () => {
      const page = await create(
        `<md-date-picker calendar-icon="event"><span slot="leading-icon">cake</span></md-date-picker>`,
      );
      await page.waitForChanges();
      const btn = calendarButton(page);
      const glyph = btn?.shadowRoot?.querySelector('.md-icon-button__icon-font');
      expect(glyph?.textContent?.trim()).toBe('event');
    });

    it('slot overrides calendar-icon prop on the trailing toggle', async () => {
      const page = await newSpecPage({
        components: [MdDatePicker],
        html: `<md-date-picker calendar-icon="event"><svg slot="calendar-icon" id="custom-cal"></svg></md-date-picker>`,
      });
      await page.waitForChanges();
      const btn = calendarButton(page) as HTMLElement & { icon?: string };
      expect(btn?.icon).toBeFalsy();
      expect(page.root?.querySelector('#custom-cal')).toBeTruthy();
      expect(
        btn?.shadowRoot?.querySelector('.md-icon-button__icon-font'),
      ).toBeFalsy();
    });

    it('exposes calendar-button part on the trailing toggle', async () => {
      const page = await create('<md-date-picker></md-date-picker>');
      expect(calendarButton(page)?.getAttribute('part')).toBe('calendar-button');
    });

    it('does not open when the leading-icon slot is clicked', async () => {
      const page = await create(
        `<md-date-picker><span slot="leading-icon">cake</span></md-date-picker>`,
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
      page.root?.querySelector('[slot="leading-icon"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
    });

    it('opens when the slotted calendar-icon trigger is clicked', async () => {
      const page = await create(
        `<md-date-picker><svg slot="calendar-icon" id="cal-slot"></svg></md-date-picker>`,
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(false);
      calendarButton(page)?.click();
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });

    it('opens when the calendar-button emits mdClick', async () => {
      const page = await create('<md-date-picker calendar-icon="event"></md-date-picker>');
      await page.waitForChanges();
      calendarButton(page)?.dispatchEvent(
        new CustomEvent('mdClick', { bubbles: true, composed: true, detail: { selected: false } }),
      );
      await page.waitForChanges();
      expect(page.rootInstance.open).toBe(true);
    });
  });

  describe('date separator', () => {
    it('displays value with slash separator', async () => {
      const page = await create(
        '<md-date-picker date-separator="/" value="2025-06-15"></md-date-picker>',
      );
      await page.waitForChanges();
      expect(textFieldInput(page)?.value).toBe('06/15/2025');
    });

    it('displays value with dot separator', async () => {
      const page = await create(
        '<md-date-picker date-separator="." locale="de-DE" value="2025-06-15"></md-date-picker>',
      );
      await page.waitForChanges();
      expect(textFieldInput(page)?.value).toBe('15.06.2025');
    });

    it('displays value with dash separator', async () => {
      const page = await create(
        '<md-date-picker date-separator="-" value="2025-06-15"></md-date-picker>',
      );
      await page.waitForChanges();
      expect(textFieldInput(page)?.value).toBe('06-15-2025');
    });

    it('shows format hint with custom separator in supporting text', async () => {
      const page = await create(
        '<md-date-picker date-separator="." locale="de-DE"></md-date-picker>',
      );
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement & { supportingText?: string };
      expect(tf?.supportingText).toBe('DD.MM.YYYY');
    });

    it('parses and formats with dot separator on blur', async () => {
      const page = await create(
        '<md-date-picker date-separator="." locale="de-DE"></md-date-picker>',
      );
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '15.06.2025', bubbles: true }));
      tf.dispatchEvent(new CustomEvent('mdChange', { detail: '15.06.2025', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-06-15');
      expect(textFieldInput(page)?.value).toBe('15.06.2025');
    });

    it('rejects slash input when dot separator is configured', async () => {
      const page = await create(
        '<md-date-picker date-separator="." locale="de-DE"></md-date-picker>',
      );
      await page.waitForChanges();
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '15/06/2025', bubbles: true }));
      tf.dispatchEvent(new CustomEvent('mdChange', { detail: '15/06/2025', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.error).toBe(true);
      expect(page.rootInstance.value).toBe('');
    });

    it('keeps ISO value on mdChange regardless of separator', async () => {
      const page = await create(
        '<md-date-picker date-separator="/" value="2025-06-15"></md-date-picker>',
      );
      await page.waitForChanges();
      const changeSpy = jest.fn();
      page.root?.addEventListener('mdChange', changeSpy);
      const tf = textField(page) as HTMLElement;
      tf.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await page.waitForChanges();
      tf.dispatchEvent(new CustomEvent('mdInput', { detail: '01/05/2025', bubbles: true }));
      tf.dispatchEvent(new CustomEvent('mdChange', { detail: '01/05/2025', bubbles: true }));
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('2025-01-05');
      expect(changeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { value: '2025-01-05', date: expect.any(Date) } }),
      );
    });

    it('reformats display when date-separator changes', async () => {
      const page = await create(
        '<md-date-picker value="2025-06-15"></md-date-picker>',
      );
      await page.waitForChanges();
      expect(textFieldInput(page)?.value).toMatch(/06[/.]15[/.]2025/);
      page.root!.setAttribute('date-separator', '-');
      await page.waitForChanges();
      expect(textFieldInput(page)?.value).toBe('06-15-2025');
    });
  });

  describe('RTL', () => {
    it('renders in an RTL context', async () => {
      const page = await newSpecPage({
        components: [MdDatePicker],
        html: `<div dir="rtl"><md-date-picker open></md-date-picker></div>`,
      });
      await page.waitForChanges();
      const dp = page.body.querySelector('md-date-picker');
      expect(dp).toBeTruthy();
      expect(dp?.shadowRoot?.querySelector('[part="prev-button"]')).toBeTruthy();
    });

    it('mirrors active docked menu caret in RTL', async () => {
      const page = await create(
        `<div dir="rtl"><md-date-picker variant="docked" value="2025-08-17" open></md-date-picker></div>`,
      );
      (shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement).click();
      await page.waitForChanges();
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement & {
        mirrorIcon?: boolean;
        trailingIcon?: string;
      };
      expect(monthBtn?.trailingIcon).toBe('arrow_drop_up');
      expect(monthBtn?.mirrorIcon).toBe(true);
      expect(monthBtn?.hasAttribute('mirror-icon')).toBe(true);
    });

    it('docked nav tooltips use physical left coords in RTL', async () => {
      const page = await create(
        `<div dir="rtl"><md-date-picker variant="docked" value="2025-06-15" open></md-date-picker></div>`,
      );
      await page.waitForChanges();
      const monthBtn = shadow(page)?.querySelector('[part="month-menu-button"]') as HTMLElement;
      const tooltip = monthBtn.closest('md-tooltip') as HTMLElement & { open: boolean };
      const triggerRect = {
        top: 120,
        left: 180,
        width: 72,
        height: 32,
        right: 252,
        bottom: 152,
        x: 180,
        y: 120,
        toJSON: () => ({}),
      } as DOMRect;

      jest.spyOn(monthBtn, 'getBoundingClientRect').mockReturnValue(triggerRect);

      monthBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.waitForChanges();

      const popup = tooltip.shadowRoot?.querySelector('.md-tooltip__popup') as HTMLElement;
      Object.defineProperty(popup, 'offsetWidth', { configurable: true, value: 120 });
      Object.defineProperty(popup, 'offsetHeight', { configurable: true, value: 24 });

      tooltip.open = true;
      await page.waitForChanges();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await page.waitForChanges();

      expect(tooltip.open).toBe(true);
      const expectedLeft = triggerRect.left + (triggerRect.width - 120) / 2;
      expect(popup?.style.left).toBe(`${expectedLeft}px`);
      expect(popup?.style.insetInlineStart).toBe('');
    });
  });
});
