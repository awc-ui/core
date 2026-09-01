import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { BASE_CURRENCY, getAdvisor, REPORTING_DATE, REPORTING_QUARTER } from '@awc-ui/showcase-kit/wealth';
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
 * THE DISCLAIMER IS PART OF THE CHROME, not a footnote. Every proper noun in
 * this app is invented — the bank, the households, the instruments, the
 * advisors — and it is all presented in the shape of a real private-banking
 * console, which is exactly the combination a reader could mistake for one. So
 * the disclaimer sits in the app bar, beside the brand it qualifies, visible on
 * every screen rather than at the bottom of one. It goes in the `headline`
 * SLOT rather than the `headline` prop because the two are alternatives, and
 * the slot renders inside the same `part="title"` span the prop does — so the
 * brand keeps the app bar's own title typography and the chip simply sits next
 * to it. `md-tooltip` carries the full sentence; the chip's own label already
 * says the load-bearing part.
 *
 * The trailing slot is CAPPED AT THREE elements by the component, and M3 wants
 * it sparse. Two are used: the reporting context, and the signed-in advisor.
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
      [attr.subtitle]="t('wealth.app.title')"
      leading-icon="menu"
      [attr.leading-icon-label]="t('wealth.nav.menu')"
      (mdLeadingClick)="shell.toggleRail()"
    >
      <span slot="headline" class="shell__brand">
        {{ t('wealth.app.brand') }}
        <md-tooltip [attr.text]="t('wealth.app.demoNotice')">
          <md-chip
            [attr.label]="t('wealth.app.demo')"
            appearance="outlined"
            color="warning"
            icon="science"
          ></md-chip>
        </md-tooltip>
      </span>

      <div slot="trailing" class="shell__meta">
        <span>{{ t('wealth.app.reportingDate', { date: t.formatDate(reportingDate, 'medium') }) }}</span>
        <span>{{ t('wealth.app.reportingQuarter', { quarter: reportingQuarter }) }}</span>
        <span>{{ t('wealth.app.baseCurrency', { currency: baseCurrency }) }}</span>
      </div>
      <!-- label is the accessible name; name only supplies the initials.
           Presentational — the avatar is not a control and opens nothing. -->
      <md-avatar
        slot="trailing"
        [attr.name]="advisor.name"
        [attr.label]="t('wealth.app.advisor', { name: advisor.name })"
        size="small"
      ></md-avatar>
    </md-app-bar>
  `,
})
export class AppBarComponent extends ShowcaseComponent {
  protected readonly shell = inject(ShellService);
  protected readonly advisor = getAdvisor();
  protected readonly reportingDate = REPORTING_DATE;
  protected readonly reportingQuarter = REPORTING_QUARTER;
  protected readonly baseCurrency = BASE_CURRENCY;
}
