import { newSpecPage } from '@stencil/core/testing';
import { MdCard } from './md-card';

const pointer = (type: string, x = 0, id = 1) => Object.assign(
  new Event(type, { bubbles: true, cancelable: true }),
  { clientX: x, clientY: 10, button: 0, pointerId: id, isPrimary: true },
);
async function create(content = 'Content') {
  const page = await newSpecPage({ components: [MdCard], html: `<md-card interactive drag-enabled>${content}</md-card>` });
  const el = page.root!;
  el.setPointerCapture = jest.fn();
  el.releasePointerCapture = jest.fn();
  return { page, el, instance: page.rootInstance as any };
}

describe('md-card interaction ownership', () => {
  it('does not hijack keyboard events from authored controls', async () => {
    const { page, el } = await create('<input><button>Save</button>');
    const activate = jest.fn(); el.addEventListener('mdClick', activate);
    const key = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    el.querySelector('input')!.dispatchEvent(key);
    await page.waitForChanges();
    expect(key.defaultPrevented).toBe(false);
    expect(activate).not.toHaveBeenCalled();
  });

  it('does not capture a drag started on an authored button', async () => {
    const { page, el } = await create('<button>Save</button>');
    const start = jest.fn(); el.addEventListener('mdDragStart', start);
    el.querySelector('button')!.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointermove', 30));
    await page.waitForChanges();
    expect(start).not.toHaveBeenCalled();
    expect(el.setPointerCapture).not.toHaveBeenCalled();
  });

  it('ignores unrelated pointers without losing the original drag origin', async () => {
    const { page, el } = await create();
    const move = jest.fn(); const end = jest.fn();
    el.addEventListener('mdDragMove', move); el.addEventListener('mdDragEnd', end);
    el.dispatchEvent(pointer('pointerdown', 10, 1));
    el.dispatchEvent(pointer('pointerdown', 100, 2));
    el.dispatchEvent(pointer('pointermove', 150, 2));
    el.dispatchEvent(pointer('pointerup', 150, 2));
    el.dispatchEvent(pointer('pointermove', 30, 1));
    await page.waitForChanges();
    expect(end).not.toHaveBeenCalled(); expect(move).toHaveBeenCalledTimes(1);
    expect(move.mock.calls[0][0].detail).toMatchObject({ startX: 10, offsetX: 20 });
  });

  it.each(['pointercancel', 'lostpointercapture'])('aborts %s without reporting a successful release', async (type) => {
    const { page, el } = await create(); const end = jest.fn(); el.addEventListener('mdDragEnd', end);
    el.dispatchEvent(pointer('pointerdown')); el.dispatchEvent(pointer('pointermove', 30));
    el.dispatchEvent(pointer(type, 30)); await page.waitForChanges();
    expect(end).not.toHaveBeenCalled(); expect(el).not.toHaveClass('md-card--dragged');
    expect(el.style.transform).toBe('');
  });

  it.each(['disabled', 'softDisabled'])('cancels when %s changes during a drag', async (property) => {
    const { page, el, instance } = await create(); const end = jest.fn(); el.addEventListener('mdDragEnd', end);
    el.dispatchEvent(pointer('pointerdown')); el.dispatchEvent(pointer('pointermove', 30));
    instance[property] = true; await page.waitForChanges();
    el.dispatchEvent(pointer('pointermove', 80)); el.dispatchEvent(pointer('pointerup', 80));
    await page.waitForChanges();
    expect(end).not.toHaveBeenCalled(); expect(el).not.toHaveClass('md-card--dragged');
    expect(el.style.transform).toBe('');
  });

  it('restores authored transform and stacking styles after drag and preserves them when no drag occurred', async () => {
    const { page, el, instance } = await create();
    el.style.setProperty('transform', 'scale(0.9)', 'important'); el.style.zIndex = '7';
    instance.cancelDrag(); expect(el.style.transform).toBe('scale(0.9)');
    el.dispatchEvent(pointer('pointerdown')); el.dispatchEvent(pointer('pointermove', 30));
    el.dispatchEvent(pointer('pointerup', 30)); await page.waitForChanges();
    expect(el.style.transform).toBe('scale(0.9)');
    // The browser lifecycle fixture additionally verifies CSS priority; mock-doc does not implement it.
    expect(el.style.zIndex).toBe('7'); expect(el.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('does not advertise a button around generic focusable content', async () => {
    const { el } = await create('<div tabindex="0">Custom control</div>');
    expect(el.getAttribute('role')).toBeNull(); expect(el.getAttribute('tabindex')).toBeNull();
  });
});
