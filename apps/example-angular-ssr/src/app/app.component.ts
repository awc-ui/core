import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  // CUSTOM_ELEMENTS_SCHEMA lets Angular's template compiler accept <md-*> elements.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main style="padding:40px;font-family:system-ui,sans-serif;display:grid;gap:20px;max-width:640px">
      <h1 style="margin:0">AWC UI — Angular SSR (DSD)</h1>
      <p style="margin:0;color:#555">Prerendered by Angular, then given Declarative Shadow DOM by the AWC UI hydrate module.</p>
      <md-card variant="elevated">
        <div style="padding:20px;display:grid;gap:16px">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <md-button variant="filled">Filled</md-button>
            <md-button variant="outlined">Outlined</md-button>
            <md-badge value="3"></md-badge>
          </div>
          <md-checkbox checked>Server-checked</md-checkbox>
        </div>
      </md-card>
    </main>
  `,
})
export class AppComponent {}
