import { newE2EPage } from '@stencil/core/testing';
import { exerciseDateKeyboard, exerciseDateMenus, exerciseDateTyping, exerciseDateFormats, exerciseDateMenuKeyboard } from './test-utils/editing.browser';

describe('md-date-picker calendar and typed editing', () => {
  it('navigates days, months and years from the keyboard and separates staging from committing', async () => {
    const page = await newE2EPage({ html: '<md-date-picker label="Booking date"></md-date-picker>' });
    await page.evaluate(exerciseDateKeyboard);
  });
  it('selects month and year menus within bounds without changing the committed date', async () => {
    const page = await newE2EPage({ html: '<md-date-picker label="Booking date"></md-date-picker>' });
    await page.evaluate(exerciseDateMenus);
  });
  it('validates localized typing and dialog entry, clears errors and honors disabled controls', async () => {
    const page = await newE2EPage({ html: '<md-date-picker label="Booking date"></md-date-picker>' });
    await page.evaluate(exerciseDateTyping);
  });
});

describe('md-date-picker locale and menu keyboard contracts', () => {
 it('parses compact localized dates and rejects impossible or out-of-bounds entries', async () => {
 const page = await newE2EPage({ html: '<md-date-picker label="Booking date"></md-date-picker>' });
 await page.evaluate(exerciseDateFormats);
 });
 it('switches calendar menus with shortcuts, restores the day grid and honors outside-dismiss policy', async () => {
 const page = await newE2EPage({ html: '<md-date-picker label="Booking date"></md-date-picker>' });
 await page.evaluate(exerciseDateMenuKeyboard);
 });
});
