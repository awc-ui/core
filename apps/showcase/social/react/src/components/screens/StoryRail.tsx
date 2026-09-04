/**
 * The story rail, and the two buttons that move it.
 *
 * NO SCROLLBAR. A horizontal scrollbar under a row of ten circles is a piece of
 * browser furniture sitting in the middle of the page — it is thicker than the
 * gap it lives in, it is styled by the OS rather than by this app, and on a
 * trackpad it appears and disappears as you move. It is hidden, and the two
 * chevrons take over the job it was doing.
 *
 * THE SCROLLER IS STILL A REAL SCROLLER, which is the part that matters. Hiding
 * the bar changes nothing about the element: a trackpad swipe, a touch drag,
 * shift-wheel and — the one people forget — TAB, which scrolls a focused ring
 * into view on its own, all still work. Had this been rebuilt as a transform
 * carousel, every one of those would have had to be reimplemented and the
 * keyboard one would have been forgotten.
 *
 * THE BUTTONS ARE POINTER-DEVICE ONLY. `app.css` hides them under
 * `pointer: coarse`: a thumb swipes, and two 48px targets over the first and
 * last avatar would cover the thing they are meant to reveal.
 *
 * RTL IS A SIGN, NOT A SPECIAL CASE. `scrollLeft` runs negative in a
 * right-to-left container, so "toward the end" is a different sign in each
 * direction — but the DISTANCE from each end is `Math.abs(scrollLeft)` either
 * way, so the two disabled states need no branch at all.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoryRing } from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { Avatar } from '@/components/bits';

/** How far one press moves the rail: a little under a viewport of it. */
const PAGE_FRACTION = 0.8;

export function StoryRail({ rings }: { rings: StoryRing[] }) {
  const t = useT();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /**
   * Which ends we have reached.
   *
   * The 2px slack is not superstition: a scroller whose content is a fractional
   * number of pixels wide never reports `scrollLeft + clientWidth === scrollWidth`
   * exactly, so an exact comparison leaves the forward button live at the end
   * forever.
   */
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const offset = Math.abs(el.scrollLeft);
    setAtStart(offset < 2);
    setAtEnd(offset + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    /* A resize changes what fits, so the buttons have to re-decide. Observing
       the element rather than the window catches the rail narrowing because the
       aside appeared beside it, which a window listener would miss. */
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  const page = (towardEnd: boolean) => {
    const el = scroller.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const distance = el.clientWidth * PAGE_FRACTION;
    /* The only place direction is consulted: which way "the end" is. */
    const sign = towardEnd === rtl ? -1 : 1;
    el.scrollBy({ left: distance * sign, behavior: 'smooth' });
  };

  return (
    <section className="story-rail" aria-label={t('social.panel.stories')}>
      <md-icon-button
        class="story-rail__nav story-rail__nav--prev"
        icon="chevron_left"
        aria-label={t('social.action.previous')}
        soft-disabled={atStart || undefined}
        onClick={() => page(false)}
      />

      <div className="story-rail__scroller" ref={scroller}>
        {rings.map(({ person, self }) => (
          <div key={person.id} className="story">
            <Avatar person={person} size="medium" ring={!self} />
            <span className="story__name">{self ? t('social.hint.yourStory') : person.handle}</span>
          </div>
        ))}
      </div>

      <md-icon-button
        class="story-rail__nav story-rail__nav--next"
        icon="chevron_right"
        aria-label={t('social.action.next')}
        soft-disabled={atEnd || undefined}
        onClick={() => page(true)}
      />
    </section>
  );
}
