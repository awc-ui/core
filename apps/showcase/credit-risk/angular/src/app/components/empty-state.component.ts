import { Component, Input } from '@angular/core';
import { ShowcaseComponent } from '../lib/screen.base';

/**
 * The shared empty state.
 *
 * `hint` defaults to false because most empty states here are facts, not filter
 * results: "this facility is unsecured" is the whole story, and telling the
 * reader to widen the filters underneath it would be nonsense. Pass `hint` only
 * where a filter or a search actually produced the emptiness.
 */
@Component({
  selector: 'awc-empty-state',
  standalone: true,
  styles: ':host { display: contents; }',
  template: `
    <div class="empty">
      <p>{{ message }}</p>
      @if (hint) {
        <p>{{ t('empty.hint') }}</p>
      }
    </div>
  `,
})
export class EmptyStateComponent extends ShowcaseComponent {
  @Input({ required: true }) message!: string;
  @Input() hint = false;
}
