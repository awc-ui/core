# Angular Web Components and Angular SSR — @awc-ui/angular

Angular 17+ integration for AWC UI.

`@awc-ui/angular` provides standalone component proxies and Angular form value
accessors. Imports register their custom elements automatically.

```bash
npm install @awc-ui/angular @awc-ui/core
```

Load the theme once in your application entry:

```ts
import '@awc-ui/core/css/tokens.css';
```

For a standalone component, import the controls and accessors into its template
scope, alongside Angular's forms module:

```ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MdButton, MdTextField, TextValueAccessor } from '@awc-ui/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, MdButton, MdTextField, TextValueAccessor],
  template: `
    <md-text-field label="Email" type="email" [(ngModel)]="email"></md-text-field>
    <md-button variant="filled">Continue</md-button>
  `,
})
export class AppComponent {
  email = '';
}
```

For convenience, `imports: [FormsModule, AwcUiModule]` supplies every component
and accessor. Use `ReactiveFormsModule` for `formControl` and `formControlName`.
NgModule applications also put `AwcUiModule` in `imports`.

`importProvidersFrom(AwcUiModule)` does not add directives to a standalone
component's template scope. `provideAwcUi()` is only needed for applications
using the lazy loader with raw tags; imported proxies already register themselves.

Radio controls bind the selected option's `value`, preserving each radio's
identity. Import both `MdRadio` and `RadioValueAccessor` for individual imports:

```html
<md-radio name="plan" value="basic" [(ngModel)]="plan">Basic</md-radio>
<md-radio name="plan" value="pro" [(ngModel)]="plan">Pro</md-radio>
```

Initialize `plan` to `'basic'` or `'pro'`; resetting the form to `null` clears the
selection. Multi-select accessors normalize a form reset to an empty array.

## Server rendering

See the [Angular SSR guide](https://awc-ui.dev/frameworks/angular/) for the shared hydration lifecycle and reference application.
