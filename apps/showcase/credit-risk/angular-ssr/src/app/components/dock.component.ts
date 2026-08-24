import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FRAMEWORK, FRAMEWORKS, SHOWCASE_BASE } from '../lib/routes';

/**
 * `<awc-showcase-dock>` — the same bar on every screen.
 *
 * `base-path` is the prefix BEFORE the framework segment, not this app's base
 * href — the dock swaps `angular-ssr` for `react` inside the path it finds, and
 * falls back to `base-path` when the current segment is not in the URL.
 *
 * Registration happens in the `APP_INITIALIZER` in `app.config.ts`; this is only
 * the tag. Every value is an ATTRIBUTE binding, so it survives the server render —
 * see `components/element.md` for why that distinction matters here.
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
