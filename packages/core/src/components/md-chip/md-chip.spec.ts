import { newSpecPage } from '@stencil/core/testing';
import { MdChip } from './md-chip';

describe('md-chip', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdChip],
      html,
    });
  }

  // ─── Rendering ─────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with defaults (assist)', async () => {
      const page = await create('<md-chip>Assist</md-chip>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-chip');
      expect(page.root).toHaveClass('md-chip--assist');
    });

    it('renders filter variant', async () => {
      const page = await create('<md-chip variant="filter">Filter</md-chip>');
      expect(page.root).toHaveClass('md-chip--filter');
    });

    it('renders input variant', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      expect(page.root).toHaveClass('md-chip--input');
    });

    it('renders suggestion variant', async () => {
      const page = await create('<md-chip variant="suggestion">Suggestion</md-chip>');
      expect(page.root).toHaveClass('md-chip--suggestion');
    });

    it('renders slotted content as label', async () => {
      const page = await create('<md-chip>Hello Chip</md-chip>');
      expect(page.root?.textContent).toContain('Hello Chip');
    });

    it('renders label prop as fallback', async () => {
      const page = await create('<md-chip label="Label Prop"></md-chip>');
      expect(page.root?.shadowRoot?.querySelector('.md-chip__label')?.textContent).toContain('Label Prop');
    });

    it('renders ripple', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('md-ripple')).toBeTruthy();
    });

    it('renders state-layer with part', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      const sl = page.root?.shadowRoot?.querySelector('.md-chip__state-layer');
      expect(sl).toBeTruthy();
      expect(sl?.getAttribute('part')).toBe('state-layer');
    });
  });

  // ─── Outline ──────────────────────────────────────────────
  describe('outline', () => {
    it('renders outline for non-elevated chip', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('.md-chip__outline')).toBeTruthy();
    });

    it('does not render outline for elevated chip', async () => {
      const page = await create('<md-chip elevated>Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('.md-chip__outline')).toBeNull();
    });

    it('applies elevated class', async () => {
      const page = await create('<md-chip elevated>Content</md-chip>');
      expect(page.root).toHaveClass('md-chip--elevated');
    });
  });

  // ─── Icons ────────────────────────────────────────────────
  describe('icons', () => {
    it('renders leading icon from prop', async () => {
      const page = await create('<md-chip icon="search">Search</md-chip>');
      const icon = page.root?.shadowRoot?.querySelector('.md-chip__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('search');
      expect(icon?.getAttribute('part')).toBe('icon');
    });

    it('adds with-leading-icon class when icon prop is set', async () => {
      const page = await create('<md-chip icon="add">Add</md-chip>');
      expect(page.root).toHaveClass('md-chip--with-leading-icon');
    });

    it('renders trailing icon from prop', async () => {
      const page = await create('<md-chip variant="filter" trailing-icon="arrow_drop_down">Filter</md-chip>');
      const icon = page.root?.shadowRoot?.querySelector('.md-chip__trailing-icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('arrow_drop_down');
    });

    it('adds with-trailing-icon class when trailing-icon prop is set', async () => {
      const page = await create('<md-chip variant="filter" trailing-icon="close">Filter</md-chip>');
      expect(page.root).toHaveClass('md-chip--with-trailing-icon');
    });

    it('renders named leading-icon slot', async () => {
      const page = await create('<md-chip><svg slot="leading-icon"></svg>Content</md-chip>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="leading-icon"]');
      expect(slot).toBeTruthy();
    });

    it('renders named trailing-icon slot', async () => {
      const page = await create('<md-chip variant="filter"><svg slot="trailing-icon"></svg>Content</md-chip>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="trailing-icon"]');
      expect(slot).toBeTruthy();
    });
  });

  // ─── Filter chip (selectable) ──────────────────────────────
  describe('filter chip', () => {
    it('has role="button" (toggle button pattern)', async () => {
      const page = await create('<md-chip variant="filter">Filter</md-chip>');
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('sets aria-pressed="false" by default', async () => {
      const page = await create('<md-chip variant="filter">Filter</md-chip>');
      expect(page.root?.getAttribute('aria-pressed')).toBe('false');
    });

    it('toggles selected on click and updates aria-pressed', async () => {
      const page = await create('<md-chip variant="filter">Filter</md-chip>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-chip--selected');
      expect(page.root?.getAttribute('aria-pressed')).toBe('true');
    });

    it('shows checkmark when selected without icon', async () => {
      const page = await create('<md-chip variant="filter" selected>Filter</md-chip>');
      const checkmark = page.root?.shadowRoot?.querySelector('.md-chip__checkmark');
      expect(checkmark).toBeTruthy();
    });

    it('does not show checkmark when selected with icon', async () => {
      const page = await create('<md-chip variant="filter" selected icon="check">Filter</md-chip>');
      const checkmark = page.root?.shadowRoot?.querySelector('.md-chip__checkmark');
      expect(checkmark).toBeNull();
    });

    it('emits mdSelect on toggle', async () => {
      const page = await create('<md-chip variant="filter">Filter</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].detail).toEqual({ selected: true });
    });

    it('emits mdSelect with false on deselect', async () => {
      const page = await create('<md-chip variant="filter" selected>Filter</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdSelect', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy.mock.calls[0][0].detail).toEqual({ selected: false });
    });
  });

  // ─── Input chip (selectable + removable) ───────────────────
  describe('input chip', () => {
    it('is a group host with a separate primary toggle button (no nested-interactive)', async () => {
      // An input chip is removable, so it renders a focusable remove ✕ button.
      // To avoid nesting two interactive controls, the host is a labelled
      // `group` and the body's toggle action moves to a sibling primary button.
      const page = await create('<md-chip variant="input">Input</md-chip>');
      expect(page.root?.getAttribute('role')).toBe('group');
      expect(page.root?.getAttribute('aria-pressed')).toBeNull();
      const primary = page.root?.shadowRoot?.querySelector('.md-chip__primary');
      expect(primary).toBeTruthy();
      expect(primary?.getAttribute('role')).toBe('button');
      expect(primary?.getAttribute('aria-pressed')).toBe('false');
      expect(primary?.getAttribute('tabindex')).toBe('0');
    });

    it('renders remove button with contextual aria-label', async () => {
      const page = await create('<md-chip variant="input">Jane Doe</md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove).toBeTruthy();
      expect(remove?.getAttribute('part')).toBe('remove');
      expect(remove?.getAttribute('aria-label')).toBe('Remove Jane Doe');
    });

    it('adds with-trailing-icon class for remove button', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      expect(page.root).toHaveClass('md-chip--with-trailing-icon');
    });

    it('emits mdRemove when remove button is clicked', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      const spy = jest.fn();
      // The default action of `mdRemove` is to remove the chip from the DOM,
      // so cancel that in the test to keep the spec focused on the event and
      // avoid breaking the assertions that read `page.root` after the click.
      page.root?.addEventListener('mdRemove', (e) => {
        e.preventDefault();
        spy(e);
      });
      const removeBtn = page.root?.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      removeBtn?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('mdRemove is cancelable', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      let captured: Event | null = null;
      page.root?.addEventListener('mdRemove', (e) => {
        e.preventDefault();
        captured = e;
      });
      const removeBtn = page.root?.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      removeBtn?.click();
      await page.waitForChanges();
      expect(captured).toBeTruthy();
      expect(captured!.cancelable).toBe(true);
    });

    it('does not emit mdClick when remove is clicked', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      const clickSpy = jest.fn();
      const removeSpy = jest.fn();
      page.root?.addEventListener('mdClick', clickSpy);
      page.root?.addEventListener('mdRemove', (e) => { e.preventDefault(); removeSpy(); });
      const removeBtn = page.root?.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      removeBtn?.click();
      await page.waitForChanges();
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('toggles selected on chip body click', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-chip--selected');
    });
  });

  // ─── removable prop (cross-variant) ─────────────────────────
  describe('removable prop', () => {
    it('renders remove button on assist variant when removable', async () => {
      const page = await create('<md-chip variant="assist" removable>Tag</md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove).toBeTruthy();
      expect(remove?.getAttribute('part')).toBe('remove');
    });

    it('renders remove button on filter variant when removable', async () => {
      const page = await create('<md-chip variant="filter" removable>Tag</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('.md-chip__remove')).toBeTruthy();
    });

    it('renders remove button on suggestion variant when removable', async () => {
      const page = await create('<md-chip variant="suggestion" removable>Tag</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('.md-chip__remove')).toBeTruthy();
    });

    it('does NOT render remove button on assist without removable', async () => {
      const page = await create('<md-chip variant="assist">Tag</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('.md-chip__remove')).toBeNull();
    });

    it('adds with-trailing-icon class when removable on any variant', async () => {
      const page = await create('<md-chip variant="assist" removable>Tag</md-chip>');
      expect(page.root).toHaveClass('md-chip--with-trailing-icon');
    });

    it('emits mdRemove on a removable assist chip when ✕ is clicked', async () => {
      const page = await create('<md-chip variant="assist" removable>Tag</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', (e) => { e.preventDefault(); spy(); });
      const btn = page.root?.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      btn?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does NOT emit mdClick when ✕ is clicked on a removable assist chip', async () => {
      const page = await create('<md-chip variant="assist" removable>Tag</md-chip>');
      const clickSpy = jest.fn();
      page.root?.addEventListener('mdClick', clickSpy);
      page.root?.addEventListener('mdRemove', (e) => e.preventDefault());
      const btn = page.root?.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      btn?.click();
      await page.waitForChanges();
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('emits mdRemove on Delete when removable on assist variant', async () => {
      const page = await create('<md-chip variant="assist" removable>Tag</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', (e) => { e.preventDefault(); spy(); });
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdRemove on Backspace when removable on filter variant', async () => {
      const page = await create('<md-chip variant="filter" removable>Tag</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', (e) => { e.preventDefault(); spy(); });
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('removes itself from the DOM on ✕ click when handler does not preventDefault', async () => {
      const page = await newSpecPage({
        components: [MdChip],
        html: '<div id="host"><md-chip variant="input">Tag</md-chip></div>',
      });
      const host = page.body.querySelector('#host')!;
      expect(host.querySelector('md-chip')).toBeTruthy();
      const chip = host.querySelector('md-chip')!;
      const btn = chip.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      btn?.click();
      await page.waitForChanges();
      expect(host.querySelector('md-chip')).toBeNull();
    });

    it('removes itself on Delete keypress when handler does not preventDefault', async () => {
      const page = await newSpecPage({
        components: [MdChip],
        html: '<div id="host"><md-chip variant="assist" removable>Tag</md-chip></div>',
      });
      const host = page.body.querySelector('#host')!;
      const chip = host.querySelector('md-chip')!;
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
      await page.waitForChanges();
      expect(host.querySelector('md-chip')).toBeNull();
    });

    it('stays in the DOM when handler calls preventDefault', async () => {
      const page = await newSpecPage({
        components: [MdChip],
        html: '<div id="host"><md-chip variant="input">Tag</md-chip></div>',
      });
      const host = page.body.querySelector('#host')!;
      const chip = host.querySelector('md-chip')!;
      chip.addEventListener('mdRemove', (e) => e.preventDefault());
      const btn = chip.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      btn?.click();
      await page.waitForChanges();
      expect(host.querySelector('md-chip')).toBeTruthy();
    });

    it('input variant is removable by default (back-compat)', async () => {
      const page = await create('<md-chip variant="input">Tag</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('.md-chip__remove')).toBeTruthy();
    });

    it('removable="false" opts an input chip out of the remove button', async () => {
      // Stencil reflects boolean props from attribute strings — "false" is a
      // truthy string so we explicitly bind the prop via property assignment.
      const page = await create('<md-chip variant="input">Tag</md-chip>');
      (page.root as any).removable = false;
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('.md-chip__remove')).toBeNull();
    });

    it('removable does not flip aria-pressed on non-selectable chips', async () => {
      const page = await create('<md-chip variant="assist" removable>Tag</md-chip>');
      expect(page.root?.getAttribute('aria-pressed')).toBeNull();
    });

    it('removable + disabled hides the chip from tab order but keeps the ✕ rendered as disabled', async () => {
      const page = await create('<md-chip variant="assist" removable disabled>Tag</md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove).toBeTruthy();
      expect(remove?.getAttribute('tabindex')).toBe('-1');
      expect(remove?.hasAttribute('disabled')).toBe(true);
    });
  });

  // ─── Assist / Suggestion (non-selectable) ──────────────────
  describe('assist / suggestion', () => {
    it('assist has role="button"', async () => {
      const page = await create('<md-chip variant="assist">Assist</md-chip>');
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('suggestion has role="button"', async () => {
      const page = await create('<md-chip variant="suggestion">Suggestion</md-chip>');
      expect(page.root?.getAttribute('role')).toBe('button');
    });

    it('does not set aria-pressed on assist (not a toggle)', async () => {
      const page = await create('<md-chip variant="assist">Assist</md-chip>');
      expect(page.root?.getAttribute('aria-pressed')).toBeNull();
    });

    it('does not toggle selected on click for assist', async () => {
      const page = await create('<md-chip variant="assist">Assist</md-chip>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-chip--selected');
    });

    it('emits mdClick on click', async () => {
      const page = await create('<md-chip>Assist</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Keyboard ─────────────────────────────────────────────
  describe('keyboard', () => {
    it('activates on Enter', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('activates on Space', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalled();
    });

    it('does not activate on irrelevant keys', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not activate when disabled', async () => {
      const page = await create('<md-chip disabled>Content</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits mdRemove on Enter on remove button', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', (e) => { e.preventDefault(); spy(); });
      const removeBtn = page.root?.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      removeBtn?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdRemove on Delete key for input chip', async () => {
      const page = await create('<md-chip variant="input">Tag</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', (e) => { e.preventDefault(); spy(); });
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdRemove on Backspace key for input chip', async () => {
      const page = await create('<md-chip variant="input">Tag</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', (e) => { e.preventDefault(); spy(); });
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not emit mdRemove on Delete for non-input chips', async () => {
      const page = await create('<md-chip variant="filter">Tag</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Accessibility ────────────────────────────────────────
  describe('accessibility', () => {
    it('exposes a button role for the primary action on every variant', async () => {
      // Non-removable variants are a single button host. The input variant is
      // removable by default, so (to avoid nested-interactive) its host is a
      // group and the button role lives on the sibling primary action.
      for (const variant of ['assist', 'filter', 'suggestion']) {
        const page = await create(`<md-chip variant="${variant}">Chip</md-chip>`);
        expect(page.root?.getAttribute('role')).toBe('button');
      }
      const input = await create('<md-chip variant="input">Chip</md-chip>');
      expect(input.root?.getAttribute('role')).toBe('group');
      expect(
        input.root?.shadowRoot?.querySelector('.md-chip__primary')?.getAttribute('role'),
      ).toBe('button');
    });

    it('has aria-roledescription="chip"', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.getAttribute('aria-roledescription')).toBe('chip');
    });

    it('sets aria-pressed on the selectable toggle (filter host, input primary action)', async () => {
      // filter is a single button host; input is removable, so its toggle is
      // the sibling primary-action button rather than the group host.
      const filter = await create('<md-chip variant="filter">Chip</md-chip>');
      expect(filter.root?.getAttribute('aria-pressed')).toBe('false');

      const input = await create('<md-chip variant="input">Chip</md-chip>');
      expect(input.root?.getAttribute('aria-pressed')).toBeNull();
      expect(
        input.root?.shadowRoot?.querySelector('.md-chip__primary')?.getAttribute('aria-pressed'),
      ).toBe('false');
    });

    it('does not set aria-pressed on non-selectable variants', async () => {
      for (const variant of ['assist', 'suggestion']) {
        const page = await create(`<md-chip variant="${variant}">Chip</md-chip>`);
        expect(page.root?.getAttribute('aria-pressed')).toBeNull();
      }
    });

    it('is focusable via tabindex="0"', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('removes from tab order when disabled', async () => {
      const page = await create('<md-chip disabled>Content</md-chip>');
      expect(page.root?.getAttribute('tabindex')).toBe('-1');
    });

    it('remains focusable when soft-disabled', async () => {
      const page = await create('<md-chip soft-disabled>Content</md-chip>');
      expect(page.root?.getAttribute('tabindex')).toBe('0');
    });

    it('sets aria-disabled when disabled', async () => {
      const page = await create('<md-chip disabled>Content</md-chip>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('sets aria-disabled when soft-disabled', async () => {
      const page = await create('<md-chip soft-disabled>Content</md-chip>');
      expect(page.root?.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not set aria-disabled when enabled', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.getAttribute('aria-disabled')).toBeNull();
    });

    it('passes disabled to ripple', async () => {
      const page = await create('<md-chip disabled>Content</md-chip>');
      const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
      expect(ripple?.getAttribute('disabled')).toBe('');
    });

    it('remove button includes chip label in aria-label', async () => {
      const page = await create('<md-chip variant="input">Jane Doe</md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove?.getAttribute('aria-label')).toBe('Remove Jane Doe');
    });

    it('remove button uses label prop for aria-label', async () => {
      const page = await create('<md-chip variant="input" label="Tag Name"></md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove?.getAttribute('aria-label')).toBe('Remove Tag Name');
    });

    it('remove button falls back to "Remove" when no label', async () => {
      const page = await create('<md-chip variant="input"></md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove?.getAttribute('aria-label')).toBe('Remove');
    });

    it('remove button is independently focusable', async () => {
      const page = await create('<md-chip variant="input">Input</md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove?.getAttribute('tabindex')).toBe('0');
    });

    it('remove button loses tabindex when disabled', async () => {
      const page = await create('<md-chip variant="input" disabled>Input</md-chip>');
      const remove = page.root?.shadowRoot?.querySelector('.md-chip__remove');
      expect(remove?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // ─── Disabled states ──────────────────────────────────────
  describe('disabled states', () => {
    it('adds disabled class', async () => {
      const page = await create('<md-chip disabled>Content</md-chip>');
      expect(page.root).toHaveClass('md-chip--disabled');
    });

    it('adds disabled class when soft-disabled', async () => {
      const page = await create('<md-chip soft-disabled>Content</md-chip>');
      expect(page.root).toHaveClass('md-chip--disabled');
    });

    it('does not emit mdClick when disabled', async () => {
      const page = await create('<md-chip disabled>Content</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClick', spy);
      page.root?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not toggle filter when disabled', async () => {
      const page = await create('<md-chip variant="filter" disabled>Filter</md-chip>');
      page.root?.click();
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-chip--selected');
    });

    it('does not emit mdRemove when disabled', async () => {
      const page = await create('<md-chip variant="input" disabled>Input</md-chip>');
      const spy = jest.fn();
      page.root?.addEventListener('mdRemove', spy);
      const removeBtn = page.root?.shadowRoot?.querySelector('.md-chip__remove') as HTMLButtonElement;
      removeBtn?.click();
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Parts ────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes state-layer part', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    });

    it('exposes outline part', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('[part="outline"]')).toBeTruthy();
    });

    it('exposes label part', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('[part="label"]')).toBeTruthy();
    });

    it('exposes icon part', async () => {
      const page = await create('<md-chip icon="add">Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });

    it('exposes checkmark part', async () => {
      const page = await create('<md-chip variant="filter" selected>Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('[part="checkmark"]')).toBeTruthy();
    });

    it('exposes remove part for input chip', async () => {
      const page = await create('<md-chip variant="input">Content</md-chip>');
      expect(page.root?.shadowRoot?.querySelector('[part="remove"]')).toBeTruthy();
    });
  });

  // ─── Slots ────────────────────────────────────────────────
  describe('slots', () => {
    it('renders default slot content', async () => {
      const page = await create('<md-chip>My Chip</md-chip>');
      expect(page.root?.textContent).toContain('My Chip');
    });
  });

  // ─── RTL ──────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdChip],
        html: '<div dir="rtl"><md-chip>Content</md-chip></div>',
      });
      expect(page.root).toBeTruthy();
    });

    it('renders filter chip in RTL', async () => {
      const page = await newSpecPage({
        components: [MdChip],
        html: '<div dir="rtl"><md-chip variant="filter" selected>فلتر</md-chip></div>',
      });
      expect(page.root).toHaveClass('md-chip--selected');
    });
  });

  // ─── Content alignment ────────────────────────────────────
  describe('content alignment', () => {
    it('defaults to center', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      expect(page.root?.getAttribute('content-align')).toBe('center');
    });

    it('reflects content-align on the host', async () => {
      const page = await create('<md-chip content-align="start">Content</md-chip>');
      expect(page.root?.getAttribute('content-align')).toBe('start');
    });

    it('reflects a property write back to the attribute', async () => {
      const page = await create('<md-chip>Content</md-chip>');
      (page.root as HTMLMdChipElement).contentAlign = 'end';
      await page.waitForChanges();
      expect(page.root?.getAttribute('content-align')).toBe('end');
    });

    // The CSS keys off the reflected attribute rather than a host class, so
    // there is deliberately no `md-chip--content-align-*` to assert. Guard that
    // the choice stayed a no-op for the class map.
    it('adds no host class', async () => {
      const page = await create('<md-chip content-align="end">Content</md-chip>');
      expect(page.root?.className).not.toContain('content-align');
    });
  });

  // ─── Custom CSS API ───────────────────────────────────────
  describe('custom CSS API', () => {
    it('accepts CSS custom property overrides', async () => {
      const page = await create(
        '<md-chip style="--md-chip-container-color: red;">Content</md-chip>',
      );
      expect(page.root).toBeTruthy();
    });
  });
});
