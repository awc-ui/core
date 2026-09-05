/**
 * Profile — the reader's own listening, playlists and projects.
 *
 * IT ALSO CARRIES THE QUEUE, the one place the whole of it is visible: the
 * transport shows what is loaded, this shows what follows.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  artistById, getProjects, getTotals, getViewer, likedTracks, ownPlaylists, trackById, upNext,
  type Project, type Track,
} from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { ArtComponent, CountComponent, PlaylistCardComponent, TrackListComponent } from '../components/bits.component';
import { ProfileSkeletonComponent } from '../components/skeletons.component';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { appPath, route } from '../lib/routes';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-profile-screen',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ScreenComponent, PanelComponent, EmptyStateComponent,
    CountComponent, ArtComponent, TrackListComponent, PlaylistCardComponent, ProfileSkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-screen [title]="t('music.screen.profile.title')" [subtitle]="t('music.screen.profile.subtitle')">
      <awc-count aside [value]="totals.likedTracks" />
      <awc-profile-skeleton skeleton />

      <div class="stack">
        <awc-panel>
          <div class="release-head">
            <awc-art [art]="viewer.art" className="release-head__art" [eager]="true" />
            <div class="release-head__text">
              <h2 class="release-head__title">{{ viewer.displayName }}</h2>
              <p class="person-row__meta">&#64;{{ viewer.handle }}</p>
              <div class="stat-row">
                <div><dt>{{ t('music.panel.liked') }}</dt><dd><awc-count [value]="totals.likedTracks" /></dd></div>
                <div><dt>{{ t('music.panel.yourPlaylists') }}</dt><dd><awc-count [value]="playlists.length" /></dd></div>
                <div><dt>{{ t('music.panel.projects') }}</dt><dd><awc-count [value]="totals.projects" /></dd></div>
                <div><dt>{{ t('music.label.minutes') }}</dt><dd><awc-count [value]="totals.listeningMinutes" [compact]="true" /></dd></div>
              </div>
            </div>
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.queue')">
          <awc-count actions [value]="queue.length" />
          <awc-empty-state *ngIf="queue.length === 0" [message]="t('music.empty.queue')" />
          <div class="stack" *ngIf="queue.length > 0">
            <div class="queue-row" *ngFor="let track of queue; let at = index">
              <span class="queue-row__index">{{ at + 1 }}</span>
              <span class="track-row__text">
                <a class="track-row__title link" [routerLink]="trackPath(track)">{{ track.title }}</a>
                <span class="track-row__meta">{{ artistName(track) }}</span>
              </span>
            </div>
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.liked')">
          <awc-count actions [value]="liked.length" />
          <awc-empty-state *ngIf="liked.length === 0" [message]="t('music.empty.liked')" />
          <awc-track-list *ngIf="liked.length > 0" [tracks]="liked" [showAlbum]="true" />
        </awc-panel>

        <awc-panel [title]="t('music.panel.yourPlaylists')">
          <awc-count actions [value]="playlists.length" />
          <div class="shelf"><awc-playlist-card *ngFor="let p of playlists" [playlist]="p" /></div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.projects')">
          <awc-count actions [value]="projects.length" />
          <div class="stack">
            <a *ngFor="let p of projects" class="project-card" [routerLink]="projectPath(p)">
              <awc-art [art]="p.art" className="project-card__art" />
              <span class="project-card__text">
                <span class="track-row__title">{{ p.title }}</span>
                <span class="track-row__meta">{{ t(p.stateKey) }}</span>
              </span>
            </a>
          </div>
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class ProfileScreen {
  private readonly showcase = inject(ShowcaseService);
  private readonly player = inject(PlayerService);
  readonly viewer = getViewer();
  readonly totals = getTotals();
  readonly liked = likedTracks(6);
  readonly playlists = ownPlaylists();
  readonly projects = getProjects();

  /* The whole remaining queue, not the transport's five-row preview. */
  get queue(): Track[] {
    return upNext(this.player.transport(), 50)
      .map((id) => trackById(id))
      .filter((x): x is Track => x !== null);
  }

  t = (key: string) => this.showcase.t(key);
  artistName = (track: Track) => artistById(track.artistId)?.name ?? '';
  trackPath = (track: Track) => appPath(route.track(track.id));
  projectPath = (project: Project) => appPath(route.project(project.slug));
}
