import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '../lib/routes';

/**
 * `<awc-showcase-dock>` — the same bar on every screen.
 *
 * `base-path` is the prefix BEFORE the framework segment, not this app's base
 * href — the dock swaps `angular` for `react` inside the path it finds, and
 * falls back to `base-path` when the current segment is not in the URL.
 *
 * `FRAMEWORKS` comes from the kit, so the switcher offers every build in the
 * vertical — including `angular-ssr`, this build's server-rendered twin, which
 * serves the same six screens from the same components — and a build added later
 * appears here with no edit.
 *
 * Registration happens in the `APP_INITIALIZER` in `app.config.ts`; this is only
 * the tag. Every value is an ATTRIBUTE binding, which is the house rule — see
 * `components/element.md` for the two reasons.
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
    ></awc-showcase-dock>
  `,
})
export class DockComponent {
  protected readonly frameworks = FRAMEWORKS.join(',');
  protected readonly framework = FRAMEWORK;
  protected readonly basePath = SHOWCASE_BASE;
}
