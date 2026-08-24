import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { ShowcaseComponent } from '../lib/screen.base';

export interface OrgNode {
  id: string;
  name: string;
  title?: string;
  avatarInitials?: string;
  children?: OrgNode[];
}

@Component({
  selector: 'awc-org-chart',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-organization-chart
      [nodes]="nodes"
      [attr.label]="t('screen.groups.title')"
      [attr.expand-label]="t('action.expand')"
      [attr.collapse-label]="t('action.collapse')"
      orientation="vertical"
    ></md-organization-chart>
  `,
})
export class OrgChartComponent extends ShowcaseComponent {
  @Input({ required: true }) nodes!: OrgNode[];
}
