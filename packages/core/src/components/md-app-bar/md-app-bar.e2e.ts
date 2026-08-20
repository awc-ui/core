import { newE2EPage } from '@stencil/core/testing';

describe('md-app-bar e2e', () => {
  it('renders the default small variant', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-app-bar headline="Title"></md-app-bar>');
    const el = await page.find('md-app-bar');
    expect(el).toBeTruthy();
    expect(await el.getProperty('variant')).toBe('small');
  });

  it('renders medium variant with expanded title', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-app-bar variant="medium" headline="Album"></md-app-bar>');
    const expanded = await page.find('md-app-bar >>> [part="expanded"]');
    expect(expanded).toBeTruthy();
  });

  it('applies scrolled class and reflects scrolled property', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-app-bar scrolled headline="Title"></md-app-bar>');
    const el = await page.find('md-app-bar');
    expect(el).toHaveClass('md-app-bar--scrolled');
    expect(await el.getProperty('scrolled')).toBe(true);
  });

  it('emits mdLeadingClick from prop-based leading icon', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-app-bar leading-icon="menu" leading-icon-label="Menu"></md-app-bar>',
    );
    const spy = await page.spyOnEvent('mdLeadingClick');
    const button = await page.find('md-app-bar >>> [part="leading-icon"]');
    await button.click();
    expect(spy).toHaveReceivedEventTimes(1);
  });

  it('renders search variant with search field', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-app-bar variant="search" search-placeholder="Search"></md-app-bar>');
    const el = await page.find('md-app-bar');
    expect(await el.getProperty('variant')).toBe('search');
    const search = await page.find('md-app-bar >>> [part="search"]');
    expect(search).toBeTruthy();
  });

  it('emits mdSearchActivate when search field is focused', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-app-bar variant="search"></md-app-bar>');
    const spy = await page.spyOnEvent('mdSearchActivate');
    const input = await page.find('md-app-bar >>> [part="search-input"]');
    await input.focus();
    expect(spy).toHaveReceivedEventTimes(1);
  });

  it('keeps search-input text-align start when title-alignment is center', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-app-bar variant="search" title-alignment="center" search-placeholder="Search product"></md-app-bar>',
    );
    const textAlign = await page.evaluate(() => {
      const root = document.querySelector('md-app-bar')?.shadowRoot;
      const input = root?.querySelector('.md-app-bar__search-input') as HTMLElement | null;
      return input ? getComputedStyle(input).textAlign : '';
    });
    expect(textAlign).toBe('start');
  });

  it('applies at least 24px inline-start padding on the search text field', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-app-bar variant="search" search-placeholder="Search product"></md-app-bar>',
    );
    const paddingInlineStart = await page.evaluate(() => {
      const root = document.querySelector('md-app-bar')?.shadowRoot;
      const field = root?.querySelector('.md-app-bar__search-field') as HTMLElement | null;
      const input = root?.querySelector('.md-app-bar__search-input') as HTMLElement | null;
      const fieldPad = field
        ? Number.parseFloat(getComputedStyle(field).paddingInlineStart)
        : 0;
      const inputPad = input
        ? Number.parseFloat(getComputedStyle(input).paddingInlineStart)
        : 0;
      return Math.max(fieldPad, inputPad);
    });
    expect(paddingInlineStart).toBeGreaterThanOrEqual(24);
  });

  it('applies 8px search row gap and 64px row height', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-app-bar variant="search" search-placeholder="Search">
        <md-icon-button slot="leading" icon="menu" aria-label="Menu"></md-icon-button>
        <md-avatar slot="trailing" label="A"></md-avatar>
      </md-app-bar>
    `);
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('md-app-bar')?.shadowRoot;
      const row = root?.querySelector('.md-app-bar__row--search') as HTMLElement | null;
      if (!row) return null;
      const rowStyle = getComputedStyle(row);
      return {
        rowHeight: Number.parseFloat(rowStyle.blockSize),
        rowGap: Number.parseFloat(rowStyle.gap || rowStyle.columnGap),
      };
    });
    expect(metrics).toBeTruthy();
    expect(metrics!.rowHeight).toBe(64);
    expect(metrics!.rowGap).toBe(8);
  });

  it('applies 4px gap in the search-trailing cluster', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-app-bar variant="search">
        <md-icon-button slot="search-trailing" icon="mic" aria-label="Mic"></md-icon-button>
        <md-icon-button slot="search-trailing" icon="auto_awesome" aria-label="AI"></md-icon-button>
      </md-app-bar>
    `);
    const gap = await page.evaluate(() => {
      const root = document.querySelector('md-app-bar')?.shadowRoot;
      const cluster = root?.querySelector('.md-app-bar__search-trailing') as HTMLElement | null;
      return cluster ? Number.parseFloat(getComputedStyle(cluster).gap) : 0;
    });
    expect(gap).toBe(4);
  });

  it('applies 8px inline-end padding on search pill when search-trailing is present', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-app-bar variant="search" search-placeholder="Search">
        <md-icon-button slot="search-trailing" icon="mic" aria-label="Mic"></md-icon-button>
      </md-app-bar>
    `);
    await page.waitForChanges();
    const paddingInlineEnd = await page.evaluate(() => {
      const root = document.querySelector('md-app-bar')?.shadowRoot;
      const pill = root?.querySelector('.md-app-bar__search') as HTMLElement | null;
      return pill ? Number.parseFloat(getComputedStyle(pill).paddingInlineEnd) : 0;
    });
    expect(paddingInlineEnd).toBe(8);
  });

  it('applies 4px inline padding on flexible variant rows', async () => {
    for (const variant of ['medium', 'large'] as const) {
      const page = await newE2EPage();
      await page.setContent(
        `<md-app-bar variant="${variant}" headline="Album"><md-icon-button slot="leading" icon="menu" aria-label="Menu"></md-icon-button></md-app-bar>`,
      );
      const padding = await page.evaluate(() => {
        const root = document.querySelector('md-app-bar')?.shadowRoot;
        const row = root?.querySelector('.md-app-bar__row') as HTMLElement | null;
        if (!row) return null;
        const style = getComputedStyle(row);
        return {
          start: Number.parseFloat(style.paddingInlineStart),
          end: Number.parseFloat(style.paddingInlineEnd),
        };
      });
      expect(padding).toBeTruthy();
      expect(padding!.start).toBe(4);
      expect(padding!.end).toBe(4);
    }
  });

  it('applies 2px gap between trailing action icons on large', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-app-bar variant="large" headline="Album">
        <md-icon-button slot="trailing" icon="search" aria-label="Search"></md-icon-button>
        <md-icon-button slot="trailing" icon="calendar_month" aria-label="Calendar"></md-icon-button>
        <md-icon-button slot="trailing" icon="more_vert" aria-label="More"></md-icon-button>
      </md-app-bar>
    `);
    const gap = await page.evaluate(() => {
      const root = document.querySelector('md-app-bar')?.shadowRoot;
      const trailing = root?.querySelector('.md-app-bar__trailing') as HTMLElement | null;
      return trailing ? Number.parseFloat(getComputedStyle(trailing).gap) : 0;
    });
    expect(gap).toBe(2);
  });
});
