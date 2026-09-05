import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { ShowcaseService } from '../lib/showcase.service';
import { SnackbarService } from '../lib/snackbar.service';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-snackbar-host',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `<md-snackbar
    class="app-snackbar"
    [attr.open]="snackbar.message() !== null ? '' : null"
    [attr.message]="text"
    [attr.duration]="4000"
    (mdClose)="snackbar.close()"
  ></md-snackbar>`,
})
export class SnackbarHostComponent {
  private readonly showcase = inject(ShowcaseService);
  readonly snackbar = inject(SnackbarService);
  get text() {
    const message = this.snackbar.message();
    return message ? this.showcase.t(message.key, message.params) : '';
  }
}
