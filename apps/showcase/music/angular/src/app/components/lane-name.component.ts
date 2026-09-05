/**
 * A lane's name, renameable in place. A double-click opens it and so does Enter
 * — a rename reachable only by double-click is one most people never find and
 * some cannot perform at all.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { trackIcon, type StudioTrack } from '@awc-ui/showcase-kit/music';
import { ShowcaseService } from '../lib/showcase.service';
import { PlayerService } from '../lib/player.service';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-lane-name',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="lane-name" *ngIf="editing(); else display">
      <!-- A plain "value" + "input" pair rather than "ngModel": this build has
           no "@angular/forms" dependency, and pulling the whole forms package
           in for one text field would be the tail wagging the dog. -->
      <input
        #field
        class="lane-name__input"
        [value]="draft"
        [attr.aria-label]="label"
        (input)="draft = field.value"
        (blur)="commit()"
        (keydown.enter)="commit()"
        (keydown.escape)="cancel()"
      />
    </div>
    <ng-template #display>
      <div
        class="lane-name"
        role="button"
        tabindex="0"
        [attr.data-track]="track.id"
        [attr.aria-label]="label"
        (dblclick)="open()"
        (keydown.enter)="open()"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ icon }}</span>
        <span class="lane-name__text">{{ track.name }}</span>
      </div>
    </ng-template>
  `,
})
export class LaneNameComponent {
  private readonly showcase = inject(ShowcaseService);
  private readonly player = inject(PlayerService);

  @Input({ required: true }) track!: StudioTrack;
  @Output() message = new EventEmitter<{ key: string; params?: Record<string, string | number> }>();
  @ViewChild('field') field?: ElementRef<HTMLInputElement>;

  readonly editing = signal(false);
  draft = '';

  get icon() { return trackIcon[this.track.kind]; }
  get label() { return `${this.showcase.t('music.edit.trackRename')}: ${this.track.name}`; }

  open() {
    this.draft = this.track.name;
    this.editing.set(true);
    setTimeout(() => this.field?.nativeElement.focus(), 0);
  }

  commit() {
    this.editing.set(false);
    if (this.draft.trim() !== '' && this.draft !== this.track.name) {
      this.player.renameTrack(this.track.id, this.draft.trim());
      this.message.emit({ key: 'music.msg.trackRenamed', params: { name: this.draft.trim() } });
    }
  }

  /* Escape abandons rather than committing a half-typed name, which is what a
     blur would otherwise do. */
  cancel() {
    this.draft = this.track.name;
    this.editing.set(false);
  }
}
