import { Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';

/**
 * A titled surface. Everything on every screen lives in one of these.
 *
 * `CUSTOM_ELEMENTS_SCHEMA` on every component that touches an `md-*` tag: it is
 * what stops Angular treating an unknown element as a missing component and
 * erroring at compile time.
 */
@Component({
  selector: 'awc-panel',
  standalone: true,
  styles: ':host { display: contents; }',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <md-card [attr.variant]="variant" class="panel" full-width>
      <div class="panel__inner">
        @if (title) {
          <div class="panel__head">
            <div>
              <h2 class="panel__title">{{ title }}</h2>
              @if (subtitle) {
                <p class="panel__sub">{{ subtitle }}</p>
              }
            </div>
            <ng-content select="[actions]" />
          </div>
        }
        <ng-content />
      </div>
    </md-card>
  `,
})
export class PanelComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() variant: 'elevated' | 'filled' | 'outlined' = 'outlined';
}
