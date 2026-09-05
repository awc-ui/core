import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { ShowcaseComponent } from '../lib/screen.base';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * The one snackbar.
 *
 * FOUR SCREENS RAISE ONE, so the wiring is written once. Each holds its own
 * instance — a snackbar is `position: fixed` and paints over the viewport, so
 * two mounted at once are two overlays fighting for the same corner.
 *
 * THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string. A screen that
 * built "Following Ada Lindqvist" itself would have composed a sentence in
 * English word order and handed it to the Arabic build intact.
 */
@Component({
  selector: 'awc-snackbar',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <md-snackbar
      class="app-snackbar"
      position="bottom"
      closeable
      auto-hide
      [attr.open]="message ? '' : null"
      [attr.message]="message ? t(message.key, message.params) : ''"
      [attr.dismiss-label]="t('community.action.close')"
      (mdClose)="closed()"
    ></md-snackbar>
  `,
})
export class SnackbarComponent extends ShowcaseComponent {
  @Input() message: SnackbarMessage | null = null;
  /* The component closes itself on the timeout and on the dismiss button; the
     screen's own state has to follow, or the next identical message would set
     `open` to a value it already has and never re-open. */
  @Input() onClose: () => void = () => {};
  protected closed() {
    this.onClose();
  }
}
