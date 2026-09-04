import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ShowcaseComponent } from '../lib/screen.base';
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '../lib/routes';

/**
 * `<awc-showcase-dock>` — the same bar on every screen.
 *
 * `base-path` is the prefix BEFORE the framework segment, not this app's base
 * href — the dock swaps `angular` for `react` inside the path it finds, and
 * falls back to `base-path` when the current segment is not in the URL.
 *
 * `frameworks` comes from the kit, so the switcher offers every build in the
 * vertical — five for wealth (this console ships no server-rendered siblings) —
 * and a build added later appears here with no edit.
 *
 * `label` IS REQUIRED HERE, even though it looks optional. The dock falls back
 * to `t('app.title')` for its own heading, and that key belongs to the first
 * vertical — so an unlabelled dock in this app announces itself as
 * "Credit Risk Console" under a Vela app. It is a shared component with
 * one fallback and two consumers; naming it is the consumer's job.
 *
 * Registration happens in the `APP_INITIALIZER` in `app.config.ts`; this is
 * only the tag. Every value is an ATTRIBUTE binding, which is the house rule —
 * see `components/element.md`.
 */
@Component({
  selector: 'awc-dock',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <awc-showcase-dock
      [attr.frameworks]="frameworks"
      [attr.framework]="framework"
      [attr.base-path]="basePath"
      position="bottom"
      [attr.label]="t('social.app.title')"
    ></awc-showcase-dock>
  `,
})
export class DockComponent extends ShowcaseComponent {
  protected readonly frameworks = FRAMEWORKS.join(',');
  protected readonly framework = FRAMEWORK;
  protected readonly basePath = SHOWCASE_BASE;
}
