import { Component, Input } from '@angular/core';

/**
 * The shared empty state.
 *
 * `hint` IS A STRING HERE, not the boolean the other verticals use. Theirs
 * share one generic second line ("try widening the filters"), which works
 * because their empty states are all filter results. These are not: an empty
 * feed wants "follow a few more people", an empty saved tab wants "save a post
 * and it will be here", and an empty comment thread wants "be the first to say
 * something". One shared sentence would be wrong for two of the three, so the
 * caller passes the one that fits and omits it where the message is the whole
 * story.
 */
@Component({
  selector: 'awc-empty-state',
  standalone: true,
  styles: ':host { display: contents; }',
  /*
   * THE GLYPH AND THE CLASSES MATCH THE OTHER FOUR BUILDS EXACTLY. This was a
   * bare paragraph carried over from Corvus, and the parity check caught it:
   * React renders a "music_off" ligature, and the missing nine characters of
   * text showed up on every screen with an empty panel on it.
   */
  template: `
    <div class="empty">
      <span class="material-symbols-outlined empty__icon" aria-hidden="true">music_off</span>
      <p class="empty__message">{{ message }}</p>
      @if (hint) {
        <p class="empty__hint">{{ hint }}</p>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) message!: string;
  @Input() hint?: string;
}
