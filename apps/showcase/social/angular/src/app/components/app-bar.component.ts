import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { getViewer } from '@awc-ui/showcase-kit/social';
import { COMPACT_NAV, mediaQuery } from '../lib/media';
import { ShowcaseComponent } from '../lib/screen.base';
import { ShellService } from '../lib/shell.service';

/**
 * The masthead. One per page — the host carries `role="banner"`.
 *
 * The leading affordance toggles the rail between its collapsed and expanded
 * variants. It lives HERE rather than in the rail's own `expandable` toggle for
 * one reason: at compact width the rail is not rendered at all, and a control
 * that vanishes with the surface it controls is fine, whereas two toggles for
 * one thing is not. `mdLeadingClick` fires only for the prop-based button,
 * which is exactly the one being used — and Angular's event binding calls
 * `addEventListener` with the literal camelCase name, so it binds directly.
 *
 * THE DISCLAIMER IS PART OF THE CHROME, not a footnote. Every person in this
 * app is invented, every caption was written for it, and every picture is
 * generated artwork — all presented in the shape of a real social app, which is
 * exactly the combination a reader could mistake for one. The stakes are higher
 * here than in the three consoles: those invent a bank, this one invents
 * PEOPLE. So
 * the disclaimer sits in the app bar, beside the brand it qualifies, visible on
 * every screen rather than at the bottom of one. It goes in the `headline`
 * SLOT rather than the `headline` prop because the two are alternatives, and
 * the slot renders inside the same `part="title"` span the prop does — so the
 * brand keeps the app bar's own title typography and the chip simply sits next
 * to it. `md-tooltip` carries the full sentence; the chip's own label already
 * says the load-bearing part.
 *
 * The trailing slot is CAPPED AT THREE elements by the component, and M3 wants
 * it sparse. Two are used: who is signed in, and their portrait. There is no
 * notifications bell — Activity is a destination in the rail already.
 */
@Component({
  selector: 'awc-app-bar',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-app-bar
      class="shell__appbar"
      variant="small"
      [attr.subtitle]="t('social.app.title')"
      [attr.leading-icon]="compactNav() ? null : 'menu'"
      [attr.leading-icon-label]="compactNav() ? null : t('social.nav.menu')"
      (mdLeadingClick)="shell.toggleRail()"
    >
      <span slot="headline" class="shell__brand">
        {{ t('social.app.brand') }}
        <md-tooltip [attr.text]="t('social.app.demoNotice')">
          <md-chip
            [attr.label]="t('social.app.demo')"
            appearance="outlined"
            color="warning"
            icon="science"
          ></md-chip>
        </md-tooltip>
      </span>

      <!-- WHO IS SIGNED IN, and nothing else. The three consoles put a
           reporting date and a base currency here because every figure on their
           screens is measured against those two facts. Nothing on these screens
           is: a feed is not "as of" anything, and the relative timestamps say
           when each post was without a reference date in the chrome. -->
      <div slot="trailing" class="shell__meta">
        <span>{{ viewer.displayName }}</span>
        <span class="shell__handle">&#64;{{ viewer.handle }}</span>
      </div>
      <md-avatar
        slot="trailing"
        [attr.src]="viewer.avatar"
        [attr.name]="viewer.displayName"
        [attr.label]="t('social.app.viewer', { name: viewer.displayName })"
        size="small"
      ></md-avatar>
    </md-app-bar>
  `,
})
export class AppBarComponent extends ShowcaseComponent {
  protected readonly shell = inject(ShellService);
  protected readonly viewer = getViewer();
  /* The rail does not exist below 900px, so the button that toggles it is not
     rendered there rather than left toggling nothing. */
  protected readonly compactNav = mediaQuery(COMPACT_NAV);
}
