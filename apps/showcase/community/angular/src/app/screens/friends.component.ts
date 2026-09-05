/**
 * Friends — the screen the bidirectional graph exists for.
 *
 * FOUR SECTIONS IN ONE ORDER: requests waiting on you, requests you are waiting
 * on, suggestions, then everyone — by WHO IS BLOCKED.
 *
 * A REQUEST HAS TWO BUTTONS, NOT A TOGGLE. Accept and Decline are different
 * outcomes, not two positions of one control.
 *
 * THE FOUR LISTS ARE THE FIXTURE'S AND THE OVERRIDES ARE APPLIED OVER THEM.
 * Re-deriving them from current state made a row VANISH the instant it was
 * acted on — the button disappeared under the reader's cursor.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getFriends,
  getOutgoing,
  getRequests,
  getSuggestions,
  getTotals,
  type Friendship,
  type Person,
} from '@awc-ui/showcase-kit/community';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { FriendsSkeletonComponent } from '../components/skeletons.component';
import {
  AvatarComponent,
  CountComponent,
  FriendButtonComponent,
} from '../components/bits.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';
import { EngagementService } from '../lib/engagement.service';
import { ShowcaseComponent } from '../lib/screen.base';

@Component({
  selector: 'awc-friends-screen',
  standalone: true,
  imports: [
    RouterLink,
    ScreenComponent,
    PanelComponent,
    EmptyStateComponent,
    FriendsSkeletonComponent,
    AvatarComponent,
    CountComponent,
    FriendButtonComponent,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <awc-screen
      [title]="t('community.screen.friends.title')"
      [subtitle]="t('community.screen.friends.subtitle')"
      [customSkeleton]="true"
    >
      <awc-friends-skeleton skeleton />
      <awc-count aside [value]="totals.friendCount"></awc-count>

      <awc-panel [title]="t('community.panel.requests')">
        @if (totals.requestCount > 0) {
          <awc-count actions [value]="totals.requestCount"></awc-count>
        }
        @if (requests.length === 0) {
          <awc-empty-state [message]="t('community.empty.requests')" />
        } @else {
          <div class="person-grid">
            @for (person of requests; track person.id) {
              <div class="person-row" [attr.data-person]="person.id">
                <a [routerLink]="path(person)"
                  ><awc-avatar [person]="person" size="medium"></awc-avatar
                ></a>
                <span class="person-row__text">
                  <a class="person-row__name" [routerLink]="path(person)">{{
                    person.displayName
                  }}</a>
                  <span class="person-row__meta">{{ mutual(person) }}</span>
                  @if (state(person) === 'incoming') {
                    <span class="request-actions">
                      <md-button variant="filled" size="sm" (mdClick)="accept(person)">{{
                        t('community.action.accept')
                      }}</md-button>
                      <md-button variant="outlined" size="sm" (mdClick)="decline(person)">{{
                        t('community.action.decline')
                      }}</md-button>
                    </span>
                  } @else {
                    <span class="person-row__meta">{{
                      t('community.friendship.' + state(person))
                    }}</span>
                  }
                </span>
              </div>
            }
          </div>
        }
      </awc-panel>

      @if (outgoing.length > 0) {
        <awc-panel [title]="t('community.panel.outgoing')">
          <awc-count actions [value]="outgoing.length"></awc-count>
          <div class="person-grid">
            @for (person of outgoing; track person.id) {
              <div class="person-row" [attr.data-person]="person.id">
                <a [routerLink]="path(person)"
                  ><awc-avatar [person]="person" size="medium"></awc-avatar
                ></a>
                <span class="person-row__text">
                  <a class="person-row__name" [routerLink]="path(person)">{{
                    person.displayName
                  }}</a>
                  <span class="person-row__meta">{{ mutual(person) }}</span>
                  <span class="request-actions">
                    <awc-friend-button
                      [person]="person"
                      [state]="state(person)"
                      (act)="request(person, $event)"
                    ></awc-friend-button>
                  </span>
                </span>
              </div>
            }
          </div>
        </awc-panel>
      }

      <awc-panel [title]="t('community.panel.suggested')">
        <awc-count actions [value]="suggestions.length"></awc-count>
        <div class="person-grid">
          @for (person of suggestions; track person.id) {
            <div class="person-row" [attr.data-person]="person.id">
              <a [routerLink]="path(person)"
                ><awc-avatar [person]="person" size="medium"></awc-avatar
              ></a>
              <span class="person-row__text">
                <a class="person-row__name" [routerLink]="path(person)">{{
                  person.displayName
                }}</a>
                <span class="person-row__meta">{{ mutual(person) }}</span>
                <span class="request-actions">
                  <awc-friend-button
                    [person]="person"
                    [state]="state(person)"
                    (act)="request(person, $event)"
                  ></awc-friend-button>
                </span>
              </span>
            </div>
          }
        </div>
      </awc-panel>

      <awc-panel [title]="t('community.panel.allFriends')">
        <awc-count actions [value]="friends.length"></awc-count>
        @if (friends.length === 0) {
          <awc-empty-state
            [message]="t('community.empty.friends')"
            [hint]="t('community.empty.friendsHint')"
          />
        } @else {
          <div class="person-grid">
            @for (person of friends; track person.id) {
              <div class="person-row" [attr.data-person]="person.id">
                <a [routerLink]="path(person)"
                  ><awc-avatar [person]="person" size="medium"></awc-avatar
                ></a>
                <span class="person-row__text">
                  <a class="person-row__name" [routerLink]="path(person)">{{
                    person.displayName
                  }}</a>
                  <span class="person-row__meta">{{ mutual(person) }}</span>
                  <span class="request-actions">
                    <awc-friend-button
                      [person]="person"
                      [state]="state(person)"
                      (act)="remove(person, $event)"
                    ></awc-friend-button>
                  </span>
                </span>
              </div>
            }
          </div>
        }
      </awc-panel>

      <awc-snackbar [message]="message" [onClose]="close"></awc-snackbar>
    </awc-screen>
  `,
})
export class FriendsScreen extends ShowcaseComponent {
  private readonly engagement = inject(EngagementService);
  protected readonly totals = getTotals();
  protected readonly requests = getRequests();
  protected readonly outgoing = getOutgoing();
  protected readonly suggestions = getSuggestions(6);
  protected readonly friends = getFriends();
  protected message: SnackbarMessage | null = null;

  protected state = (person: Person) => this.engagement.friendshipFor(person);
  protected path = (person: Person) => this.appPath(this.route.person(person.handle));
  protected mutual = (person: Person) =>
    person.mutualCount === 1
      ? this.t('community.count.mutualOne')
      : this.t('community.count.mutual', { count: this.t.formatNumber(person.mutualCount) });

  protected accept(person: Person): void {
    this.engagement.setFriendship(person, 'friend');
    this.message = {
      key: 'community.msg.friendAccepted',
      params: { name: person.displayName },
    };
  }
  protected decline(person: Person): void {
    this.engagement.setFriendship(person, 'none');
    this.message = {
      key: 'community.msg.friendDeclined',
      params: { name: person.displayName },
    };
  }
  protected request(person: Person, next: Friendship): void {
    this.engagement.setFriendship(person, next);
    this.message = {
      key:
        next === 'outgoing'
          ? 'community.msg.friendRequested'
          : 'community.msg.requestCancelled',
      params: { name: person.displayName },
    };
  }
  protected remove(person: Person, next: Friendship): void {
    this.engagement.setFriendship(person, next);
    this.message = { key: 'community.msg.friendRemoved', params: { name: person.displayName } };
  }
  protected close = () => {
    this.message = null;
  };
}
