import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ShowcaseComponent } from '../lib/screen.base';
import { BASE_PATH, type CrumbSpec } from '../lib/routes';

/**
 * The trail, with `mdSelect` intercepted for client-side routing.
 *
 * `mdSelect` is cancelable and bubbles from the item to the strip, so one
 * listener on the strip is enough, and `preventDefault()` stops the anchor from
 * doing a full page load. The crumbs still carry real, fully-prefixed hrefs,
 * because a real href is what makes ⌘-click, middle-click and "copy link
 * address" behave. `originalEvent` is the MouseEvent or KeyboardEvent that
 * produced the selection, so one modifier check covers the Enter path too.
 *
 * A crumb is either a translated label or a proper noun — the kit's
 * `crumbsFor()` returns exactly one of `labelKey` / `label` and never a
 * pre-translated string.
 *
 * The last crumb is the page you are already on, so it is never a link —
 * md-breadcrumbs promotes it to `current` and gives it `aria-current="page"`
 * itself. `crumbsFor` already returns a null href for every deep trail's tail;
 * the overview's single crumb is the one case that would otherwise link to
 * itself, which is what the `$last` guard covers.
 */
@Component({
  selector: 'awc-breadcrumbs',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-breadcrumbs
      [attr.label]="t('wealth.nav.breadcrumb')"
      max-items="4"
      items-before-collapse="1"
      items-after-collapse="2"
      (mdSelect)="intercept($event)"
    >
      @for (crumb of crumbs; track $index) {
        <md-breadcrumb-item [attr.href]="crumb.href && !$last ? withBase(crumb.href) : null">
          {{ crumb.labelKey ? t(crumb.labelKey) : crumb.label }}
        </md-breadcrumb-item>
      }
    </md-breadcrumbs>
  `,
})
export class BreadcrumbsComponent extends ShowcaseComponent {
  @Input({ required: true }) crumbs: CrumbSpec[] = [];

  private readonly router = inject(Router);

  protected intercept(event: Event): void {
    const detail = (
      event as CustomEvent<{ href?: string; originalEvent?: MouseEvent | KeyboardEvent }>
    ).detail;
    const href = detail?.href;
    if (!href) return;
    const original = detail?.originalEvent as MouseEvent | undefined;
    if (
      original &&
      (original.metaKey ||
        original.ctrlKey ||
        original.shiftKey ||
        original.altKey ||
        (original.button !== undefined && original.button !== 0))
    ) {
      return;
    }
    event.preventDefault();
    const bare = href.startsWith(BASE_PATH) ? href.slice(BASE_PATH.length) : href;
    void this.router.navigateByUrl(this.appPath(bare || '/'));
  }
}
