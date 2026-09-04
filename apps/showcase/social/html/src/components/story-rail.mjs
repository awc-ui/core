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
 * keyboard one would have been forgotten. It also means this build degrades
 * correctly: with JavaScript off the chevrons are inert and the rail still
 * scrolls, because the scrolling was never JavaScript's.
 *
 * THE BUTTONS ARE POINTER-DEVICE ONLY. `app.css` hides them under
 * `pointer: coarse`: a thumb swipes, and two 48px targets over the first and
 * last avatar would cover the thing they are meant to reveal.
 *
 * The prev button ships soft-disabled because the rail ships scrolled to its
 * start; `src/client/story-rail.mjs` takes over both states from there.
 */

import { attrs, html } from '../lib/html.mjs';
import { avatar } from '../lib/bits.mjs';

export function storyRailSection(t, rings) {
  return html`<section class="story-rail"${attrs({ 'aria-label': t('social.panel.stories') })}>
    <md-icon-button${attrs({
      class: 'story-rail__nav story-rail__nav--prev',
      icon: 'chevron_left',
      'aria-label': t('social.action.previous'),
      'soft-disabled': true,
    })}></md-icon-button>

    <div class="story-rail__scroller">
      ${rings.map(
        ({ person, self }) => html`<div class="story">
          ${avatar(t, person, { size: 'medium', ring: !self })}
          <span class="story__name">${self ? t('social.hint.yourStory') : person.handle}</span>
        </div>`,
      )}
    </div>

    <md-icon-button${attrs({
      class: 'story-rail__nav story-rail__nav--next',
      icon: 'chevron_right',
      'aria-label': t('social.action.next'),
    })}></md-icon-button>
  </section>`;
}
