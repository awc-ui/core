import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdTextField } from './md-text-field';
import { MdIconButton } from '../md-icon-button/md-icon-button';

// Helper: create a page with common setup
async function createField(html: string): Promise<SpecPage> {
  return newSpecPage({ components: [MdTextField], html });
}

// Helper: simulate typing into input
function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('md-text-field', () => {
  // ══════════════════════════════════════════════════════════
  //  RENDERING
  // ══════════════════════════════════════════════════════════

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      expect(page.root).toBeTruthy();
      expect(page.root?.classList.contains('md-text-field')).toBe(true);
      expect(page.root?.classList.contains('md-text-field--filled')).toBe(true);
    });

    it('renders outlined variant', async () => {
      const page = await createField(`<md-text-field variant="outlined"></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--outlined')).toBe(true);
    });

    it('renders the label', async () => {
      const page = await createField(`<md-text-field label="Email"></md-text-field>`);
      const label = page.root?.shadowRoot?.querySelector('.md-text-field__label');
      expect(label?.textContent).toBe('Email');
    });

    it('renders active indicator in filled variant', async () => {
      const page = await createField(`<md-text-field variant="filled"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__indicator')).toBeTruthy();
    });

    it('does not render indicator in outlined variant', async () => {
      const page = await createField(`<md-text-field variant="outlined"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__indicator')).toBeFalsy();
    });

    it('renders fieldset in outlined variant', async () => {
      const page = await createField(`<md-text-field variant="outlined" label="Name"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__fieldset')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__legend')).toBeTruthy();
    });

    it('does not render fieldset in filled variant', async () => {
      const page = await createField(`<md-text-field variant="filled" label="Name"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__fieldset')).toBeFalsy();
    });

    it('activates the legend notch only when floating AND a label exists', async () => {
      const legend = (p: Awaited<ReturnType<typeof createField>>) =>
        p.root?.shadowRoot?.querySelector('.md-text-field__legend');
      // floating (has value) + label → notch active
      const withLabel = await createField(`<md-text-field variant="outlined" label="Name" value="x"></md-text-field>`);
      expect(legend(withLabel)?.classList.contains('md-text-field__legend--active')).toBe(true);
      // floating (has value) but NO label → notch stays collapsed (no empty gap
      // in the top border, e.g. a label-less pagination select)
      const noLabel = await createField(`<md-text-field variant="outlined" value="5"></md-text-field>`);
      expect(legend(noLabel)?.classList.contains('md-text-field__legend--active')).toBe(false);
      // appear-focused + no label → still collapsed
      const appear = await createField(`<md-text-field variant="outlined" appear-focused></md-text-field>`);
      expect(legend(appear)?.classList.contains('md-text-field__legend--active')).toBe(false);
    });

    it('renders prefix text when floating', async () => {
      const page = await createField(`<md-text-field prefix-text="$" value="100"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__prefix')?.textContent).toBe('$');
    });

    it('renders suffix text when floating', async () => {
      const page = await createField(`<md-text-field suffix-text="kg" value="50"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__suffix')?.textContent).toBe('kg');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  LABEL FLOATING
  // ══════════════════════════════════════════════════════════

  describe('label floating', () => {
    it('floats when value is set', async () => {
      const page = await createField(`<md-text-field label="Name" value="John"></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--floating')).toBe(true);
    });

    it('does not float when empty and not focused', async () => {
      const page = await createField(`<md-text-field label="Name"></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--floating')).toBe(false);
    });

    it('floats when placeholder is set', async () => {
      const page = await createField(`<md-text-field label="Name" placeholder="Enter name"></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--floating')).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  INPUT EVENTS (mdInput, mdChange)
  // ══════════════════════════════════════════════════════════

  describe('input events', () => {
    it('emits mdInput on input', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'test');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith('test');
    });

    it('emits mdChange on change', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;
      input.dispatchEvent(new Event('change'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('updates value on input', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'hello');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('hello');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  mdSearch EVENT — DEBOUNCE, THROTTLE, DISTINCT
  // ══════════════════════════════════════════════════════════

  describe('mdSearch event', () => {
    it('emits mdSearch instantly when no debounce/throttle', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      typeInto(input, 'a');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith('a');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('debounces mdSearch emission', async () => {
      const page = await createField(`<md-text-field debounce="300"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      jest.useFakeTimers();
      typeInto(input, 'a');
      expect(spy).not.toHaveBeenCalled();

      typeInto(input, 'ab');
      expect(spy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('ab');
      jest.useRealTimers();
    });

    it('resets debounce timer on each keystroke', async () => {
      const page = await createField(`<md-text-field debounce="200"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      jest.useFakeTimers();
      typeInto(input, 'a');
      jest.advanceTimersByTime(150);
      expect(spy).not.toHaveBeenCalled();

      typeInto(input, 'ab');
      jest.advanceTimersByTime(150);
      expect(spy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('ab');
      jest.useRealTimers();
    });

    it('throttles mdSearch emission', async () => {
      const page = await createField(`<md-text-field throttle="300"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      jest.useFakeTimers();
      typeInto(input, 'a');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('a');

      typeInto(input, 'ab');
      expect(spy).toHaveBeenCalledTimes(1);

      typeInto(input, 'abc');
      expect(spy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(300);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith('abc');
      jest.useRealTimers();
    });

    it('does not emit trailing throttle if no pending change', async () => {
      const page = await createField(`<md-text-field throttle="300"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      jest.useFakeTimers();
      typeInto(input, 'a');
      expect(spy).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(300);
      expect(spy).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('distinct-until-changed: skips duplicate emissions', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      typeInto(input, 'abc');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);

      typeInto(input, 'abc');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('distinct-until-changed: emits when value changes back', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      typeInto(input, 'abc');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);

      typeInto(input, 'ab');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(2);

      typeInto(input, 'abc');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('distinct-until-changed works with debounce', async () => {
      const page = await createField(`<md-text-field debounce="200"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;

      jest.useFakeTimers();
      typeInto(input, 'abc');
      jest.advanceTimersByTime(200);
      expect(spy).toHaveBeenCalledTimes(1);

      typeInto(input, 'abcd');
      typeInto(input, 'abc');
      jest.advanceTimersByTime(200);
      expect(spy).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('mdInput still fires on every keystroke regardless of debounce', async () => {
      const page = await createField(`<md-text-field debounce="500"></md-text-field>`);
      const inputSpy = jest.fn();
      const searchSpy = jest.fn();
      page.root?.addEventListener('mdInput', () => inputSpy());
      page.root?.addEventListener('mdSearch', () => searchSpy());
      const input = page.root?.shadowRoot?.querySelector('input')!;

      jest.useFakeTimers();
      typeInto(input, 'a');
      typeInto(input, 'ab');
      typeInto(input, 'abc');

      expect(inputSpy).toHaveBeenCalledTimes(3);
      expect(searchSpy).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(500);
      expect(searchSpy).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('cleans up timers on disconnect', async () => {
      const page = await createField(`<md-text-field debounce="500" throttle="300"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSearch', () => spy());
      const input = page.root?.shadowRoot?.querySelector('input')!;

      jest.useFakeTimers();
      typeInto(input, 'test');

      page.root?.remove();
      jest.advanceTimersByTime(600);
      // Throttle fires once immediately, debounce should be cleared by disconnect
      expect(spy).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });

  // ══════════════════════════════════════════════════════════
  //  ERROR STATE
  // ══════════════════════════════════════════════════════════

  describe('error state', () => {
    it('shows error class', async () => {
      const page = await createField(`<md-text-field error></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--error')).toBe(true);
    });

    it('displays errorText as support text', async () => {
      const page = await createField(`<md-text-field error error-text="Required field"></md-text-field>`);
      const support = page.root?.shadowRoot?.querySelector('.md-text-field__support-text');
      expect(support?.textContent).toBe('Required field');
      expect(support?.classList.contains('md-text-field__support-text--error')).toBe(true);
    });

    it('displays supportingText when no error', async () => {
      const page = await createField(`<md-text-field supporting-text="Enter your email"></md-text-field>`);
      const support = page.root?.shadowRoot?.querySelector('.md-text-field__support-text');
      expect(support?.textContent).toBe('Enter your email');
      expect(support?.classList.contains('md-text-field__support-text--error')).toBe(false);
    });

    it('renders default error icon when error is true', async () => {
      const page = await createField(`<md-text-field error></md-text-field>`);
      const errorIcon = page.root?.shadowRoot?.querySelector('.md-text-field__error-icon');
      expect(errorIcon).toBeTruthy();
      const icon = errorIcon?.querySelector('.material-symbols-outlined');
      expect(icon?.textContent).toBe('error');
    });

    it('renders error-icon slot', async () => {
      const page = await createField(`<md-text-field error></md-text-field>`);
      const slot = page.root?.shadowRoot?.querySelector('slot[name="error-icon"]');
      expect(slot).toBeTruthy();
    });

    it('does not render error icon when not in error', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const errorIcon = page.root?.shadowRoot?.querySelector('.md-text-field__error-icon');
      expect(errorIcon).toBeFalsy();
    });

    it('error state adds with-trailing class', async () => {
      const page = await createField(`<md-text-field error></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--with-trailing')).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  DISABLED STATE
  // ══════════════════════════════════════════════════════════

  describe('disabled state', () => {
    it('shows disabled class and disables input', async () => {
      const page = await createField(`<md-text-field disabled></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--disabled')).toBe(true);
      expect(page.root?.shadowRoot?.querySelector('input')?.disabled).toBe(true);
    });

    it('disables clear button when disabled', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="text" disabled></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      expect(btn.hasAttribute('disabled')).toBe(true);
    });

    it('disables password toggle when disabled', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="internal" disabled></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle') as HTMLButtonElement;
      expect(btn.hasAttribute('disabled')).toBe(true);
    });

    it('disables speech button when disabled', async () => {
      const page = await createField(`<md-text-field speech-to-text="internal" disabled></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__speech') as HTMLButtonElement;
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  CLEARABLE
  // ══════════════════════════════════════════════════════════

  describe('clearable', () => {
    it('renders clear button when clearable is set', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="text"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear');
      expect(btn).toBeTruthy();
    });

    it('does not render clear button when clearable is not set', async () => {
      const page = await createField(`<md-text-field value="text"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__clear')).toBeFalsy();
    });

    it('internal clear empties the value', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="hello"></md-text-field>`);
      const inputSpy = jest.fn();
      const clearSpy = jest.fn();
      page.root?.addEventListener('mdInput', (e: any) => inputSpy(e.detail));
      page.root?.addEventListener('mdClear', clearSpy);

      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      btn.click();
      await page.waitForChanges();

      expect(page.rootInstance.value).toBe('');
      expect(inputSpy).toHaveBeenCalledWith('');
      expect(clearSpy).toHaveBeenCalled();
    });

    it('external clear emits mdClear but does not change value', async () => {
      const page = await createField(`<md-text-field clearable="external" value="hello"></md-text-field>`);
      const clearSpy = jest.fn();
      page.root?.addEventListener('mdClear', clearSpy);

      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      btn.click();
      await page.waitForChanges();

      expect(page.rootInstance.value).toBe('hello');
      expect(clearSpy).toHaveBeenCalled();
    });

    it('clear button disabled when value is empty', async () => {
      const page = await createField(`<md-text-field clearable="internal"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      expect(btn.hasAttribute('disabled')).toBe(true);
      expect(btn.classList.contains('md-text-field__clear--disabled')).toBe(true);
    });

    it('renders clear-icon slot with default cancel icon', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="text"></md-text-field>`);
      const slot = page.root?.shadowRoot?.querySelector('slot[name="clear-icon"]');
      expect(slot).toBeTruthy();
      const icon = page.root?.shadowRoot?.querySelector('.md-text-field__clear .material-symbols-outlined');
      expect(icon?.textContent).toBe('cancel');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  ICONS (slot-based)
  // ══════════════════════════════════════════════════════════

  describe('icons', () => {
    it('renders leading-icon and trailing-icon slots', async () => {
      const page = await createField(`<md-text-field><span slot="leading-icon">L</span><span slot="trailing-icon">T</span></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('slot[name="leading-icon"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('slot[name="trailing-icon"]')).toBeTruthy();
    });

    it('hides leading icon wrapper when no slotted content', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const wrapper = page.root?.shadowRoot?.querySelector('.md-text-field__icon--leading') as HTMLElement;
      expect(wrapper?.style.display).toBe('none');
      expect(page.root?.classList.contains('md-text-field--with-leading')).toBe(false);
    });

    it('hides trailing icon wrapper when no slotted content', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const wrapper = page.root?.shadowRoot?.querySelector('.md-text-field__icon--trailing') as HTMLElement;
      expect(wrapper?.style.display).toBe('none');
      expect(page.root?.classList.contains('md-text-field--with-trailing')).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  PASSWORD TOGGLE
  // ══════════════════════════════════════════════════════════

  describe('password toggle', () => {
    it('renders toggle button when set', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="internal"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle')).toBeTruthy();
      expect(page.root?.classList.contains('md-text-field--with-trailing')).toBe(true);
    });

    it('does not render toggle when not set', async () => {
      const page = await createField(`<md-text-field type="password"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle')).toBeFalsy();
    });

    it('internal toggle switches input type', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="internal" value="secret"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle') as HTMLButtonElement;

      expect(input.type).toBe('password');
      btn.click();
      await page.waitForChanges();
      expect(input.type).toBe('text');
      btn.click();
      await page.waitForChanges();
      expect(input.type).toBe('password');
    });

    it('external toggle emits event without changing type', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="external" value="secret"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdPasswordToggle', (e: any) => spy(e.detail));
      const input = page.root?.shadowRoot?.querySelector('input')!;
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle') as HTMLButtonElement;

      btn.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith({ visible: true });
      expect(input.type).toBe('password');
    });

    it('renders password-toggle-icon slot with default fallback', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="internal"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('slot[name="password-toggle-icon"]')).toBeTruthy();
      const icon = page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle .material-symbols-outlined');
      expect(icon?.textContent).toBe('visibility');
    });

    it('hides password toggle when multiline is set', async () => {
      const page = await createField(`<md-text-field multiline="auto-grow" password-toggle="internal"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle')).toBeFalsy();
    });
  });

  // ══════════════════════════════════════════════════════════
  //  CHARACTER COUNTER
  // ══════════════════════════════════════════════════════════

  describe('character counter', () => {
    it('shows counter when maxLength is set', async () => {
      const page = await createField(`<md-text-field max-length="100" value="hello"></md-text-field>`);
      const counter = page.root?.shadowRoot?.querySelector('.md-text-field__counter');
      expect(counter?.textContent).toBe('5/100');
    });

    it('does not show counter when maxLength is not set', async () => {
      const page = await createField(`<md-text-field value="hello"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__counter')).toBeFalsy();
    });

    it('counts EVERY character when native maxLength enforces the limit', async () => {
      // the counter must count what the limit counts — stripping spaces/dashes
      // showed "8/10" while the browser was already blocking input
      const page = await createField(`<md-text-field max-length="10" value="12/25/2025"></md-text-field>`);
      const counter = page.root?.shadowRoot?.querySelector('.md-text-field__counter');
      expect(counter?.textContent).toBe('10/10');
    });

    it('strips group characters ONLY on the live-formatter path (its limit strips too)', async () => {
      const page = await createField(`<md-text-field max-length="10" format-on="input" value="555-123-4567"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => v;
      page.rootInstance.parser = (v: string) => v;
      await page.waitForChanges();
      const counter = page.root?.shadowRoot?.querySelector('.md-text-field__counter');
      expect(counter?.textContent).toBe('10/10'); // 10 digits, separators stripped
    });
  });

  // ══════════════════════════════════════════════════════════
  //  MULTILINE / TEXTAREA
  // ══════════════════════════════════════════════════════════

  describe('multiline', () => {
    it('renders input by default', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('input')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('textarea')).toBeFalsy();
      expect(page.root?.classList.contains('md-text-field--multiline')).toBe(false);
    });

    it('renders textarea when auto-grow', async () => {
      const page = await createField(`<md-text-field multiline="auto-grow"></md-text-field>`);
      const textarea = page.root?.shadowRoot?.querySelector('textarea');
      expect(textarea).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('input')).toBeFalsy();
      expect(textarea?.classList.contains('md-text-field__input--auto-grow')).toBe(true);
      expect(page.root?.classList.contains('md-text-field--multiline')).toBe(true);
      expect(page.root?.classList.contains('md-text-field--auto-grow')).toBe(true);
    });

    it('renders textarea when fixed', async () => {
      const page = await createField(`<md-text-field multiline="fixed"></md-text-field>`);
      const textarea = page.root?.shadowRoot?.querySelector('textarea');
      expect(textarea).toBeTruthy();
      expect(textarea?.classList.contains('md-text-field__input--fixed')).toBe(true);
      expect(page.root?.classList.contains('md-text-field--textarea')).toBe(true);
    });

    it('default rows: 2 for auto-grow, 4 for fixed', async () => {
      const ag = await createField(`<md-text-field multiline="auto-grow"></md-text-field>`);
      expect(ag.root?.shadowRoot?.querySelector('textarea')?.getAttribute('rows')).toBe('2');

      const fixed = await createField(`<md-text-field multiline="fixed"></md-text-field>`);
      expect(fixed.root?.shadowRoot?.querySelector('textarea')?.getAttribute('rows')).toBe('4');
    });

    it('respects custom rows prop', async () => {
      const page = await createField(`<md-text-field multiline="fixed" rows="6"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('textarea')?.getAttribute('rows')).toBe('6');
    });

    it('textarea emits mdInput', async () => {
      const page = await createField(`<md-text-field multiline="fixed"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdInput', (e: any) => spy(e.detail));
      const textarea = page.root?.shadowRoot?.querySelector('textarea')!;
      typeInto(textarea, 'hello multiline');
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith('hello multiline');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  SPEECH-TO-TEXT
  // ══════════════════════════════════════════════════════════

  describe('speech-to-text', () => {
    it('renders speech button when set', async () => {
      const page = await createField(`<md-text-field speech-to-text="internal"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__speech');
      expect(btn).toBeTruthy();
      expect(btn?.getAttribute('aria-label')).toBe('Start voice input');
      expect(page.root?.classList.contains('md-text-field--with-trailing')).toBe(true);
    });

    it('does not render speech button when not set', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__speech')).toBeFalsy();
    });

    it('external speech toggles listening and emits event', async () => {
      const page = await createField(`<md-text-field speech-to-text="external"></md-text-field>`);
      const spy = jest.fn();
      page.root?.addEventListener('mdSpeechResult', (e: any) => spy(e.detail));
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__speech') as HTMLButtonElement;

      btn.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith({ transcript: '', listening: true });
      expect(page.root?.classList.contains('md-text-field--listening')).toBe(true);

      btn.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith({ transcript: '', listening: false });
      expect(page.root?.classList.contains('md-text-field--listening')).toBe(false);
    });

    it('renders speech-icon slot with default mic icon', async () => {
      const page = await createField(`<md-text-field speech-to-text="internal"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('slot[name="speech-icon"]')).toBeTruthy();
      const icon = page.root?.shadowRoot?.querySelector('.md-text-field__speech .material-symbols-outlined');
      expect(icon?.textContent).toBe('mic');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  INPUT RESTRICTION
  // ══════════════════════════════════════════════════════════

  describe('input restriction', () => {
    it('restrict="numeric" strips non-digits', async () => {
      const page = await createField(`<md-text-field restrict="numeric"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'abc123def');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('123');
    });

    it('restrict="alpha" strips non-letters', async () => {
      const page = await createField(`<md-text-field restrict="alpha"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'abc123def');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('abcdef');
    });

    it('restrict="integer" allows digits and minus', async () => {
      const page = await createField(`<md-text-field restrict="integer"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, '-42abc');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('-42');
    });

    it('restrict="decimal" allows digits, dot, minus', async () => {
      const page = await createField(`<md-text-field restrict="decimal"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, '-3.14abc');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('-3.14');
    });

    it('restrict="alphanumeric" strips special characters', async () => {
      const page = await createField(`<md-text-field restrict="alphanumeric"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'hello@world123!');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('helloworld123');
    });

    it('custom restrict pattern filters characters', async () => {
      const page = await createField(`<md-text-field restrict="[0-9+]"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, '+1-234-567');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('+1234567');
    });

    it('no restriction when restrict is empty', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'anything goes! 123 @#$');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('anything goes! 123 @#$');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  FORMATTER / PARSER
  // ══════════════════════════════════════════════════════════

  describe('formatter / parser', () => {
    it('displays formatted value when not focused', async () => {
      const page = await createField(`<md-text-field value="1000"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => Number(v).toLocaleString('en-US');
      page.rootInstance.syncDisplayValue();
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('1,000');
    });

    it('parser extracts raw value on input', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      page.rootInstance.parser = (v: string) => v.replace(/[^0-9]/g, '');
      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, '1,234');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('1234');
    });

    it('formatter with formatOn="blur" shows raw value when focused', async () => {
      const page = await createField(`<md-text-field value="1000"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => `$${Number(v).toLocaleString('en-US')}`;
      page.rootInstance.syncDisplayValue();
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('$1,000');

      // Simulate focus
      const input = page.root?.shadowRoot?.querySelector('input')!;
      input.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('1000');
    });

    it('formatter with formatOn="blur" reformats on blur', async () => {
      const page = await createField(`<md-text-field value="1000" format-on="blur"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => `$${v}`;
      page.rootInstance.syncDisplayValue();
      await page.waitForChanges();

      const input = page.root?.shadowRoot?.querySelector('input')!;
      input.dispatchEvent(new Event('focus'));
      await page.waitForChanges();

      input.dispatchEvent(new Event('blur'));
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('$1000');
    });

    it('formatter with formatOn="input" formats on every keystroke', async () => {
      const page = await createField(`<md-text-field format-on="input"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => v.toUpperCase();
      page.rootInstance.parser = (v: string) => v.toLowerCase();

      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'hello');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('hello');
      expect(page.rootInstance.displayValue).toBe('HELLO');
    });

    it('live formatter caps value to maxLength content characters', async () => {
      const page = await createField(`<md-text-field format-on="input" max-length="4"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => {
        const d = v.replace(/\D/g, '');
        if (d.length <= 2) return d;
        return d.slice(0, 2) + '/' + d.slice(2, 4);
      };
      page.rootInstance.parser = (v: string) => v.replace(/\D/g, '');

      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, '12252025');
      await page.waitForChanges();
      // Raw should be capped to 4 digits
      expect(page.rootInstance.value.replace(/\D/g, '').length).toBeLessThanOrEqual(4);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  DENSITY
  // ══════════════════════════════════════════════════════════

  describe('density', () => {
    it('applies no density class at 0', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--density0')).toBe(false);
      expect(page.root?.classList.contains('md-text-field--density-1')).toBe(false);
    });

    it('applies density -1 class', async () => {
      const page = await createField(`<md-text-field density="-1"></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--density-1')).toBe(true);
    });

    it('applies density -2 class', async () => {
      const page = await createField(`<md-text-field density="-2"></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--density-2')).toBe(true);
    });

    it('applies density -3 class', async () => {
      const page = await createField(`<md-text-field density="-3"></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--density-3')).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  FOCUS BORDER WIDTH
  // ══════════════════════════════════════════════════════════

  describe('focus border width', () => {
    it('defaults to 3px', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      expect(page.rootInstance.focusBorderWidth).toBe(3);
    });

    it('sets CSS custom properties from focusBorderWidth', async () => {
      const page = await createField(`<md-text-field focus-border-width="2"></md-text-field>`);
      const style = page.root?.style;
      expect(style?.getPropertyValue('--md-text-field-focus-border-width')).toBe('2px');
      expect(style?.getPropertyValue('--md-text-field-focus-inset')).toBe('-1px');
    });

    it('sets correct inset for width 1', async () => {
      const page = await createField(`<md-text-field focus-border-width="1"></md-text-field>`);
      expect(page.root?.style?.getPropertyValue('--md-text-field-focus-inset')).toBe('0px');
    });

    it('default width 3 sets NO inline styles — the documented custom properties stay live', async () => {
      const page = await createField(`<md-text-field focus-border-width="3"></md-text-field>`);
      expect(page.root?.style?.getPropertyValue('--md-text-field-focus-inset')).toBe('');
      expect(page.root?.style?.getPropertyValue('--md-text-field-focus-border-width')).toBe('');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  APPEAR-FOCUSED (anchor / trigger affordance)
  // ══════════════════════════════════════════════════════════

  describe('appearFocused', () => {
    // `appear-focused` lets a host component (e.g. md-time-picker,
    // md-date-picker) keep the trigger field looking focused while a
    // popover/dialog anchored to it has taken real OS focus. The
    // contract is visual-only: it MUST flip the focused class and
    // open the legend notch, but MUST NOT alter formatter behaviour
    // (those keep tracking real focus / blur).

    it('defaults to false', async () => {
      const page = await createField(`<md-text-field label="Field"></md-text-field>`);
      expect(page.rootInstance.appearFocused).toBe(false);
      expect(page.root?.classList.contains('md-text-field--focused')).toBe(false);
    });

    it('adds the focused host class when set', async () => {
      const page = await createField(`<md-text-field label="Field" appear-focused></md-text-field>`);
      expect(page.root?.classList.contains('md-text-field--focused')).toBe(true);
    });

    it('opens the legend notch (outlined variant) when set on an empty field', async () => {
      // Without `appear-focused` the legend would be inactive on an
      // empty outlined field (no value, no placeholder, no real focus),
      // and the outline would draw straight through the inline label
      // because the legend cutout wouldn't form. With it on, the legend
      // gains `--active` and the notch opens cleanly around the label.
      // Filled variant has no legend (it uses a bottom indicator), so
      // the notch concern is outlined-specific — this is also the
      // variant md-time-picker uses for its trigger.
      const page = await createField(
        `<md-text-field variant="outlined" label="Field" appear-focused></md-text-field>`,
      );
      const legend = page.root?.shadowRoot?.querySelector('.md-text-field__legend');
      expect(legend).toBeTruthy();
      expect(legend?.classList.contains('md-text-field__legend--active')).toBe(true);
    });

    it('legend is NOT active on an empty outlined field WITHOUT appear-focused', async () => {
      // Regression guard for the same path: prove that the legend
      // activation actually comes from `appear-focused` and not from
      // some other render-time side effect (e.g. an always-true
      // shortcut). This test pins the contract so a refactor of
      // `isFloating` can't silently break the notch.
      const page = await createField(
        `<md-text-field variant="outlined" label="Field"></md-text-field>`,
      );
      const legend = page.root?.shadowRoot?.querySelector('.md-text-field__legend');
      expect(legend?.classList.contains('md-text-field__legend--active')).toBe(false);
    });

    it('reflects as the `appear-focused` HTML attribute', async () => {
      const page = await createField(`<md-text-field appear-focused></md-text-field>`);
      expect(page.root?.hasAttribute('appear-focused')).toBe(true);
    });

    it('does NOT alter blur-format behaviour (formatter still runs on real blur only)', async () => {
      // Regression: if `appearFocused` were OR'd into the formatter
      // gate (`!this.focused`), having `appear-focused` on while typing
      // would suppress the on-blur formatter even after the user really
      // tabs away, because the field would still "look focused". This
      // test proves `appearFocused` is visual-only and that the
      // formatter still runs on a real blur event.
      const page = await createField(`<md-text-field value="1000" format-on="blur" appear-focused></md-text-field>`);
      page.rootInstance.formatter = (v: string) => `$${v}`;
      page.rootInstance.syncDisplayValue();
      await page.waitForChanges();

      const input = page.root?.shadowRoot?.querySelector('input')!;
      input.dispatchEvent(new Event('focus'));
      await page.waitForChanges();
      // While truly focused, the field shows the raw value
      expect(page.rootInstance.displayValue).toBe('1000');

      input.dispatchEvent(new Event('blur'));
      await page.waitForChanges();
      // After real blur the formatter ran, even though `appearFocused`
      // is still true — proving it didn't gate the formatter off.
      expect(page.rootInstance.displayValue).toBe('$1000');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  SLOTTED TRAILING md-icon-button
  // ══════════════════════════════════════════════════════════

  describe('slotted trailing md-icon-button', () => {
    it('renders a slotted trailing md-icon-button', async () => {
      const page = await newSpecPage({
        components: [MdTextField, MdIconButton],
        html: `<md-text-field><md-icon-button slot="trailing-icon" icon="calendar_today"></md-icon-button></md-text-field>`,
      });
      const btn = page.root?.querySelector('md-icon-button[slot="trailing-icon"]');
      expect(btn).toBeTruthy();
      expect(page.root).toHaveClass('md-text-field--with-trailing');
    });

    it('uses the trailing icon-button wrapper (not the 24px icon wrapper)', async () => {
      const page = await newSpecPage({
        components: [MdTextField, MdIconButton],
        html: `<md-text-field><md-icon-button slot="trailing-icon" icon="calendar_today"></md-icon-button></md-text-field>`,
      });
      const wrapper = page.root?.shadowRoot?.querySelector('.md-text-field__trailing-icon-button');
      expect(wrapper).toBeTruthy();
      expect(wrapper).not.toHaveClass('md-text-field__icon');
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__icon--trailing')).toBeNull();
    });

    it('sets hasTrailingIconButton when an md-icon-button is slotted', async () => {
      const page = await newSpecPage({
        components: [MdTextField, MdIconButton],
        html: `<md-text-field><md-icon-button slot="trailing-icon" icon="calendar_today"></md-icon-button></md-text-field>`,
      });
      expect(page.rootInstance.hasTrailingIconButton).toBe(true);
    });

    it('shows trailing md-icon-button on first paint (componentWillLoad sync)', async () => {
      const page = await newSpecPage({
        components: [MdTextField, MdIconButton],
        html: `<md-text-field><md-icon-button slot="trailing-icon" icon="calendar_today"></md-icon-button></md-text-field>`,
      });
      expect(page.rootInstance.hasSlottedTrailing).toBe(true);
      const wrapper = page.root?.shadowRoot?.querySelector(
        '.md-text-field__trailing-icon-button',
      ) as HTMLElement | null;
      expect(wrapper?.style.display).not.toBe('none');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  COMPONENT INTEGRATION TESTS
  // ══════════════════════════════════════════════════════════

  describe('component integration', () => {
    it('clearable resets formatted display value', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="1000"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => v ? `$${v}` : '';
      page.rootInstance.syncDisplayValue();
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('$1000');

      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      btn.click();
      await page.waitForChanges();

      expect(page.rootInstance.value).toBe('');
      expect(page.rootInstance.displayValue).toBe('');
    });

    it('restriction + parser work together', async () => {
      const page = await createField(`<md-text-field restrict="numeric"></md-text-field>`);
      page.rootInstance.parser = (v: string) => v.replace(/^0+/, '');

      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, '00abc42');
      await page.waitForChanges();
      expect(page.rootInstance.value).toBe('42');
    });

    it('typing and clearing emits correct event sequence', async () => {
      const page = await createField(`<md-text-field clearable="internal"></md-text-field>`);
      const events: string[] = [];
      page.root?.addEventListener('mdInput', () => events.push('input'));
      page.root?.addEventListener('mdChange', () => events.push('change'));
      page.root?.addEventListener('mdClear', () => events.push('clear'));

      const input = page.root?.shadowRoot?.querySelector('input')!;
      typeInto(input, 'hello');
      await page.waitForChanges();
      expect(events).toEqual(['input']);

      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      btn.click();
      await page.waitForChanges();
      // Internal clear emits mdInput, mdChange, then mdClear
      expect(events).toEqual(['input', 'input', 'change', 'clear']);
    });

    it('value watch syncs display value when not focused', async () => {
      const page = await createField(`<md-text-field value="100"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => `$${v}`;
      page.rootInstance.syncDisplayValue();
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('$100');

      page.root?.setAttribute('value', '200');
      page.rootInstance.value = '200';
      page.rootInstance.onValueChange();
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('$200');
    });

    it('outlined + error renders both fieldset and error icon', async () => {
      const page = await createField(`<md-text-field variant="outlined" error error-text="Bad"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__fieldset')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__error-icon')).toBeTruthy();
      const support = page.root?.shadowRoot?.querySelector('.md-text-field__support-text');
      expect(support?.textContent).toBe('Bad');
    });

    it('filled + error renders indicator and error icon', async () => {
      const page = await createField(`<md-text-field variant="filled" error></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__indicator')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-text-field__error-icon')).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════════════════
  //  ACCESSIBILITY
  // ══════════════════════════════════════════════════════════

  describe('accessibility', () => {
    // ── ARIA attributes on input ──

    describe('combobox promotion (input-role)', () => {
      it('leaves the input a plain textbox by default', async () => {
        const page = await createField(`<md-text-field label="City"></md-text-field>`);
        const input = page.root?.shadowRoot?.querySelector('input');
        expect(input?.getAttribute('role')).toBeNull();
        expect(input?.getAttribute('aria-expanded')).toBeNull();
        expect(input?.getAttribute('aria-autocomplete')).toBeNull();
      });

      it('puts role=combobox on the INPUT, never the host', async () => {
        const page = await createField(
          `<md-text-field label="City" input-role="combobox"></md-text-field>`,
        );
        const input = page.root?.shadowRoot?.querySelector('input');
        expect(input?.getAttribute('role')).toBe('combobox');
        // The host stays roleless — a role there would be a second, wrong
        // announcement wrapping the real control.
        expect(page.root?.getAttribute('role')).toBeNull();
      });

      it('emits aria-expanded only under the combobox role', async () => {
        const plain = await createField(`<md-text-field input-expanded></md-text-field>`);
        // aria-expanded is not an allowed attribute on a bare textbox.
        expect(plain.root?.shadowRoot?.querySelector('input')?.getAttribute('aria-expanded')).toBeNull();

        const combo = await createField(
          `<md-text-field input-role="combobox" input-expanded></md-text-field>`,
        );
        expect(combo.root?.shadowRoot?.querySelector('input')?.getAttribute('aria-expanded')).toBe('true');
      });

      it('tracks input-expanded as it changes', async () => {
        const page = await createField(`<md-text-field input-role="combobox"></md-text-field>`);
        const input = () => page.root?.shadowRoot?.querySelector('input');
        expect(input()?.getAttribute('aria-expanded')).toBe('false');
        (page.root as unknown as { inputExpanded: boolean }).inputExpanded = true;
        await page.waitForChanges();
        expect(input()?.getAttribute('aria-expanded')).toBe('true');
      });

      it('forwards aria-autocomplete only under the combobox role', async () => {
        const combo = await createField(
          `<md-text-field input-role="combobox" input-aria-autocomplete="list"></md-text-field>`,
        );
        expect(combo.root?.shadowRoot?.querySelector('input')?.getAttribute('aria-autocomplete')).toBe('list');

        const plain = await createField(`<md-text-field input-aria-autocomplete="list"></md-text-field>`);
        expect(plain.root?.shadowRoot?.querySelector('input')?.getAttribute('aria-autocomplete')).toBeNull();
      });

      it('hands the real input over to a composite owner', async () => {
        const page = await createField(`<md-text-field label="City"></md-text-field>`);
        const el = page.root as unknown as {
          getInputElement: () => Promise<HTMLInputElement | null>;
        };
        const input = await el.getInputElement();
        expect(input).toBe(page.root?.shadowRoot?.querySelector('input'));
      });
    });

    it('sets aria-invalid="true" when error', async () => {
      const page = await createField(`<md-text-field error></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.getAttribute('aria-invalid')).toBe('true');
    });

    it('omits aria-invalid when no error (preserves the browser :user-invalid signal)', async () => {
      const page = await createField(`<md-text-field label="F"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.getAttribute('aria-invalid')).toBeNull();
    });

    it('sets aria-required when required', async () => {
      const page = await createField(`<md-text-field required></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.getAttribute('aria-required')).toBe('true');
    });

    it('omits aria-required when not required (native semantics suffice)', async () => {
      const page = await createField(`<md-text-field label="F"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.getAttribute('aria-required')).toBeNull();
    });

    it('sets aria-label from label prop', async () => {
      const page = await createField(`<md-text-field label="Username"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.getAttribute('aria-label')).toBe('Username');
    });

    it('textarea has same ARIA attributes', async () => {
      const page = await createField(`<md-text-field multiline="fixed" label="Notes" required error></md-text-field>`);
      const textarea = page.root?.shadowRoot?.querySelector('textarea');
      expect(textarea?.getAttribute('aria-label')).toBe('Notes');
      expect(textarea?.getAttribute('aria-required')).toBe('true');
      expect(textarea?.getAttribute('aria-invalid')).toBe('true');
    });

    // ── Read-only ──

    it('sets readonly attribute on input', async () => {
      const page = await createField(`<md-text-field readonly></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('input')?.readOnly).toBe(true);
    });

    it('sets readonly attribute on textarea', async () => {
      const page = await createField(`<md-text-field multiline="fixed" readonly></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('textarea')?.hasAttribute('readonly')).toBe(true);
    });

    // ── Input type ──

    it('input type defaults to text', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('input')?.type).toBe('text');
    });

    it('applies custom type', async () => {
      const page = await createField(`<md-text-field type="email"></md-text-field>`);
      expect(page.root?.shadowRoot?.querySelector('input')?.type).toBe('email');
    });

    // ── Interactive button labels ──

    it('clear button has aria-label', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="x"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear');
      expect(btn?.getAttribute('aria-label')).toBe('Clear');
    });

    it('password toggle has correct aria-label reflecting state', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="internal" value="x"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle') as HTMLButtonElement;
      expect(btn.getAttribute('aria-label')).toBe('Show password');

      btn.click();
      await page.waitForChanges();
      expect(btn.getAttribute('aria-label')).toBe('Hide password');
    });

    it('speech button has correct aria-label reflecting state', async () => {
      const page = await createField(`<md-text-field speech-to-text="external"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__speech') as HTMLButtonElement;
      expect(btn.getAttribute('aria-label')).toBe('Start voice input');

      btn.click();
      await page.waitForChanges();
      expect(btn.getAttribute('aria-label')).toBe('Stop listening');
    });

    // ── Decorative elements hidden from AT ──

    it('leading icon wrapper is aria-hidden', async () => {
      const page = await createField(`<md-text-field><span slot="leading-icon">X</span></md-text-field>`);
      const wrapper = page.root?.shadowRoot?.querySelector('.md-text-field__icon--leading');
      expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    });

    it('trailing icon wrapper is aria-hidden', async () => {
      const page = await createField(`<md-text-field><span slot="trailing-icon">X</span></md-text-field>`);
      const wrapper = page.root?.shadowRoot?.querySelector('.md-text-field__icon--trailing');
      expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    });

    it('state layer is aria-hidden', async () => {
      const page = await createField(`<md-text-field></md-text-field>`);
      const layer = page.root?.shadowRoot?.querySelector('.md-text-field__state-layer');
      expect(layer?.getAttribute('aria-hidden')).toBe('true');
    });

    it('error icon is aria-hidden (decorative)', async () => {
      const page = await createField(`<md-text-field error></md-text-field>`);
      const errorIcon = page.root?.shadowRoot?.querySelector('.md-text-field__error-icon');
      expect(errorIcon?.getAttribute('aria-hidden')).toBe('true');
    });

    // ── Interactive buttons use type="button" ──

    it('clear button is type="button"', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="x"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      expect(btn.type).toBe('button');
    });

    it('password toggle is type="button"', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="internal"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle') as HTMLButtonElement;
      expect(btn.type).toBe('button');
    });

    it('speech button is type="button"', async () => {
      const page = await createField(`<md-text-field speech-to-text="internal"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__speech') as HTMLButtonElement;
      expect(btn.type).toBe('button');
    });

    // ── Action buttons are keyboard-reachable: NO tabindex attribute at all
    //    (mock-doc's tabIndex getter defaults to -1, so assert the attribute —
    //    the old tests asserting tabIndex===-1 were vacuous AND documented the
    //    reverted WCAG 2.1.1 defect) ──

    it('clear button has no tabindex override (keyboard-reachable)', async () => {
      const page = await createField(`<md-text-field clearable="internal" value="x"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__clear') as HTMLButtonElement;
      expect(btn.getAttribute('tabindex')).toBeNull();
    });

    it('password toggle has no tabindex override (keyboard-reachable)', async () => {
      const page = await createField(`<md-text-field type="password" password-toggle="internal"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__password-toggle') as HTMLButtonElement;
      expect(btn.getAttribute('tabindex')).toBeNull();
    });

    it('speech button has no tabindex override (keyboard-reachable)', async () => {
      const page = await createField(`<md-text-field speech-to-text="internal"></md-text-field>`);
      const btn = page.root?.shadowRoot?.querySelector('.md-text-field__speech') as HTMLButtonElement;
      expect(btn.getAttribute('tabindex')).toBeNull();
    });

    // ── Disabled input is not focusable ──

    it('disabled input has disabled attribute', async () => {
      const page = await createField(`<md-text-field disabled></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.disabled).toBe(true);
    });

    it('disabled textarea has disabled attribute', async () => {
      const page = await createField(`<md-text-field multiline="auto-grow" disabled></md-text-field>`);
      const textarea = page.root?.shadowRoot?.querySelector('textarea');
      expect(textarea?.hasAttribute('disabled')).toBe(true);
    });

    // ── required attribute forwarded ──

    it('required attribute is set on input', async () => {
      const page = await createField(`<md-text-field required></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.required).toBe(true);
    });

    it('required attribute is set on textarea', async () => {
      const page = await createField(`<md-text-field multiline="fixed" required></md-text-field>`);
      const textarea = page.root?.shadowRoot?.querySelector('textarea');
      expect(textarea?.hasAttribute('required')).toBe(true);
    });

    // ── Placeholder forwarded only when floating ──

    it('shows placeholder only when label is floating', async () => {
      const page = await createField(`<md-text-field label="Name" placeholder="Enter name"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      // When placeholder is set, isFloating is true, so placeholder should appear
      expect(input?.placeholder).toBe('Enter name');
    });

    it('hides placeholder when not floating', async () => {
      const page = await createField(`<md-text-field label="Name"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      // No value, no placeholder → not floating → placeholder should be empty
      expect(input?.placeholder).toBe('');
    });

    // ── maxLength forwarded to input ──

    it('forwards maxLength to input element', async () => {
      const page = await createField(`<md-text-field max-length="50"></md-text-field>`);
      const input = page.root?.shadowRoot?.querySelector('input');
      expect(input?.maxLength).toBe(50);
    });

    it('omits maxLength from input when live formatting', async () => {
      const page = await createField(`<md-text-field max-length="10" format-on="input"></md-text-field>`);
      page.rootInstance.formatter = (v: string) => v;
      page.rootInstance.parser = (v: string) => v; // live formatting requires a parser now
      await page.waitForChanges();
      const input = page.root?.shadowRoot?.querySelector('input');
      // maxLength should not be set on the element so the formatter controls length
      expect(input?.getAttribute('maxlength')).toBeNull();
    });
  });

  describe('internal speech engine (mocked SpeechRecognition)', () => {
    class MockRecognition {
      static last: MockRecognition | null = null;
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      started = 0;
      stopped = 0;
      aborted = 0;
      constructor() { MockRecognition.last = this; }
      start() { this.started++; }
      stop() { this.stopped++; this.onend?.(); }
      abort() { this.aborted++; }
    }
    const result = (transcript: string, isFinal: boolean) => ({
      resultIndex: 0,
      results: [Object.assign([{ transcript }], { isFinal })],
    });

    const setup = async (attrs = '') => {
      const page = await createField(`<md-text-field label="Voice" speech-to-text="internal" ${attrs}></md-text-field>`);
      // AFTER createField — newSpecPage resets the global window
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = MockRecognition;
      MockRecognition.last = null;
      const btn = page.root!.shadowRoot!.querySelector('.md-text-field__speech') as HTMLButtonElement;
      return { page, btn };
    };

    it('appends final transcript with separator, emits mdInput/mdChange on end', async () => {
      const { page, btn } = await setup('value="note"');
      const inputSpy = jest.fn();
      const changeSpy = jest.fn();
      page.root!.addEventListener('mdInput', inputSpy);
      page.root!.addEventListener('mdChange', changeSpy);
      btn.click();
      const rec = MockRecognition.last!;
      expect(rec.started).toBe(1);
      rec.onresult!(result('hello', false)); // interim
      expect((page.root as HTMLMdTextFieldElement).value).toBe('note hello');
      rec.onresult!(result('hello world', true)); // final
      rec.onend!();
      await page.waitForChanges();
      expect((page.root as HTMLMdTextFieldElement).value).toBe('note hello world');
      expect(inputSpy).toHaveBeenCalled();
      expect(changeSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: 'note hello world' }));
    });

    it('speechLang configures the recognition', async () => {
      const { btn } = await setup('speech-lang="de-DE"');
      btn.click();
      expect(MockRecognition.last!.lang).toBe('de-DE');
    });

    it('second click stops an active session', async () => {
      const { btn } = await setup();
      btn.click();
      const rec = MockRecognition.last!;
      btn.click();
      expect(rec.stopped).toBe(1);
    });

    it('error resets listening state', async () => {
      const { page, btn } = await setup();
      btn.click();
      MockRecognition.last!.onerror!({ error: 'no-speech' });
      await page.waitForChanges();
      expect(page.root!.classList.contains('md-text-field--listening')).toBe(false);
    });

    it('readonly blocks the engine entirely', async () => {
      const { btn } = await setup('readonly');
      MockRecognition.last = null;
      btn.click();
      expect(MockRecognition.last).toBeNull();
    });

    it('disconnect aborts an active session', async () => {
      const { page, btn } = await setup();
      btn.click();
      const rec = MockRecognition.last!;
      page.root!.remove();
      expect(rec.aborted).toBe(1);
    });
  });

  describe('round-3 contracts', () => {
    it('throttle recovers after disconnect/reconnect (no permanent wedge)', async () => {
      // no fake timers needed: the wedge was a STALE timer id read as an open
      // window right after reconnect — the very next input exposes it
      const page = await createField(`<md-text-field label="S" throttle="60000"></md-text-field>`);
      const spy = jest.fn();
      page.root!.addEventListener('mdSearch', spy);
      const input = page.root!.shadowRoot!.querySelector('input')!;
      input.value = 'a';
      input.dispatchEvent(new Event('input'));
      expect(spy).toHaveBeenCalledTimes(1); // leading emit opens the window
      // reparent mid-window
      const parent = page.root!.parentElement!;
      const holder = document.createElement('div');
      parent.appendChild(holder);
      holder.appendChild(page.root!);
      await page.waitForChanges();
      input.value = 'ab';
      input.dispatchEvent(new Event('input'));
      expect(spy).toHaveBeenCalledTimes(2); // fresh window — previously wedged forever
    });

    it('Escape-clear emits mdClear (keyboard parity) and mdSearch("")', async () => {
      const page = await createField(`<md-text-field label="S" value="abc" clearable="internal"></md-text-field>`);
      const clearSpy = jest.fn();
      const searchSpy = jest.fn();
      page.root!.addEventListener('mdClear', clearSpy);
      page.root!.addEventListener('mdSearch', searchSpy);
      const input = page.root!.shadowRoot!.querySelector('input')!;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await page.waitForChanges();
      expect((page.root as HTMLMdTextFieldElement).value).toBe('');
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy).toHaveBeenCalledWith(expect.objectContaining({ detail: '' }));
    });

    it('bare `clearable` attribute means internal (button renders)', async () => {
      const page = await createField(`<md-text-field label="S" value="x" clearable></md-text-field>`);
      expect(page.root!.shadowRoot!.querySelector('.md-text-field__clear')).not.toBeNull();
    });

    it('native minlength/maxlength spellings are honored as fallbacks', async () => {
      const page = await createField(`<md-text-field label="S" maxlength="7" minlength="2" value="abc"></md-text-field>`);
      expect((page.root as HTMLMdTextFieldElement).maxLength).toBe(7);
      expect((page.root as HTMLMdTextFieldElement).minLength).toBe(2);
    });

    it('host aria-label moves to the inner input (generic hosts prohibit it)', async () => {
      const page = await createField(`<md-text-field aria-label="Search everything"></md-text-field>`);
      const input = page.root!.shadowRoot!.querySelector('input')!;
      expect(input.getAttribute('aria-label')).toBe('Search everything');
      expect(page.root!.getAttribute('aria-label')).toBeNull();
    });

    it('assigning formatter via JS recomputes the resting display state', async () => {
      // (DOM patch is asserted in e2e — mock-doc flush ordering differs)
      const page = await createField(`<md-text-field label="N" value="1234"></md-text-field>`);
      (page.root as HTMLMdTextFieldElement).formatter = (v: string) => `#${v}`;
      await page.waitForChanges();
      expect(page.rootInstance.displayValue).toBe('#1234');
    });

    it('a throwing formatter degrades to the raw value', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const page = await createField(`<md-text-field label="N" value="raw"></md-text-field>`);
      (page.root as HTMLMdTextFieldElement).formatter = () => { throw new Error('boom'); };
      await page.waitForChanges();
      expect(page.root!.shadowRoot!.querySelector('input')!.value).toBe('raw');
      warn.mockRestore();
    });

    it('blurred programmatic write with newlines sanitizes (single-line)', async () => {
      const page = await createField(`<md-text-field label="S"></md-text-field>`);
      (page.root as HTMLMdTextFieldElement).value = 'line1\nline2';
      await page.waitForChanges();
      expect((page.root as HTMLMdTextFieldElement).value).toBe('line1line2');
      expect(page.root!.shadowRoot!.querySelector('input')!.value).toBe('line1line2');
    });

    it('password toggle exposes aria-pressed', async () => {
      const page = await createField(`<md-text-field label="P" type="password" password-toggle="internal"></md-text-field>`);
      const btn = page.root!.shadowRoot!.querySelector('.md-text-field__password-toggle')!;
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      (btn as HTMLButtonElement).click();
      await page.waitForChanges();
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });

    it('trailing wrapper stays aria-hidden for DECORATIVE slotted content', async () => {
      const page = await newSpecPage({
        components: [MdTextField],
        html: `<md-text-field label="D"><span slot="trailing-icon">*</span></md-text-field>`,
      });
      await page.waitForChanges();
      const wrapper = page.root!.shadowRoot!.querySelector('.md-text-field__icon--trailing');
      expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    });

    it('trailing wrapper LIFTS aria-hidden for ANY interactive slotted element', async () => {
      for (const el of ['<md-icon-button slot="trailing-icon" icon="event" aria-label="Pick"></md-icon-button>',
                        '<button slot="trailing-icon" aria-label="Do thing">x</button>']) {
        const page = await newSpecPage({
          components: [MdTextField],
          html: `<md-text-field label="D">${el}</md-text-field>`,
        });
        await page.waitForChanges();
        const wrapper = page.root!.shadowRoot!.querySelector('.md-text-field__trailing-icon-button');
        expect(wrapper).not.toBeNull();
        expect(wrapper!.getAttribute('aria-hidden')).toBeNull();
      }
    });
  });


  describe('round-6 contracts', () => {
    it('autofill animation hack flips the floating state', async () => {
      const page = await createField(`<md-text-field label="Email"></md-text-field>`);
      const input = page.root!.shadowRoot!.querySelector('input')!;
      expect(page.root!.classList.contains('md-text-field--floating')).toBe(false);
      const startEv = new Event('animationstart', { bubbles: true }) as Event & { animationName?: string };
      startEv.animationName = 'md-tf-autofill-start'; // AnimationEvent ctor absent in mock-doc
      input.dispatchEvent(startEv);
      await page.waitForChanges();
      expect(page.root!.classList.contains('md-text-field--floating')).toBe(true);
      const cancelEv = new Event('animationstart', { bubbles: true }) as Event & { animationName?: string };
      cancelEv.animationName = 'md-tf-autofill-cancel';
      input.dispatchEvent(cancelEv);
      await page.waitForChanges();
      expect(page.root!.classList.contains('md-text-field--floating')).toBe(false);
    });

    it('value = null coerces to empty string (framework reset parity)', async () => {
      const page = await createField(`<md-text-field label="F" value="stale"></md-text-field>`);
      (page.root as HTMLMdTextFieldElement).value = null as unknown as string;
      await page.waitForChanges();
      expect((page.root as HTMLMdTextFieldElement).value).toBe('');
      expect(page.root!.shadowRoot!.querySelector('input')!.value).toBe('');
    });

    it('clear button is invisible (not ghosted) when there is nothing to clear', async () => {
      const page = await createField(`<md-text-field label="F" clearable="internal"></md-text-field>`);
      const btn = page.root!.shadowRoot!.querySelector('.md-text-field__clear')!;
      expect(btn.classList.contains('md-text-field__clear--empty')).toBe(true);
      (page.root as HTMLMdTextFieldElement).value = 'x';
      await page.waitForChanges();
      expect(btn.classList.contains('md-text-field__clear--empty')).toBe(false);
    });

    // host change re-dispatch is asserted in e2e — mock-doc drops nested
    // dispatches (an event dispatched from within another event's listener)
  });

});
