import { newE2EPage, type E2EPage } from '@stencil/core/testing';

// Contract checks for documented behaviour that the original suites did not cover.
const TREE = [{
  id: 'root', name: 'Avery', title: 'Director',
  children: [
    { id: 'engineering', name: 'Blair', title: 'Engineering', children: [{ id: 'developer', name: 'Casey' }] },
    { id: 'operations', name: 'Devon', title: 'Operations', selectable: false },
  ],
}];

async function mount(page: E2EPage, attrs = '', nodes: unknown = TREE) {
  await page.setContent(`<button id="before">before</button><md-organization-chart label="Project team" ${attrs}></md-organization-chart>`);
  const chart = await page.find('md-organization-chart');
  await chart.setProperty('nodes', nodes);
  await page.waitForChanges();
  return chart;
}

function tabStops(page: E2EPage) {
  return page.evaluate(() => Array.from(
    document.querySelector('md-organization-chart')!.shadowRoot!.querySelectorAll('[role="treeitem"][tabindex="0"]'),
    (item) => item.getAttribute('data-id'),
  ));
}

function focusedId(page: E2EPage) {
  return page.evaluate(() => document.querySelector('md-organization-chart')!.shadowRoot!.activeElement?.getAttribute('data-id') ?? null);
}

function trailIds(page: E2EPage) {
  return page.evaluate(() => Array.from(
    document.querySelector('md-organization-chart')!.shadowRoot!.querySelectorAll('[part~="branch-on-path"]'),
    (branch) => branch.getAttribute('data-id'),
  ));
}

function visibleIds(page: E2EPage) {
  return page.evaluate(() => Array.from(
    document.querySelector('md-organization-chart')!.shadowRoot!.querySelectorAll('[role="treeitem"]'),
    (item) => item.getAttribute('data-id'),
  ));
}

describe('md-organization-chart node accent', () => {
  // readme: "`accent` (a CSS colour for the avatar ring and selected tint)" — "colours that node's
  // avatar ring and selected state only".
  it('tints the selected ring, the selected state layer and the avatar ring of that node only', async () => {
    const page = await newE2EPage();
    // Reduced motion removes the 300ms border/state-layer transitions so the settled colours are read.
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const chart = await mount(page, 'selection-mode="multiple"', [{
      id: 'root', name: 'Avery', accent: 'rgb(255, 0, 0)',
      children: [{ id: 'plain', name: 'Blair' }],
    }]);
    await chart.setProperty('selectedIds', ['root', 'plain']);
    await page.waitForChanges();
    const styles = await page.evaluate(() => {
      const root = document.querySelector('md-organization-chart')!.shadowRoot!;
      const read = (id: string) => {
        const node = root.querySelector(`[data-id="${id}"] > [part~="node"]`) as HTMLElement;
        const layer = node.querySelector('[part="state-layer"]') as HTMLElement;
        const avatar = node.querySelector('[part="avatar"]') as HTMLElement;
        return {
          border: getComputedStyle(node).borderTopColor,
          layer: getComputedStyle(layer).backgroundColor,
          avatarRing: getComputedStyle(avatar).boxShadow,
        };
      };
      return { accent: read('root'), plain: read('plain') };
    });
    expect(styles.accent.border).toBe('rgb(255, 0, 0)');
    expect(styles.accent.layer).toBe('rgb(255, 0, 0)');
    expect(styles.accent.avatarRing).toContain('rgb(255, 0, 0)');
    // A node without an accent keeps the shared selected colour and no ring.
    expect(styles.plain.border).toBe('rgb(103, 80, 164)');
    expect(styles.plain.avatarRing).toBe('none');
  });
});

describe('md-organization-chart roving tab stop under collapse', () => {
  it('moves the tab stop and focus to a pointer-collapsed ancestor of the focused node', async () => {
    const page = await newE2EPage();
    const chart = await mount(page);
    const toggle = await chart.spyOnEvent('mdNodeToggle');
    await (await page.find('md-organization-chart >>> [data-id="root"]')).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect(await focusedId(page)).toBe('developer');
    // Collapse the root with the pointer: the focused node and the tab stop disappear with it.
    await (await page.find('md-organization-chart >>> [data-id="root"] > [part~="node"] [part="toggle"]')).click();
    await page.waitForChanges();
    expect(toggle.lastEvent.detail.expanded).toBe(false);
    expect(await visibleIds(page)).toEqual(['root']);
    expect(await tabStops(page)).toEqual(['root']);
    expect(await focusedId(page)).toBe('root');
    // The tree is still reachable from the page's tab order.
    await (await page.find('#before')).focus();
    await page.keyboard.press('Tab');
    expect(await focusedId(page)).toBe('root');
  });

  it('keeps a visible tab stop when new data folds the active node away', async () => {
    const page = await newE2EPage();
    const chart = await mount(page);
    await (await page.find('md-organization-chart >>> [data-id="root"]')).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect(await tabStops(page)).toEqual(['developer']);
    await chart.setProperty('nodes', [{ ...TREE[0], children: [{ ...TREE[0].children[0], expanded: false }, TREE[0].children[1]] }]);
    await page.waitForChanges();
    expect(await visibleIds(page)).toEqual(['root', 'engineering', 'operations']);
    expect(await tabStops(page)).toEqual(['engineering']);
    // Focus was on the removed row: it follows the tab stop instead of dropping to <body>.
    expect(await focusedId(page)).toBe('engineering');
  });

  it('keeps focus in the tree when re-enabling collapsible folds the focused row away', async () => {
    const page = await newE2EPage();
    const chart = await mount(page, 'collapsible="false"', [{ ...TREE[0], children: [{ ...TREE[0].children[0], expanded: false }, TREE[0].children[1]] }]);
    await (await page.find('md-organization-chart >>> [data-id="root"]')).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect(await focusedId(page)).toBe('developer');
    await chart.setProperty('collapsible', true);
    await page.waitForChanges();
    expect(await visibleIds(page)).toEqual(['root', 'engineering', 'operations']);
    expect(await tabStops(page)).toEqual(['engineering']);
    expect(await focusedId(page)).toBe('engineering');
  });

  it('does not take focus when the page focus is elsewhere (guard)', async () => {
    const page = await newE2EPage();
    const chart = await mount(page);
    await (await page.find('md-organization-chart >>> [data-id="root"]')).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await (await page.find('#before')).focus();
    await chart.setProperty('nodes', [{ ...TREE[0], children: [{ ...TREE[0].children[0], expanded: false }, TREE[0].children[1]] }]);
    await page.waitForChanges();
    expect(await tabStops(page)).toEqual(['engineering']);
    expect(await page.evaluate(() => document.activeElement!.id)).toBe('before');
  });
});

describe('md-organization-chart collapsible="false"', () => {
  // readme: "collapsible — default: ON; set collapsible="false" to lock branches open".
  it('locks every branch open: data folds, arrow keys and activation do not collapse', async () => {
    const page = await newE2EPage();
    const chart = await mount(page, 'collapsible="false"', [{ ...TREE[0], children: [{ ...TREE[0].children[0], expanded: false }, TREE[0].children[1]] }]);
    const toggle = await chart.spyOnEvent('mdNodeToggle');
    expect(await visibleIds(page)).toEqual(['root', 'engineering', 'developer', 'operations']);
    expect(await page.find('md-organization-chart >>> [part="toggle"]')).toBeNull();
    await (await page.find('md-organization-chart >>> [data-id="root"]')).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(toggle).not.toHaveReceivedEvent();
    expect(await visibleIds(page)).toEqual(['root', 'engineering', 'developer', 'operations']);
    // Backward from a locked-open child still ascends to its parent.
    await page.keyboard.press('ArrowRight');
    await page.waitForChanges();
    expect(await focusedId(page)).toBe('engineering');
    await page.keyboard.press('ArrowLeft');
    await page.waitForChanges();
    expect(await focusedId(page)).toBe('root');
    expect(toggle).not.toHaveReceivedEvent();
  });

  it('collapses again once collapsible is re-enabled (guard)', async () => {
    const page = await newE2EPage();
    const chart = await mount(page, 'collapsible="false"');
    const toggle = await chart.spyOnEvent('mdNodeToggle');
    await chart.setProperty('collapsible', true);
    await page.waitForChanges();
    await (await page.find('md-organization-chart >>> [data-id="root"]')).press('ArrowLeft');
    await page.waitForChanges();
    expect(toggle.lastEvent.detail.expanded).toBe(false);
    expect(await visibleIds(page)).toEqual(['root']);
  });
});

describe('md-organization-chart selection trail', () => {
  // readme: "`branch-on-path` (present on the selected branch and every ancestor of it)".
  it('draws no trail for ids that cannot be selected', async () => {
    const page = await newE2EPage();
    const chart = await mount(page, 'selection-mode="none"');
    await chart.setProperty('selectedIds', ['developer']);
    await page.waitForChanges();
    expect(await trailIds(page)).toEqual([]);
    expect(await page.evaluate(() => document.querySelector('md-organization-chart')!.shadowRoot!.querySelectorAll('[part~="node-selected"]').length)).toBe(0);
    // selectable: false is exempt in a selecting chart too.
    await chart.setProperty('selectionMode', 'single');
    await chart.setProperty('selectedIds', ['operations']);
    await page.waitForChanges();
    expect(await trailIds(page)).toEqual([]);
    // Guard: a selectable id still draws its trail.
    await chart.setProperty('selectedIds', ['developer']);
    await page.waitForChanges();
    expect(await trailIds(page)).toEqual(['root', 'engineering', 'developer']);
  });
});

describe('md-organization-chart horizontal enter motion', () => {
  // Horizontal trees flow from the reading start, so a group grows in from its parent's side.
  it.each(['ltr', 'rtl'] as const)('slides a reopened group in from the parent side (%s)', async (direction) => {
    const page = await newE2EPage();
    const chart = await mount(page, `orientation="horizontal" dir="${direction}"`);
    await (await page.find('md-organization-chart >>> [data-id="root"]')).press(direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
    await page.waitForChanges();
    await (await page.find('md-organization-chart >>> [data-id="root"]')).press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    await page.waitForChanges();
    const motion = await page.evaluate(() => {
      const group = document.querySelector('md-organization-chart')!.shadowRoot!.querySelector('[data-id="root"] > [role="group"]') as HTMLElement;
      const animation = group.getAnimations()[0] as CSSAnimation | undefined;
      const from = animation ? (animation.effect as KeyframeEffect).getKeyframes()[0].transform : null;
      // Layout border-box width (what transform-origin resolves against), not the scaled bounding box.
      const cs = getComputedStyle(group);
      return { from, origin: cs.transformOrigin, width: parseFloat(cs.width) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) };
    });
    expect(chart).toBeTruthy();
    expect(motion.from).toBe(direction === 'rtl' ? 'translateX(8px) scale(0.96)' : 'translateX(-8px) scale(0.96)');
    // transform-origin resolves to pixels: the inline-start edge is x = 0 in LTR, the full width in RTL.
    const originX = parseFloat(String(motion.origin).split(' ')[0]);
    expect(originX).toBeCloseTo(direction === 'rtl' ? motion.width : 0, 0);
  });
});

describe('md-organization-chart selection trail geometry', () => {
  // readme: "`branch-on-path` … so the connectors can trace a selection back to its root". The run
  // from the parent's drop to the selected child's riser must lie on those connectors in every
  // orientation and reading direction: same pixels as the drop and the riser, the bus side and
  // the riser side drawn, rounded only where the grey connector rounds (the outermost child).
  const PAIR = [{ id: 'p', name: 'Avery', title: 'Director', children: [
    { id: 'wide', name: 'Emery Featherstonehaugh-Lowell', title: 'A much wider card than its sibling' },
    { id: 'mid', name: 'Middle' },
    { id: 'short', name: 'Bo' },
  ] }];
  const measure = (id: string) => `(() => {
    const chart = document.querySelector('md-organization-chart');
    const horizontal = chart.getAttribute('orientation') === 'horizontal';
    const sr = chart.shadowRoot, li = sr.querySelector('li[data-id="${id}"]'), group = li.parentElement;
    const branches = Array.from(group.children);
    const isLast = li === branches[branches.length - 1];
    const box = (el, pseudo) => {
      const r = el.getBoundingClientRect(), c = getComputedStyle(el, pseudo), bb = c.boxSizing === 'border-box';
      const b = { t: parseFloat(c.borderTopWidth), r: parseFloat(c.borderRightWidth), b: parseFloat(c.borderBottomWidth), l: parseFloat(c.borderLeftWidth) };
      const x0 = r.left + parseFloat(c.left), y0 = r.top + parseFloat(c.top);
      return { x0, y0, x1: x0 + parseFloat(c.width) + (bb ? 0 : b.l + b.r), y1: y0 + parseFloat(c.height) + (bb ? 0 : b.t + b.b), b, c };
    };
    // The riser (one border of one pseudo-element) and the drop, as intervals on the bus axis.
    const rp = box(li, isLast ? '::before' : '::after'), dp = box(group, '::before');
    const line = (p, sides) => {
      const s = sides.find(k => p.b[k] > 0);
      const at = { l: [p.x0, p.x0 + p.b.l], r: [p.x1 - p.b.r, p.x1], t: [p.y0, p.y0 + p.b.t], b: [p.y1 - p.b.b, p.y1] }[s];
      const color = { l: p.c.borderLeftColor, r: p.c.borderRightColor, t: p.c.borderTopColor, b: p.c.borderBottomColor }[s];
      return { side: s, at, color };
    };
    const riser = line(rp, horizontal ? ['t', 'b'] : ['l', 'r']);
    const drop = horizontal ? { side: 't', at: [dp.y0, dp.y0 + dp.b.t], color: dp.c.borderTopColor } : line(dp, ['l', 'r']);
    const run = group.hasAttribute('data-trail-run') ? box(group, '::after') : null;
    const lr = li.getBoundingClientRect(), gr = group.getBoundingClientRect();
    const outermost = horizontal ? (riser.at[0] > drop.at[0] ? isLast : li === branches[0])
      : (() => { const xs = branches.map(b => b.getBoundingClientRect().left); return riser.at[0] > drop.at[0] ? lr.left === Math.max(...xs) : lr.left === Math.min(...xs); })();
    return {
      horizontal, riser, drop, outermost,
      run: run && { x0: run.x0, x1: run.x1, y0: run.y0, y1: run.y1, b: run.b, color: run.c.borderTopColor === 'rgba(0, 0, 0, 0)' ? run.c.borderLeftColor : run.c.borderTopColor,
        radii: { tl: run.c.borderTopLeftRadius, tr: run.c.borderTopRightRadius, bl: run.c.borderBottomLeftRadius, br: run.c.borderBottomRightRadius } },
      branch: { x0: lr.left, x1: lr.right, y0: lr.top }, group: { x0: gr.left, x1: gr.right },
      levelGap: parseFloat(getComputedStyle(group)[horizontal ? (getComputedStyle(chart).direction === 'rtl' ? 'paddingRight' : 'paddingLeft') : 'paddingTop']),
      busHalf: horizontal && !isLast ? line(rp, ['l', 'r']).color : null,
    };
  })()`;
  const SELECTED = 'rgb(103, 80, 164)';
  for (const orientation of ['vertical', 'horizontal'] as const) {
    for (const direction of ['ltr', 'rtl'] as const) {
      it.each(['wide', 'short'])(`lands the run on the drop and the riser (${orientation}, ${direction}, %s)`, async (id) => {
        const page = await newE2EPage();
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        const chart = await mount(page, `orientation="${orientation}" dir="${direction}" selection-mode="single" style="width:900px"`, PAIR);
        await chart.setProperty('selectedIds', [id]);
        await page.waitForChanges();
        const g: any = await page.evaluate(measure(id));
        // The drop and the selected riser are tinted; a horizontal riser leaves its bus half grey.
        expect(g.drop.color).toBe(SELECTED);
        expect(g.riser.color).toBe(SELECTED);
        if (g.busHalf) expect(g.busHalf).not.toBe(SELECTED);
        expect(g.run).not.toBeNull();
        const run = g.run!;
        expect(run.color).toBe(SELECTED);
        // Along the bus: exactly from the drop's line to the riser's line, both included.
        const lo = Math.min(g.drop.at[0], g.riser.at[0]), hi = Math.max(g.drop.at[1], g.riser.at[1]);
        const [a0, a1] = g.horizontal ? [run.y0, run.y1] : [run.x0, run.x1];
        expect(a0).toBeCloseTo(lo, 0);
        expect(a1).toBeCloseTo(hi, 0);
        // Across the bus: the riser's length, starting on the bus.
        if (g.horizontal) {
          if (direction === 'rtl') expect(run.x1).toBeCloseTo(g.branch.x1, 0); else expect(run.x0).toBeCloseTo(g.branch.x0, 0);
          expect(run.x1 - run.x0).toBeCloseTo(g.levelGap, 0);
        } else {
          expect(run.y0).toBeCloseTo(g.branch.y0, 0);
          expect(run.y1 - run.y0).toBeCloseTo(g.levelGap, 0);
        }
        // The far end turns into the riser on the riser's side, rounded only at the outermost child.
        const far = g.horizontal ? (g.riser.at[0] > g.drop.at[0] ? 'b' : 't') : (g.riser.at[0] > g.drop.at[0] ? 'r' : 'l');
        expect((run.b as Record<string, number>)[far]).toBeGreaterThan(0);
        const bus = g.horizontal ? (direction === 'rtl' ? 'r' : 'l') : 't';
        const corner = g.horizontal ? (far === 'b' ? 'b' : 't') + bus : 't' + far;
        expect((run.radii as Record<string, string>)[corner]).toBe(g.outermost ? '12px' : '0px');
      });
    }
  }
});

describe('md-organization-chart hung toggler room', () => {
  // The viewport pads the edge the togglers hang over by half a toggler plus 10px ("room so the
  // edge-hung toggler isn't clipped by overflow"). In a horizontal tree that edge is the inline
  // end, which is the left in RTL; the inline start keeps the plain 8px.
  it('pads the inline end of a horizontal viewport in LTR and RTL', async () => {
    const page = await newE2EPage();
    await page.setContent(['ltr', 'rtl'].map(d => `<div dir="${d}"><md-organization-chart orientation="horizontal"></md-organization-chart></div>`).join(''));
    for (const chart of await page.findAll('md-organization-chart')) await chart.setProperty('nodes', [{ id: 'root', name: 'Avery', children: [{ id: 'eng', name: 'Blair' }] }]);
    await page.waitForChanges();
    const pads = await page.evaluate(() => Array.from(document.querySelectorAll('md-organization-chart'), (chart) => {
      const s = getComputedStyle(chart.shadowRoot!.querySelector('[part="viewport"]')!);
      return [s.paddingLeft, s.paddingRight, s.paddingTop, s.paddingBottom];
    }));
    expect(pads[0]).toEqual(['8px', '22px', '8px', '8px']);
    expect(pads[1]).toEqual(['22px', '8px', '8px', '8px']);
  });
});
