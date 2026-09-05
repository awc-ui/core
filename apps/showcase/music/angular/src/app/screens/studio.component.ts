/**
 * Studio — the projects, and the arrangement of whichever one is open.
 *
 * There is no projects index screen: Studio IS the list with one open. The
 * toolbar's edits are the SAME operations the drag performs, and both go
 * through `clipFits` in the kit, so a button cannot put a clip where a drag
 * would not.
 */
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  canRedo,
  canUndo,
  clipFits,
  currentProject,
  editIcon,
  getProjects,
  nextRedo,
  nextUndo,
  projectBySlug,
  projectClips,
  projectStateIcon,
  projectStateTone,
  projectTracks,
  trackClips,
  type Clip,
  type Project,
} from '@awc-ui/showcase-kit/music';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { EmptyStateComponent } from '../components/empty-state.component';
import { TimelineComponent } from '../components/timeline.component';
import { ArtComponent, CountComponent, DateTextComponent } from '../components/bits.component';
import { StudioSkeletonComponent } from '../components/skeletons.component';
import { NotFoundScreen } from './not-found.component';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';
import { SnackbarService } from '../lib/snackbar.service';
import { appPath, route } from '../lib/routes';

const ZOOMS = ['sm', 'md', 'lg'] as const;

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-studio-screen',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ScreenComponent, PanelComponent, EmptyStateComponent,
    TimelineComponent, CountComponent, ArtComponent, DateTextComponent,
    StudioSkeletonComponent, NotFoundScreen,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-not-found-screen *ngIf="!project" />
    <awc-screen
      *ngIf="project as open"
      [title]="t('music.screen.studio.title')"
      [subtitle]="t('music.screen.studio.subtitle')"
      [crumbLabel]="open.title"
    >
      <awc-count aside [value]="projects.length" />
      <awc-studio-skeleton skeleton />

      <div class="stack">
        <awc-panel>
          <div class="studio-head">
            <div class="studio-head__facts">
              <awc-art [art]="open.art" className="project-card__art" [eager]="true" />
              <div class="project-card__text">
                <h2 class="release-head__title">{{ open.title }}</h2>
                <div class="row">
                  <md-chip
                    variant="assist"
                    appearance="outlined"
                    [attr.color]="stateTone(open)"
                    [attr.icon]="stateIcon(open)"
                    [attr.label]="t(open.stateKey)"
                  ></md-chip>
                  <span class="person-row__meta">{{ open.bpm }} {{ t('music.label.bpm') }}</span>
                  <span class="person-row__meta">{{ open.bars }} {{ t('music.label.bars') }}</span>
                  <span class="person-row__meta">{{ updatedPrefix }}<awc-date-text [at]="open.updatedAt" /></span>
                </div>
              </div>
            </div>

            <div class="studio-head__tools">
              <!-- Undo NAMES what it will reverse. "Undo" alone makes a reader
                   press it to find out. -->
              <md-button
                class="studio__undo"
                variant="text"
                icon="undo"
                size="sm"
                [attr.soft-disabled]="undoable ? null : ''"
                [attr.aria-label]="undoLabel"
                (click)="doUndo()"
              >{{ t('music.action.undo') }}</md-button>
              <md-button
                class="studio__redo"
                variant="text"
                icon="redo"
                size="sm"
                [attr.soft-disabled]="redoable ? null : ''"
                [attr.aria-label]="redoLabel"
                (click)="doRedo()"
              >{{ t('music.action.redo') }}</md-button>
              <md-icon-button
                class="studio__zoom-out"
                icon="zoom_out"
                size="sm"
                [attr.soft-disabled]="zoom() === 'sm' ? '' : null"
                [attr.aria-label]="t('music.action.zoomOut')"
                (click)="zoomOut()"
              ></md-icon-button>
              <md-icon-button
                class="studio__zoom-in"
                icon="zoom_in"
                size="sm"
                [attr.soft-disabled]="zoom() === 'lg' ? '' : null"
                [attr.aria-label]="t('music.action.zoomIn')"
                (click)="zoomIn()"
              ></md-icon-button>
            </div>
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.arrangement')" [subtitle]="t('music.hint.editing')">
          <span class="row" actions>
            <awc-count [value]="clips.length" />
            <ng-container *ngIf="selectedClip as clip">
              <md-icon-button class="studio__nudge-back" icon="chevron_left" size="sm"
                [attr.aria-label]="moveLabel(clip)" (click)="nudge(clip, -1)"></md-icon-button>
              <md-icon-button class="studio__nudge-forward" icon="chevron_right" size="sm"
                [attr.aria-label]="moveLabel(clip)" (click)="nudge(clip, 1)"></md-icon-button>
              <md-icon-button class="studio__shrink" icon="compress" size="sm"
                [attr.aria-label]="resizeLabel(clip)" (click)="stretch(clip, -1)"></md-icon-button>
              <md-icon-button class="studio__grow" icon="expand" size="sm"
                [attr.aria-label]="resizeLabel(clip)" (click)="stretch(clip, 1)"></md-icon-button>
              <md-icon-button class="studio__delete" icon="delete" size="sm" color="error"
                [attr.aria-label]="removeLabel(clip)" (click)="drop(clip)"></md-icon-button>
            </ng-container>
          </span>

          <awc-timeline
            [project]="open"
            [tracks]="tracks"
            [zoom]="zoom()"
            [selectedClipId]="selected()"
            (select)="selected.set($event === null ? null : $event.id)"
            (message)="snackbar.say($event.key, $event.params)"
          />
        </awc-panel>

        <awc-panel [title]="t('music.panel.history')">
          <awc-count actions [value]="player.history().done.length" />
          <awc-empty-state
            *ngIf="player.history().done.length === 0 && player.history().undone.length === 0"
            [message]="t('music.empty.history')"
          />
          <div class="stack" *ngIf="player.history().done.length > 0 || player.history().undone.length > 0">
            <div class="history-row" *ngFor="let edit of player.history().done">
              <span class="material-symbols-outlined" aria-hidden="true">{{ glyph(edit.kind) }}</span>
              <span>{{ t(edit.labelKey) }}</span>
            </div>
            <!-- An undone edit is still listed — it is what redo will reapply. -->
            <div class="history-row" data-undone="" *ngFor="let edit of player.history().undone">
              <span class="material-symbols-outlined" aria-hidden="true">{{ glyph(edit.kind) }}</span>
              <span>{{ t(edit.labelKey) }}</span>
            </div>
          </div>
        </awc-panel>

        <awc-panel [title]="t('music.panel.projects')">
          <awc-count actions [value]="projects.length" />
          <div class="stack">
            <a
              *ngFor="let other of projects"
              class="project-card"
              [routerLink]="path(other)"
              [attr.data-current]="other.id === open.id ? '' : null"
              [attr.data-project]="other.slug"
            >
              <awc-art [art]="other.art" className="project-card__art" />
              <span class="project-card__text">
                <span class="track-row__title">{{ other.title }}</span>
                <span class="track-row__meta">{{ t(other.stateKey) }} · {{ other.bars }} {{ t('music.label.bars') }}</span>
              </span>
            </a>
          </div>
        </awc-panel>
      </div>
    </awc-screen>
  `,
})
export class StudioScreen {
  private readonly showcase = inject(ShowcaseService);
  readonly player = inject(PlayerService);
  readonly snackbar = inject(SnackbarService);

  /*
   * A SIGNAL INPUT AND COMPUTED DERIVATIONS, not getters.
   *
   * `get tracks()` returned a fresh array on every read, and the template
   * passes it into `<awc-timeline [tracks]>`. Each change-detection pass handed
   * the child a NEW array identity, which set the child's signal, which
   * recomputed its lane model, which scheduled another pass — a loop that hung
   * the Studio screen hard enough to time out the test harness. A `computed`
   * returns the same reference until something it reads actually changes.
   */
  private readonly slug$ = signal<string | undefined>(undefined);
  @Input() set slug(value: string | undefined) { this.slug$.set(value); }
  get slug() { return this.slug$(); }

  readonly zoom = signal<'sm' | 'md' | 'lg'>('md');
  readonly selected = signal<string | null>(null);
  readonly projects = getProjects();

  readonly project$ = computed<Project | null>(() => {
    const slug = this.slug$();
    return slug ? projectBySlug(slug) : currentProject();
  });
  readonly tracks$ = computed(() => {
    const open = this.project$();
    if (!open) return [];
    const live = this.player.tracks();
    return projectTracks(open).map((track) => live.find((x) => x.id === track.id) ?? track);
  });
  readonly clips$ = computed(() => {
    const open = this.project$();
    if (!open) return [];
    const gone = this.player.removed();
    return projectClips(open).filter((c) => gone[c.id] !== true);
  });

  get project(): Project | null { return this.project$(); }
  get tracks() { return this.tracks$(); }
  get clips() { return this.clips$(); }
  get selectedClip() { return this.clips.find((c) => c.id === this.selected()) ?? null; }

  get undoable() { return canUndo(this.player.history()); }
  get redoable() { return canRedo(this.player.history()); }
  get undoLabel() {
    const pending = nextUndo(this.player.history());
    return pending ? `${this.t('music.action.undo')}: ${this.t(pending.labelKey)}` : this.t('music.action.undo');
  }
  get redoLabel() {
    const pending = nextRedo(this.player.history());
    return pending ? `${this.t('music.action.redo')}: ${this.t(pending.labelKey)}` : this.t('music.action.redo');
  }

  t = (key: string, params?: Record<string, string | number>) => this.showcase.t(key, params);
  /* COMPUTED IN THE CLASS, NOT IN THE TEMPLATE. Angular's parser treats a bare
     `{` in a template as the start of a control block or an ICU message, so an
     inline object literal in an interpolation is a syntax error — and the error
     it reports is about an unexpected EOF several files away. */
  get updatedPrefix() { return this.t('music.hint.updated', { date: '' }); }
  glyph = (kind: keyof typeof editIcon) => editIcon[kind];
  stateTone = (p: Project) => projectStateTone[p.state];
  stateIcon = (p: Project) => projectStateIcon[p.state];
  path = (p: Project) => appPath(route.project(p.slug));
  moveLabel = (clip: Clip) => `${this.t('music.edit.clipMove')}: ${this.t(clip.labelKey)}`;
  resizeLabel = (clip: Clip) => `${this.t('music.edit.clipResize')}: ${this.t(clip.labelKey)}`;
  removeLabel = (clip: Clip) => `${this.t('music.edit.clipRemove')}: ${this.t(clip.labelKey)}`;

  zoomIn() { this.zoom.set(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(this.zoom()) + 1)]!); }
  zoomOut() { this.zoom.set(ZOOMS[Math.max(0, ZOOMS.indexOf(this.zoom()) - 1)]!); }

  private laneOf(clip: Clip) {
    return trackClips(clip.trackId)
      .filter((c) => !this.player.clipRemoved(c.id))
      .map((c) => ({
        id: c.id,
        startBar: this.player.clipStart(c.id, c.startBar),
        bars: this.player.clipBars(c.id, c.bars),
      }));
  }

  nudge(clip: Clip, delta: number) {
    const open = this.project;
    if (!open) return;
    const from = this.player.clipStart(clip.id, clip.startBar);
    const bars = this.player.clipBars(clip.id, clip.bars);
    if (!clipFits(this.laneOf(clip), clip.id, from + delta, bars, open.bars)) return;
    this.player.moveClip(clip.id, clip.startBar, from + delta);
    this.snackbar.say('music.msg.clipMoved', { name: this.t(clip.labelKey) });
  }

  stretch(clip: Clip, delta: number) {
    const open = this.project;
    if (!open) return;
    const from = this.player.clipStart(clip.id, clip.startBar);
    const bars = this.player.clipBars(clip.id, clip.bars) + delta;
    if (bars < 1 || !clipFits(this.laneOf(clip), clip.id, from, bars, open.bars)) return;
    this.player.resizeClip(clip.id, clip.bars, bars);
    this.snackbar.say('music.msg.clipResized', { name: this.t(clip.labelKey) });
  }

  drop(clip: Clip) {
    this.player.removeClip(clip.id);
    this.selected.set(null);
    this.snackbar.say('music.msg.clipRemoved', { name: this.t(clip.labelKey) });
  }

  doUndo() {
    const edit = this.player.undo();
    this.snackbar.say(edit ? 'music.msg.undone' : 'music.msg.nothingToUndo', {
      name: edit ? this.t(edit.labelKey) : '',
    });
  }
  doRedo() {
    const edit = this.player.redo();
    this.snackbar.say(edit ? 'music.msg.redone' : 'music.msg.nothingToRedo', {
      name: edit ? this.t(edit.labelKey) : '',
    });
  }
}
