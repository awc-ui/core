import { newE2EPage } from '@stencil/core/testing';

describe('md-status-dot accessible status lifecycle', () => {
  it('switches between decorative, named image and live status semantics', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-status-dot state="online" inline shape="circle"></md-status-dot>');
    const dot = await page.find('md-status-dot');
    expect(dot.getAttribute('role')).toBe('presentation');
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    dot.setProperty('label', 'Library connected');
    await page.waitForChanges();
    expect(dot.getAttribute('role')).toBe('img');
    expect(dot.getAttribute('aria-label')).toBe('Library connected');
    expect(dot.getAttribute('aria-hidden')).toBeNull();
    dot.setProperty('live', true);
    await page.waitForChanges();
    expect(dot.getAttribute('role')).toBe('status');
    dot.setProperty('label', '   ');
    await page.waitForChanges();
    expect(dot.getAttribute('role')).toBe('presentation');
    expect(dot.getAttribute('aria-label')).toBeNull();
    expect(dot.getAttribute('aria-hidden')).toBe('true');
  });
});
