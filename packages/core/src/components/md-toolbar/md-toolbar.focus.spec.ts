import { newSpecPage } from '@stencil/core/testing';
import { MdToolbar } from './md-toolbar';
import { MdButton } from '../md-button/md-button';
import { MdIconButton } from '../md-icon-button/md-icon-button';

describe('md-toolbar public focus coordination', () => {
  it('remembers pointer-focused controls for setFocus and restores authored tab stops on teardown', async () => {
    const page = await newSpecPage({ components: [MdToolbar], html: '<md-toolbar aria-label="Tools"><button id="one" tabindex="3">One</button><button id="two">Two</button></md-toolbar>' });
    const root = page.root as HTMLMdToolbarElement;
    const one = root.querySelector('#one') as HTMLElement;
    const two = root.querySelector('#two') as HTMLElement;
    const focus = jest.spyOn(two, 'focus');
    two.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(one.getAttribute('tabindex')).toBe('-1');
    expect(two.getAttribute('tabindex')).toBe('0');
    await root.setFocus(); expect(focus).toHaveBeenCalledTimes(1);
    root.containerSemantics = 'generic'; await page.waitForChanges();
    expect(one.getAttribute('tabindex')).toBe('3');
    expect(two.hasAttribute('tabindex')).toBe(false);
    root.containerSemantics = 'toolbar'; await page.waitForChanges();
    root.remove(); await page.waitForChanges();
    expect(one.getAttribute('tabindex')).toBe('3');
  });

  it('vertical navigation wraps, ignores horizontal arrows, and skips an independent checkbox', async () => {
    const page = await newSpecPage({ components: [MdToolbar], html: '<md-toolbar aria-label="Tools" variant="floating" layout="vertical"><button id="one">One</button><input type="checkbox"><button id="two">Two</button></md-toolbar>' });
    const root = page.root!;
    const one = root.querySelector('#one') as HTMLElement;
    const two = root.querySelector('#two') as HTMLElement;
    const focused: string[] = []; one.focus = () => focused.push('one'); two.focus = () => focused.push('two');
    const key = (from: HTMLElement, value: string) => {
      const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
      event.composedPath = () => [from, root]; from.dispatchEvent(event); return event;
    };
    expect(key(one, 'ArrowRight').defaultPrevented).toBe(false);
    key(one, 'ArrowDown'); key(two, 'ArrowDown'); key(one, 'ArrowUp');
    expect(focused).toEqual(['two', 'one', 'two']);
    expect(root.querySelector('input')!.hasAttribute('tabindex')).toBe(false);
  });
});

describe('md-toolbar authored composite and generic controls', () => {
  it('delegates cooperating component Tab stops and restores them when generic semantics take over', async () => {
    const page = await newSpecPage({ components: [MdToolbar, MdButton, MdIconButton], html: '<md-toolbar aria-label="Actions"><md-button id="first">First</md-button><md-icon-button id="second"></md-icon-button><div tabindex="0"><button id="nested">Nested</button></div><div tabindex="0" id="custom">Custom action</div><button tabindex="-1">Opted out</button></md-toolbar>' });
    const root = page.root as HTMLMdToolbarElement;
    const first = root.querySelector('#first') as HTMLElement & { groupTabindex: number | null };
    const second = root.querySelector('#second') as HTMLElement & { groupTabindex: number | null };
    expect(first.groupTabindex).toBe(0); expect(second.groupTabindex).toBe(-1);
    second.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(first.groupTabindex).toBe(-1); expect(second.groupTabindex).toBe(0);
    root.containerSemantics = 'generic'; await page.waitForChanges();
    expect(first.groupTabindex).toBeNull(); expect(second.groupTabindex).toBeNull();
    expect(root.querySelector('#custom')!.getAttribute('tabindex')).toBe('0');
    expect(root.querySelector('#nested')!.hasAttribute('tabindex')).toBe(false);
  });
});

describe('md-toolbar slotted ordering and empty focus', () => {
  it('orders leading before default before trailing and excludes hidden wrappers and independent composites', async () => {
    const page = await newSpecPage({ components: [MdToolbar], html: '<md-toolbar aria-label="Actions"><button id="trailing" slot="trailing">Trailing</button><button id="default">Default</button><button id="leading" slot="leading">Leading</button><div aria-hidden="true"><button>Hidden</button></div><div role="radiogroup"><button>Independent</button></div></md-toolbar>' });
    const root = page.root as HTMLMdToolbarElement; const leading = root.querySelector('#leading') as HTMLElement; const trailing = root.querySelector('#trailing') as HTMLElement;
    expect(leading.getAttribute('tabindex')).toBe('0'); expect(root.querySelector('[aria-hidden] button')!.hasAttribute('tabindex')).toBe(false);
    const focus = jest.spyOn(trailing, 'focus').mockImplementation(() => undefined);
    const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true }); event.composedPath = () => [leading, root]; leading.dispatchEvent(event);
    expect(focus).toHaveBeenCalled();
    root.innerHTML = ''; root.shadowRoot!.querySelector('slot')!.dispatchEvent(new Event('slotchange')); await page.waitForChanges();
    await new Promise(resolve => setTimeout(resolve, 25)); await root.setFocus();
    root.remove(); page.body.append(root); await page.waitForChanges(); await root.setFocus();
    expect(root.children.length).toBe(0);
  });
});
