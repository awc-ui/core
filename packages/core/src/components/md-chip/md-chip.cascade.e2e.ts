import { newE2EPage } from '@stencil/core/testing';

// Distinct token values so every computed colour names the rule that produced it.
const TOKENS = `<style>:root{
  --md-sys-color-primary: rgb(1, 0, 0); --md-sys-color-on-primary: rgb(2, 0, 0);
  --md-sys-color-secondary-container: rgb(3, 0, 0); --md-sys-color-on-secondary-container: rgb(4, 0, 0);
  --md-sys-color-surface-container-high: rgb(5, 0, 0); --md-sys-color-on-surface-variant: rgb(6, 0, 0);
  --md-sys-color-on-surface: rgb(7, 0, 0); --md-sys-color-outline: rgb(8, 0, 0); --md-sys-color-outline-variant: rgb(9, 0, 0);
  --md-sys-color-error: rgb(10, 0, 0); --md-sys-color-on-error: rgb(11, 0, 0);
  --md-sys-color-error-container: rgb(12, 0, 0); --md-sys-color-on-error-container: rgb(13, 0, 0);
  --md-sys-elevation-1: rgb(0, 0, 0) 0px 1px 2px 0px;
}</style>`;

type Paint = { container: string; label: string; icon: string | null; outline: string | null; layer: string | null };

async function styles(html: string): Promise<Paint[]> {
  const page = await newE2EPage();
  await page.setContent(TOKENS + html);
  await page.waitForChanges();
  // Let the 200 ms host colour transitions (from the pre-hydration values) finish.
  await new Promise(resolve => setTimeout(resolve, 400));
  return page.$$eval('md-chip', chips => chips.map((el: any) => {
    const sr = el.shadowRoot, host = getComputedStyle(el);
    const part = (name: string) => { const n = sr.querySelector(`[part="${name}"]`); return n ? getComputedStyle(n) : null; };
    return {
      container: host.backgroundColor, label: host.color,
      icon: part('icon')?.color ?? part('checkmark')?.color ?? null,
      outline: part('outline')?.borderTopColor ?? null,
      layer: part('state-layer')?.backgroundColor ?? null,
    };
  }));
}

const pick = (paint: Paint, keys: (keyof Paint)[]) => Object.fromEntries(keys.map(key => [key, paint[key]]));

describe('md-chip cascade', () => {
  it('a selected filled or elevated chip keeps the selected container, label and icon colours', async () => {
    const [filled, elevated, unselected] = await styles(
      '<md-chip variant="filter" appearance="filled" selected label="A"></md-chip>' +
      '<md-chip variant="filter" appearance="elevated" selected label="B"></md-chip>' +
      '<md-chip variant="filter" appearance="filled" label="C"></md-chip>');
    expect(unselected.container).toBe('rgb(5, 0, 0)');
    const selected = { container: 'rgb(3, 0, 0)', label: 'rgb(4, 0, 0)', icon: 'rgb(4, 0, 0)' };
    expect([filled, elevated].map(chip => pick(chip, ['container', 'label', 'icon']))).toEqual([selected, selected]);
  });

  it('per-instance hooks win over the selected state and colour roles', async () => {
    const hooks = 'style="--md-chip-state-layer-color: rgb(20, 0, 0); --md-chip-container-color-selected: rgb(21, 0, 0); --md-chip-label-color-selected: rgb(22, 0, 0)"';
    const chips = await styles(
      `<md-chip variant="filter" selected label="A" ${hooks}></md-chip>` +
      `<md-chip variant="filter" color="error" selected label="B" ${hooks}></md-chip>`);
    const hooked = { layer: 'rgb(20, 0, 0)', container: 'rgb(21, 0, 0)', label: 'rgb(22, 0, 0)' };
    expect(chips.map(chip => pick(chip, ['layer', 'container', 'label']))).toEqual([hooked, hooked]);
  });

  it('a disabled filled chip draws no outline, like its enabled state', async () => {
    const [disabled, enabled] = await styles(
      '<md-chip appearance="filled" disabled label="A"></md-chip><md-chip appearance="filled" label="B"></md-chip>');
    expect([enabled.outline, disabled.outline]).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
  });

  it('a disabled filled chip dims its tonal container like a disabled elevated chip', async () => {
    // Filled and elevated share one tonal container and differ only in elevation (section 3).
    const chips = await styles(
      '<md-chip appearance="elevated" disabled label="A"></md-chip><md-chip appearance="filled" disabled label="B"></md-chip>' +
      '<md-chip appearance="filled" soft-disabled label="C"></md-chip><md-chip appearance="filled" color="error" disabled label="D"></md-chip>');
    expect(chips[0].container).toContain('0.12');
    expect(chips.map(chip => chip.container)).toEqual(chips.map(() => chips[0].container));
  });

  it('a colour value that is not a role name renders the neutral chip', async () => {
    const [hex, neutral, hexSelected, neutralSelected] = await styles(
      '<md-chip color="#ff0000" icon="star" label="A"></md-chip><md-chip icon="star" label="B"></md-chip>' +
      '<md-chip variant="filter" color="#ff0000" selected label="C"></md-chip><md-chip variant="filter" selected label="D"></md-chip>');
    expect([hex, hexSelected]).toEqual([neutral, neutralSelected]);
  });

  it('disabled colour-role chips use the disabled content colour', async () => {
    const [reference, ...chips] = await styles(
      '<md-chip icon="star" disabled label="R"></md-chip>' +
      '<md-chip color="error" icon="star" disabled label="A"></md-chip>' +
      '<md-chip variant="filter" color="error" selected disabled label="B"></md-chip>' +
      '<md-chip appearance="filled" color="error" icon="star" disabled label="C"></md-chip>');
    expect(reference.label).toContain('0.38');
    const disabled = { label: reference.label, icon: reference.icon };
    expect(chips.map(chip => pick(chip, ['label', 'icon']))).toEqual([disabled, disabled, disabled]);
  });
});
