import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdMenuItem } from './md-menu-item';

async function createItem(html: string): Promise<SpecPage> {
  return newSpecPage({ components: [MdMenuItem], html });
}

describe('md-menu-item', () => {
  afterEach(() => { jest.useRealTimers(); });
  // ── Rendering ──

  it('renders with defaults', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    expect(page.root).toBeTruthy();
    expect(page.root?.classList.contains('md-menu-item')).toBe(true);
  });

  it('renders headline text', async () => {
    const page = await createItem(`<md-menu-item headline="Copy"></md-menu-item>`);
    const headline = page.root?.shadowRoot?.querySelector('.md-menu-item__headline');
    expect(headline?.textContent).toBe('Copy');
  });

  it('renders supporting text', async () => {
    const page = await createItem(`<md-menu-item headline="Profile" supporting-text="View your profile"></md-menu-item>`);
    const supporting = page.root?.shadowRoot?.querySelector('.md-menu-item__supporting');
    expect(supporting?.textContent).toBe('View your profile');
  });

  it('does not render supporting text when empty', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const supporting = page.root?.shadowRoot?.querySelector('.md-menu-item__supporting');
    expect(supporting).toBeFalsy();
  });

  it('renders trailing text', async () => {
    const page = await createItem(`<md-menu-item headline="Cut" trailing-text="⌘X"></md-menu-item>`);
    const trailing = page.root?.shadowRoot?.querySelector('.md-menu-item__trailing-text');
    expect(trailing?.textContent).toBe('⌘X');
  });

  it('renders leading-icon slot when content is provided', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"><span slot="leading-icon">E</span></md-menu-item>`);
    const wrapper = page.root?.shadowRoot?.querySelector('.md-menu-item__leading');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.getAttribute('part')).toBe('leading-icon');
  });

  it('does not render leading-icon wrapper without slot content', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const wrapper = page.root?.shadowRoot?.querySelector('.md-menu-item__leading');
    expect(wrapper).toBeFalsy();
  });

  it('renders trailing-icon slot when content is provided', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"><span slot="trailing-icon">T</span></md-menu-item>`);
    const slot = page.root?.shadowRoot?.querySelector('slot[name="trailing-icon"]');
    expect(slot).toBeTruthy();
  });

  it('does not render trailing wrapper without trailing content', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const wrapper = page.root?.shadowRoot?.querySelector('.md-menu-item__trailing');
    expect(wrapper).toBeFalsy();
  });

  it('renders md-ripple', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple).toBeTruthy();
  });

  it('renders state layer', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const stateLayer = page.root?.shadowRoot?.querySelector('.md-menu-item__state-layer');
    expect(stateLayer).toBeTruthy();
    expect(stateLayer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders badge when set', async () => {
    const page = await createItem(`<md-menu-item headline="Edit" badge="New"></md-menu-item>`);
    const badge = page.root?.shadowRoot?.querySelector('.md-menu-item__badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('New');
    expect(badge?.getAttribute('part')).toBe('badge');
  });

  it('does not render badge when empty', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const badge = page.root?.shadowRoot?.querySelector('.md-menu-item__badge');
    expect(badge).toBeFalsy();
  });

  // ── States ──

  it('applies selected class', async () => {
    const page = await createItem(`<md-menu-item headline="Sort" selected></md-menu-item>`);
    expect(page.root?.classList.contains('md-menu-item--selected')).toBe(true);
  });

  it('applies disabled class', async () => {
    const page = await createItem(`<md-menu-item headline="Delete" disabled></md-menu-item>`);
    expect(page.root?.classList.contains('md-menu-item--disabled')).toBe(true);
  });

  it('applies divider class', async () => {
    const page = await createItem(`<md-menu-item headline="Save" divider></md-menu-item>`);
    expect(page.root?.classList.contains('md-menu-item--divider')).toBe(true);
  });

  it('applies gap class', async () => {
    const page = await createItem(`<md-menu-item headline="Save" gap></md-menu-item>`);
    expect(page.root?.classList.contains('md-menu-item--gap')).toBe(true);
  });

  // ── Events ──

  it('emits mdClick on click', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.click();
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('does not emit mdClick when disabled', async () => {
    const page = await createItem(`<md-menu-item headline="Edit" disabled></md-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new MouseEvent('click'));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Checkbox type ──

  it('toggles selected on click for checkbox type', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox" keep-open></md-menu-item>`);
    expect(page.rootInstance.selected).toBe(false);
    page.root?.click();
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(true);
    page.root?.click();
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(false);
  });

  it('renders check icon when checkbox is selected', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox" selected></md-menu-item>`);
    const check = page.root?.shadowRoot?.querySelector('.md-menu-item__check .material-symbols-outlined');
    expect(check?.textContent).toBe('check');
  });

  it('renders empty check when checkbox not selected', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox"></md-menu-item>`);
    const check = page.root?.shadowRoot?.querySelector('.md-menu-item__check .material-symbols-outlined');
    expect(check?.textContent?.trim()).toBe('');
  });

  it('renders a dash and exposes aria-checked="mixed" when indeterminate', async () => {
    const page = await createItem(`<md-menu-item headline="Select all" type="checkbox" indeterminate></md-menu-item>`);
    const check = page.root?.shadowRoot?.querySelector('.md-menu-item__check .material-symbols-outlined');
    expect(check?.textContent).toBe('remove');
    expect(page.root?.getAttribute('aria-checked')).toBe('mixed');
  });

  it('selected wins over indeterminate (tick, not dash; aria-checked="true")', async () => {
    const page = await createItem(`<md-menu-item headline="Select all" type="checkbox" selected indeterminate></md-menu-item>`);
    const check = page.root?.shadowRoot?.querySelector('.md-menu-item__check .material-symbols-outlined');
    expect(check?.textContent).toBe('check');
    expect(page.root?.getAttribute('aria-checked')).toBe('true');
  });

  it('ignores indeterminate for button type (no check slot, no aria-checked)', async () => {
    const page = await createItem(`<md-menu-item headline="Plain" indeterminate></md-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('.md-menu-item__check')).toBeNull();
    expect(page.root?.getAttribute('aria-checked')).toBeNull();
  });

  it('renders check at start position', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox" check-position="start"></md-menu-item>`);
    const checks = page.root?.shadowRoot?.querySelectorAll('.md-menu-item__check');
    expect(checks?.length).toBe(1);
  });

  it('renders check at end position by default', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox"></md-menu-item>`);
    const checks = page.root?.shadowRoot?.querySelectorAll('.md-menu-item__check');
    expect(checks?.length).toBe(1);
  });

  // ── Radio type ──

  it('sets selected on click for radio type', async () => {
    const page = await createItem(`<md-menu-item headline="Small" type="radio" keep-open></md-menu-item>`);
    page.root?.click();
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(true);
  });

  // ── No check for button type ──

  it('does not render check indicator for button type', async () => {
    const page = await createItem(`<md-menu-item headline="Action"></md-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('.md-menu-item__check')).toBeFalsy();
  });

  // ── handleKeyDown ──

  it('Enter triggers click', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('Space toggles checkbox without closing menu', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox" keep-open></md-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);

    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('Space toggles checkbox off', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox" selected keep-open></md-menu-item>`);
    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(false);
  });

  it('Space selects radio and emits mdClick', async () => {
    const page = await createItem(`<md-menu-item headline="Small" type="radio" keep-open></md-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);

    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(true);
    expect(spy).toHaveBeenCalled();
  });

  it('Space on button type triggers click', async () => {
    const page = await createItem(`<md-menu-item headline="Action"></md-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);

    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await page.waitForChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('Space is a no-op when disabled', async () => {
    const page = await createItem(`<md-menu-item headline="Edit" disabled type="checkbox"></md-menu-item>`);
    const spy = jest.fn();
    page.root?.addEventListener('mdClick', spy);

    page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await page.waitForChanges();
    expect(spy).not.toHaveBeenCalled();
  });

  // ── deselectSiblingRadios ──

  it('deselects sibling radio items when clicked', async () => {
    const page = await createItem(`<md-menu-item headline="Small" type="radio" selected keep-open></md-menu-item>`);
    const sibling1 = Object.assign(document.createElement('md-menu-item'), { type: 'radio', selected: true });
    const sibling2 = Object.assign(document.createElement('md-menu-item'), { type: 'radio', selected: false });

    const menu = document.createElement('md-menu');
    menu.appendChild(sibling1);
    menu.appendChild(page.root!);
    menu.appendChild(sibling2);
    document.body.appendChild(menu);

    page.root!.click();
    await page.waitForChanges();
    expect(page.rootInstance.selected).toBe(true);
    expect(sibling1.selected).toBe(false);

    document.body.removeChild(menu);
  });

  // ── Part attributes ──

  it('exposes part attributes on content and headline', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('[part="state-layer"]')).toBeTruthy();
    expect(page.root?.shadowRoot?.querySelector('[part="content"]')).toBeTruthy();
    expect(page.root?.shadowRoot?.querySelector('[part="headline"]')).toBeTruthy();
  });

  it('exposes leading-icon part when slot has content', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"><span slot="leading-icon">X</span></md-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('[part="leading-icon"]')).toBeTruthy();
  });

  it('exposes trailing part when trailing text is set', async () => {
    const page = await createItem(`<md-menu-item headline="Cut" trailing-text="⌘X"></md-menu-item>`);
    expect(page.root?.shadowRoot?.querySelector('[part="trailing"]')).toBeTruthy();
  });

  // ── Accessibility ──

  it('has role="menuitem" by default', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    expect(page.root?.getAttribute('role')).toBe('menuitem');
  });

  it('has role="menuitemcheckbox" for checkbox type', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="checkbox"></md-menu-item>`);
    expect(page.root?.getAttribute('role')).toBe('menuitemcheckbox');
  });

  it('has role="menuitemradio" for radio type', async () => {
    const page = await createItem(`<md-menu-item headline="Option" type="radio"></md-menu-item>`);
    expect(page.root?.getAttribute('role')).toBe('menuitemradio');
  });

  it('sets aria-disabled when disabled', async () => {
    const page = await createItem(`<md-menu-item headline="Edit" disabled></md-menu-item>`);
    expect(page.root?.getAttribute('aria-disabled')).toBe('true');
  });

  it('sets aria-disabled="false" when enabled', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    expect(page.root?.getAttribute('aria-disabled')).toBe('false');
  });

  it('sets aria-checked for checkbox type', async () => {
    const page = await createItem(`<md-menu-item headline="On" type="checkbox" selected></md-menu-item>`);
    expect(page.root?.getAttribute('aria-checked')).toBe('true');
  });

  it('sets aria-checked="false" for unselected checkbox', async () => {
    const page = await createItem(`<md-menu-item headline="Off" type="checkbox"></md-menu-item>`);
    expect(page.root?.getAttribute('aria-checked')).toBe('false');
  });

  it('does not set aria-checked for button type', async () => {
    const page = await createItem(`<md-menu-item headline="Action"></md-menu-item>`);
    expect(page.root?.getAttribute('aria-checked')).toBeNull();
  });

  it('default tabindex is -1 (roving tabindex managed by parent menu)', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"></md-menu-item>`);
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('tabindex is -1 when disabled', async () => {
    const page = await createItem(`<md-menu-item headline="Edit" disabled></md-menu-item>`);
    expect(page.root?.getAttribute('tabindex')).toBe('-1');
  });

  it('ripple is disabled when item is disabled', async () => {
    const page = await createItem(`<md-menu-item headline="Edit" disabled></md-menu-item>`);
    const ripple = page.root?.shadowRoot?.querySelector('md-ripple');
    expect(ripple?.getAttribute('disabled')).not.toBeNull();
  });

  // ── handleClick walks up parent menus ──

  it('handleClick walks up nested menus and closes root menu', async () => {
    const page = await createItem(`<md-menu-item headline="Action"></md-menu-item>`);

    const innerMenu = document.createElement('md-menu');
    const subItem = document.createElement('md-sub-menu-item');
    const outerMenu = document.createElement('md-menu');
    (outerMenu as any).close = jest.fn();

    innerMenu.appendChild(page.root!);
    subItem.appendChild(innerMenu);
    outerMenu.appendChild(subItem);
    document.body.appendChild(outerMenu);

    jest.useFakeTimers();
    page.root!.click();
    jest.advanceTimersByTime(200);

    expect((outerMenu as any).close).toHaveBeenCalled();
    outerMenu.remove();
  });

  it('handleClick does not close menu when keepOpen is true', async () => {
    const page = await createItem(`<md-menu-item headline="Stay" keep-open></md-menu-item>`);

    const menu = document.createElement('md-menu');
    (menu as any).close = jest.fn();
    menu.appendChild(page.root!);
    document.body.appendChild(menu);

    jest.useFakeTimers();
    page.root!.click();
    jest.advanceTimersByTime(200);

    expect((menu as any).close).not.toHaveBeenCalled();
    menu.remove();
  });

  it('handleClick closes single-level menu', async () => {
    const page = await createItem(`<md-menu-item headline="Action"></md-menu-item>`);

    const menu = document.createElement('md-menu');
    (menu as any).close = jest.fn();
    menu.appendChild(page.root!);
    document.body.appendChild(menu);

    jest.useFakeTimers();
    page.root!.click();
    jest.advanceTimersByTime(200);

    expect((menu as any).close).toHaveBeenCalled();
    menu.remove();
  });

  it('handleClick restores focus to anchor before closing the menu', async () => {
    const page = await createItem(`<md-menu-item headline="Action"></md-menu-item>`);

    const btn = document.createElement('button');
    btn.id = 'test-anchor';
    btn.focus = jest.fn();
    document.body.appendChild(btn);

    const menu = document.createElement('md-menu');
    (menu as any).close = jest.fn();
    (menu as any).anchor = 'test-anchor';
    menu.appendChild(page.root!);
    document.body.appendChild(menu);

    jest.useFakeTimers();
    page.root!.click();

    expect(btn.focus).toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect((menu as any).close).toHaveBeenCalled();

    btn.remove();
    menu.remove();
  });

  it('handleClick does not restore focus when keepOpen is true', async () => {
    const page = await createItem(`<md-menu-item headline="Action" keep-open></md-menu-item>`);

    const btn = document.createElement('button');
    btn.id = 'ko-anchor';
    btn.focus = jest.fn();
    document.body.appendChild(btn);

    const menu = document.createElement('md-menu');
    (menu as any).close = jest.fn();
    (menu as any).anchor = 'ko-anchor';
    menu.appendChild(page.root!);
    document.body.appendChild(menu);

    jest.useFakeTimers();
    page.root!.click();

    expect(btn.focus).not.toHaveBeenCalled();

    btn.remove();
    menu.remove();
  });

  // ── deselectSiblingRadios in group ──

  it('deselectSiblingRadios deselects within md-menu-item-group', async () => {
    const page = await createItem(`<md-menu-item headline="A" type="radio" keep-open></md-menu-item>`);
    const sibling = Object.assign(document.createElement('md-menu-item'), { type: 'radio', selected: true });

    const group = document.createElement('md-menu-item-group');
    group.appendChild(sibling);
    group.appendChild(page.root!);
    document.body.appendChild(group);

    page.root!.click();
    await page.waitForChanges();

    expect(page.rootInstance.selected).toBe(true);
    expect(sibling.selected).toBe(false);
    group.remove();
  });

  it('deselectSiblingRadios is a no-op for non-radio type', async () => {
    const page = await createItem(`<md-menu-item headline="A" type="button"></md-menu-item>`);
    expect(() => page.rootInstance.deselectSiblingRadios()).not.toThrow();
  });

  it('deselectSiblingRadios is a no-op without parent group or menu', async () => {
    const page = await createItem(`<md-menu-item headline="A" type="radio"></md-menu-item>`);
    expect(() => page.rootInstance.deselectSiblingRadios()).not.toThrow();
  });

  // ── componentWillLoad hasTrailingIcon ──

  it('detects trailing-icon slot content on load', async () => {
    const page = await createItem(`<md-menu-item headline="Edit"><span slot="trailing-icon">T</span></md-menu-item>`);
    const trailing = page.root?.shadowRoot?.querySelector('.md-menu-item__trailing');
    expect(trailing).toBeTruthy();
  });

  // ── checkbox check-position start + selected ──

  it('renders start check with selected state', async () => {
    const page = await createItem(`<md-menu-item headline="On" type="checkbox" check-position="start" selected></md-menu-item>`);
    const check = page.root?.shadowRoot?.querySelector('.md-menu-item__check .material-symbols-outlined');
    expect(check?.textContent).toBe('check');
  });

  // ── radio with check at end ──

  it('renders end check for radio type when selected', async () => {
    const page = await createItem(`<md-menu-item headline="Small" type="radio" selected></md-menu-item>`);
    const check = page.root?.shadowRoot?.querySelector('.md-menu-item__check .material-symbols-outlined');
    expect(check?.textContent).toBe('check');
  });

  it('renders empty end check for unselected radio', async () => {
    const page = await createItem(`<md-menu-item headline="Small" type="radio"></md-menu-item>`);
    const check = page.root?.shadowRoot?.querySelector('.md-menu-item__check .material-symbols-outlined');
    expect(check?.textContent?.trim()).toBe('');
  });
});
