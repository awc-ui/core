import { newE2EPage } from '@stencil/core/testing';

describe('md-card e2e', () => {
  it('drag-enabled reflects and exposes the draggable state (pointer contract)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-card drag-enabled>Drag me</md-card>');
    await page.waitForChanges();

    // The drag implementation is POINTER-EVENT based (threshold + capture +
    // transform-follow), NOT HTML5 native drag — there is deliberately no
    // `draggable` attribute. The public surface is the reflected prop, the
    // modifier class and aria-grabbed.
    const state = await page.$eval('md-card', (el) => ({
      reflected: el.hasAttribute('drag-enabled'),
      draggableAttr: el.getAttribute('draggable'),
      cls: el.classList.contains('md-card--draggable'),
      grabbed: el.getAttribute('aria-grabbed'),
    }));
    expect(state.reflected).toBe(true);
    expect(state.draggableAttr).toBeNull();
    expect(state.cls).toBe(true);
    expect(state.grabbed).toBe('false');
  });

  it('exposes no drag affordances when drag-enabled is absent', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-card>Not draggable</md-card>');
    await page.waitForChanges();

    const state = await page.$eval('md-card', (el) => ({
      cls: el.classList.contains('md-card--draggable'),
      grabbed: el.getAttribute('aria-grabbed'),
    }));
    expect(state.cls).toBe(false);
    expect(state.grabbed).toBeNull();
  });

  it('pointer drag past the threshold fires mdDragStart/Move and applies the dragged class', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-card drag-enabled style="width:200px;height:100px;position:fixed;left:40px;top:40px;">Drag me</md-card>',
    );
    await page.waitForChanges();

    const card = await page.find('md-card');
    const start = await card.spyOnEvent('mdDragStart');
    const move = await card.spyOnEvent('mdDragMove');

    // Real mouse gesture: down at the card center, move well past the 5px
    // Manhattan threshold.
    await page.mouse.move(140, 90);
    await page.mouse.down();
    await page.mouse.move(180, 120, { steps: 4 });
    await page.waitForChanges();

    expect(start).toHaveReceivedEventTimes(1);
    expect(move).toHaveReceivedEvent();
    const detail = start.events[0].detail as { startX: number; startY: number };
    expect(detail.startX).toBe(140);
    expect(detail.startY).toBe(90);

    const mid = await page.$eval('md-card', (el) => ({
      dragged: el.classList.contains('md-card--dragged'),
      grabbed: el.getAttribute('aria-grabbed'),
      transform: (el as HTMLElement).style.transform,
    }));
    expect(mid.dragged).toBe(true);
    expect(mid.grabbed).toBe('true');
    expect(mid.transform).toContain('translate(40px, 30px)');

    await page.mouse.up();
    await page.waitForChanges();
  });

  it('release ends the drag: mdDragEnd, class removed, transform reset', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-card drag-enabled style="width:200px;height:100px;position:fixed;left:40px;top:40px;">Drag me</md-card>',
    );
    await page.waitForChanges();

    const card = await page.find('md-card');
    const end = await card.spyOnEvent('mdDragEnd');

    await page.mouse.move(140, 90);
    await page.mouse.down();
    await page.mouse.move(200, 140, { steps: 4 });
    await page.mouse.up();
    await page.waitForChanges();

    expect(end).toHaveReceivedEventTimes(1);
    const state = await page.$eval('md-card', (el) => ({
      dragged: el.classList.contains('md-card--dragged'),
      grabbed: el.getAttribute('aria-grabbed'),
      transform: (el as HTMLElement).style.transform,
    }));
    expect(state.dragged).toBe(false);
    expect(state.grabbed).toBe('false');
    expect(state.transform).toBe('');
  });

  it('sub-threshold movement never starts a drag', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-card drag-enabled style="width:200px;height:100px;position:fixed;left:40px;top:40px;">Drag me</md-card>',
    );
    await page.waitForChanges();

    const card = await page.find('md-card');
    const start = await card.spyOnEvent('mdDragStart');

    await page.mouse.move(140, 90);
    await page.mouse.down();
    await page.mouse.move(141, 91); // Manhattan distance 2 < threshold 5
    await page.mouse.up();
    await page.waitForChanges();

    expect(start).toHaveReceivedEventTimes(0);
    const dragged = await page.$eval('md-card', (el) => el.classList.contains('md-card--dragged'));
    expect(dragged).toBe(false);
  });
});
