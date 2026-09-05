/**
 * A project drill. It delegates to `StudioScreen` with a slug rather than
 * reimplementing the arrangement: two copies of the timeline would be two
 * places to fix the next thing found in it.
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { projectBySlug } from '@awc-ui/showcase-kit/music';
import { StudioScreen } from './studio.component';
import { NotFoundScreen } from './not-found.component';

@Component({
  /* `:host { display: contents }` — the Angular host must be transparent to
     layout, or it becomes a box between a grid and the element that was meant
     to be its child. A shelf of album cards would lay out the HOSTS, not the
     cards, and the parity check reads it as a different document. */
  styles: ':host { display: contents; }',
  selector: 'awc-project-screen',
  standalone: true,
  imports: [CommonModule, StudioScreen, NotFoundScreen],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <awc-not-found-screen *ngIf="!exists" />
    <awc-studio-screen *ngIf="exists" [slug]="slug" />
  `,
})
export class ProjectScreen {
  /* The screen guards its own parameter: it came from a URL. */
  @Input({ required: true }) slug!: string;
  get exists() { return projectBySlug(this.slug) !== null; }
}
