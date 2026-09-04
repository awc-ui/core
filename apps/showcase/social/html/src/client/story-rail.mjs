/**
 * The two chevrons that move the story rail, and their end states.
 *
 * THE SCROLLING IS THE BROWSER'S. This module only presses the scroller with
 * `scrollBy` and keeps the two buttons' disabled states honest — a trackpad
 * swipe, a touch drag, shift-wheel and a TAB that pulls a focused ring into
 * view all work without it, which is why the rail is a real overflow container
 * rather than a transform carousel.
 *
 * RTL IS A SIGN, NOT A SPECIAL CASE. `scrollLeft` runs negative in a
 * right-to-left container, so "toward the end" is a different sign in each
 * direction — but the DISTANCE from each end is `Math.abs(scrollLeft)` either
 * way, so the two disabled states need no branch at all. Arabic is one of this
 * build's three locales, so that is a live path rather than a hypothetical.
 */

/** How far one press moves the rail: a little under a viewport of it. */
const PAGE_FRACTION = 0.8;

export function enhanceStoryRail(root = document) {
  const rail = root.querySelector('.story-rail:not([data-bound])');
  if (!rail) return;
  rail.setAttribute('data-bound', '');

  const scroller = rail.querySelector('.story-rail__scroller');
  const prev = rail.querySelector('.story-rail__nav--prev');
  const next = rail.querySelector('.story-rail__nav--next');
  if (!scroller) return;

  /* The 2px slack is not superstition: a scroller whose content is a fractional
     number of pixels wide never reports `scrollLeft + clientWidth === scrollWidth`
     exactly, so an exact comparison leaves the forward button live at the end
     forever. */
  const measure = () => {
    const offset = Math.abs(scroller.scrollLeft);
    prev?.toggleAttribute('soft-disabled', offset < 2);
    next?.toggleAttribute('soft-disabled', offset + scroller.clientWidth >= scroller.scrollWidth - 2);
  };

  const page = (towardEnd) => {
    const rtl = getComputedStyle(scroller).direction === 'rtl';
    /* The only place direction is consulted: which way "the end" is. */
    const sign = towardEnd === rtl ? -1 : 1;
    scroller.scrollBy({ left: scroller.clientWidth * PAGE_FRACTION * sign, behavior: 'smooth' });
  };

  prev?.addEventListener('mdClick', () => page(false));
  next?.addEventListener('mdClick', () => page(true));
  scroller.addEventListener('scroll', measure, { passive: true });
  /* A resize changes what fits, so the buttons have to re-decide. Observing the
     element rather than the window catches the rail narrowing because the aside
     appeared beside it, which a window listener would miss. */
  new ResizeObserver(measure).observe(scroller);
  measure();
}
