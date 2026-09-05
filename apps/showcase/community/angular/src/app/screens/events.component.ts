/**
 * Events — grouped by age, soonest first, past last.
 *
 * The buckets come from the kit and empty ones are dropped rather than rendered
 * as a heading over nothing. `past` is LAST rather than first: a list read top
 * to bottom should begin with what is about to happen.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { eventGroups, getEvents, getTotals } from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { EventsSkeletonComponent } from '../components/skeletons.component';
import { CountComponent } from '../components/bits.component';
import { EventRowComponent } from './parts.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-events-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    EventsSkeletonComponent,
    CountComponent,
    EventRowComponent,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-screen
      [title]="t('community.screen.events.title')"
      [subtitle]="t('community.screen.events.subtitle')"
      [customSkeleton]="true"
    >
      <awc-events-skeleton skeleton />
      <awc-count aside [value]="totals.goingCount"></awc-count>

      @if (groups.length === 0) {
        <awc-empty-state [message]="t('community.empty.events')" />
      } @else {
        @for (group of groups; track group.bucket) {
          <awc-panel [title]="t(group.labelKey)">
            <awc-count actions [value]="group.events.length"></awc-count>
            <div class="event-list">
              @for (event of group.events; track event.id) {
                <awc-event-row [event]="event" (message)="say($event)"></awc-event-row>
              }
            </div>
          </awc-panel>
        }
      }

      <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
    </awc-screen>
  `,
})
export class EventsScreen extends ShowcaseComponent {
  protected readonly totals = getTotals();
  protected readonly groups = eventGroups(getEvents());
  protected message: SnackbarMessage | null = null;
  protected say = (event: { key: string | null; params?: Record<string, string | number> }) => {
    this.message = event.key === null ? null : { key: event.key, params: event.params };
  };
  protected close = () => {
    this.message = null;
  };
}
