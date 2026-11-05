import { newE2EPage } from '@stencil/core/testing';

/* Runtime trail changes (gate-1 defects): separator updates, focus after the overflow
   toggle removes itself, and keeping exactly one current page when crumbs change. */
describe('md-breadcrumbs runtime trail', () => {
  const trail = `
    <md-breadcrumbs max-items="4">
      <md-breadcrumb-item id="home" href="#home">Home</md-breadcrumb-item>
      <md-breadcrumb-item id="team" href="#team">Team</md-breadcrumb-item>
      <md-breadcrumb-item id="project" href="#project">Project</md-breadcrumb-item>
      <md-breadcrumb-item id="folder" href="#folder">Folder</md-breadcrumb-item>
      <md-breadcrumb-item id="docs" href="#docs">Docs</md-breadcrumb-item>
      <md-breadcrumb-item id="page">Page</md-breadcrumb-item>
    </md-breadcrumbs>`;
  const separators = (page: any) => page.evaluate(() => Array.from(document.querySelectorAll('md-breadcrumb-item'))
    .map(el => el.shadowRoot!.querySelector('[part="separator"]')?.textContent ?? null));
  const currentIds = (page: any) => page.evaluate(() => Array.from(document.querySelectorAll('md-breadcrumb-item'))
    .filter(el => el.shadowRoot!.querySelector('[aria-current="page"]')).map(el => el.id));

  it('redraws every crumb separator when the separator prop changes', async () => {
    const page = await newE2EPage();
    await page.setContent(trail);
    await page.waitForChanges();
    const host = await page.find('md-breadcrumbs');
    host.setProperty('separator', '›');
    await page.waitForChanges();
    expect(await separators(page)).toEqual([null, null, null, null, '›', '›']);
    await host.callMethod('expand');
    await page.waitForChanges();
    expect(await separators(page)).toEqual([null, '›', '›', '›', '›', '›']);
  });

  it.each(['Enter', 'click'])('moves focus to the first revealed crumb when the overflow toggle expands the trail (%s)', async how => {
    const page = await newE2EPage();
    await page.setContent(`<button id="before">before</button>${trail}`);
    await page.waitForChanges();
    if (how === 'Enter') {
      await page.evaluate(() => document.querySelector('md-breadcrumbs')!.shadowRoot!.querySelector<HTMLButtonElement>('[part="overflow-button"]')!.focus());
      await page.keyboard.press('Enter');
    } else {
      const toggle = await page.find('md-breadcrumbs >>> [part="overflow-button"]');
      await toggle.click();
    }
    await page.waitForChanges();
    await page.waitForFunction(() => document.activeElement?.id === 'team');
    expect(await page.evaluate(() => document.getElementById('team')!.shadowRoot!.activeElement?.tagName)).toBe('A');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('project');
  });

  it('skips revealed static crumbs when moving focus after expanding', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-breadcrumbs max-items="3">
      <md-breadcrumb-item id="a" href="#a">A</md-breadcrumb-item>
      <md-breadcrumb-item id="b">B</md-breadcrumb-item>
      <md-breadcrumb-item id="c" href="#c">C</md-breadcrumb-item>
      <md-breadcrumb-item id="d" href="#d">D</md-breadcrumb-item>
      <md-breadcrumb-item id="e">E</md-breadcrumb-item>
    </md-breadcrumbs>`);
    await page.waitForChanges();
    const toggle = await page.find('md-breadcrumbs >>> [part="overflow-button"]');
    await toggle.click();
    await page.waitForFunction(() => document.activeElement?.id === 'c');
  });

  it('keeps a single current page when an author marks a visible non-last crumb current at runtime', async () => {
    const page = await newE2EPage();
    await page.setContent(trail);
    await page.waitForChanges();
    expect(await currentIds(page)).toEqual(['page']);
    await page.evaluate(() => { (document.getElementById('docs') as HTMLMdBreadcrumbItemElement).current = true; });
    await page.waitForChanges();
    await page.waitForChanges();
    expect(await currentIds(page)).toEqual(['docs']);
    await page.evaluate(() => { (document.getElementById('docs') as HTMLMdBreadcrumbItemElement).current = false; });
    await page.waitForChanges();
    await page.waitForChanges();
    expect(await currentIds(page)).toEqual(['page']);
  });

  it('promotes only the new last crumb when a crumb is appended', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-breadcrumbs><md-breadcrumb-item id="a" href="#a">A</md-breadcrumb-item><md-breadcrumb-item id="b">B</md-breadcrumb-item></md-breadcrumbs>`);
    await page.waitForChanges();
    await page.evaluate(() => { const c = document.createElement('md-breadcrumb-item'); c.id = 'c'; c.textContent = 'C'; document.querySelector('md-breadcrumbs')!.append(c); });
    await page.waitForChanges();
    await page.waitForChanges();
    expect(await currentIds(page)).toEqual(['c']);
    expect(await page.evaluate(() => (document.getElementById('b') as HTMLMdBreadcrumbItemElement).current)).toBe(false);
  });

  it('colours resting crumbs with the trail text-colour hook, under the per-item link colour', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-breadcrumbs style="--md-breadcrumbs-text-color: rgb(46, 125, 50)">
      <md-breadcrumb-item id="a" href="#a">A</md-breadcrumb-item>
      <md-breadcrumb-item id="b">B</md-breadcrumb-item>
      <md-breadcrumb-item id="c" href="#c" style="--md-breadcrumb-item-link-color: rgb(21, 101, 192)">C</md-breadcrumb-item>
      <md-breadcrumb-item id="d">D</md-breadcrumb-item>
    </md-breadcrumbs>`);
    await page.waitForChanges();
    const colors = await page.evaluate(() => ['a', 'b', 'c', 'd'].map(id =>
      getComputedStyle(document.getElementById(id)!.shadowRoot!.querySelector('a, [part="static"]')!).color));
    expect(colors.slice(0, 3)).toEqual(['rgb(46, 125, 50)', 'rgb(46, 125, 50)', 'rgb(21, 101, 192)']);
    expect(colors[3]).not.toBe('rgb(46, 125, 50)'); // the current page keeps its own colour
  });

  const enterAnimations = (page: any, id: string) => page.evaluate((hostId: string) =>
    Array.from(document.querySelectorAll(`#${hostId} md-breadcrumb-item`)).map(el => el.getAnimations().map(a => ({
      name: (a as CSSAnimation).animationName, delay: (a.effect as KeyframeEffect).getTiming().delay,
    }))), id);
  const twoTrails = `
    <div dir="rtl"><md-breadcrumbs id="r">
      <md-breadcrumb-item href="#a">A</md-breadcrumb-item><md-breadcrumb-item href="#b">B</md-breadcrumb-item><md-breadcrumb-item>C</md-breadcrumb-item>
    </md-breadcrumbs></div>
    <md-breadcrumbs id="l" style="--md-breadcrumbs-stagger: 100ms">
      <md-breadcrumb-item href="#a">A</md-breadcrumb-item><md-breadcrumb-item href="#b">B</md-breadcrumb-item><md-breadcrumb-item>C</md-breadcrumb-item>
    </md-breadcrumbs>`;

  it('plays the staggered entrance on every crumb, mirrored in RTL', async () => {
    const page = await newE2EPage();
    await page.setContent(twoTrails);
    await page.waitForChanges();
    expect(await enterAnimations(page, 'l')).toEqual([
      [{ name: 'md-breadcrumb-enter', delay: 0 }],
      [{ name: 'md-breadcrumb-enter', delay: 100 }],
      [{ name: 'md-breadcrumb-enter', delay: 200 }],
    ]);
    expect((await enterAnimations(page, 'r')).map((list: { name: string }[]) => list.map(a => a.name)))
      .toEqual([['md-breadcrumb-enter-rtl'], ['md-breadcrumb-enter-rtl'], ['md-breadcrumb-enter-rtl']]);
  });

  it('skips the entrance under reduced motion', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(twoTrails);
    await page.waitForChanges();
    expect(await enterAnimations(page, 'l')).toEqual([[], [], []]);
  });

  it.each([[1, ['home', 'toggle', 'docs']], [0, ['toggle', 'docs']], [2, ['home', 'team', 'toggle', 'docs']]])(
    'reaches the overflow toggle in visual order with %i crumb(s) before it', async (before, order) => {
      const page = await newE2EPage();
      await page.setContent(`<button id="start">start</button>${trail.replace('max-items="4"', `max-items="4" items-before-collapse="${before}"`)}`);
      await page.waitForChanges();
      await page.focus('#start');
      const seen: string[] = [];
      for (let i = 0; i < order.length; i += 1) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => {
          const a = document.activeElement as HTMLElement;
          return a.localName === 'md-breadcrumbs' ? 'toggle' : a.id;
        }));
      }
      expect(seen).toEqual(order);
    });
});
