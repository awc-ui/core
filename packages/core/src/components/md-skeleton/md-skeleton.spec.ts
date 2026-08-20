import { newSpecPage } from '@stencil/core/testing';
import { MdSkeleton } from './md-skeleton';

describe('md-skeleton', () => {
  it('renders text lines by default and exposes a busy status', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton lines="3"></md-skeleton>`,
    });
    const host = page.root!;
    expect(host).toHaveClass('md-skeleton--text');
    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.shadowRoot!.querySelectorAll('.md-skeleton__line')).toHaveLength(3);
    // The last of multiple lines is tapered.
    expect(host.shadowRoot!.querySelector('.md-skeleton__line--tapered')).toBeTruthy();
  });

  it('renders a single shape for non-text variants', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton variant="rounded"></md-skeleton>`,
    });
    const host = page.root!;
    expect(host).toHaveClass('md-skeleton--rounded');
    expect(host.shadowRoot!.querySelector('.md-skeleton__shape')).toBeTruthy();
    expect(host.shadowRoot!.querySelectorAll('.md-skeleton__line')).toHaveLength(0);
  });

  it('reflects full-width / full-height so the responsive CSS applies', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton variant="rectangular" full-width full-height></md-skeleton>`,
    });
    const host = page.root!;
    expect(host.hasAttribute('full-width')).toBe(true);
    expect(host.hasAttribute('full-height')).toBe(true);
  });

  it('can opt out of the busy-state announcement and hides from AT', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton announce="false"></md-skeleton>`,
    });
    const host = page.root!;
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('aria-busy')).toBeNull();
    // Decorative skeleton is removed from the a11y tree.
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses a custom accessible label when announcing', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton aria-label="Loading profile"></md-skeleton>`,
    });
    expect(page.root!.getAttribute('aria-label')).toBe('Loading profile');
  });

  it.each([
    ['0', 1],
    ['-3', 1],
    ['1', 1],
    ['4', 4],
  ])('coerces lines="%s" to %i rendered line(s)', async (lines, expected) => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton lines="${lines}"></md-skeleton>`,
    });
    expect(page.root!.shadowRoot!.querySelectorAll('.md-skeleton__line')).toHaveLength(expected);
  });

  it('applies width / height as the sizing custom properties', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton variant="rectangular" width="240px" height="80px"></md-skeleton>`,
    });
    const style = page.root!.getAttribute('style') || '';
    expect(style).toContain('--_w: 240px');
    expect(style).toContain('--_h: 80px');
  });

  it('reflects the animation as a host class', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton animation="wave"></md-skeleton>`,
    });
    expect(page.root!).toHaveClass('md-skeleton--anim-wave');
  });
});
