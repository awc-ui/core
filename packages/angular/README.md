# Angular Web Components and Angular SSR — @awc-ui/angular

Angular 20.3.31+ integration for AWC UI.

The wrapper is built with the patched Angular 20 compiler. Applications must use
Angular 20.3.31 or newer; upgrade Angular before updating this package from a
version that supported Angular 17–19.

`@awc-ui/angular` provides standalone component proxies and Angular form value
accessors. Importing a proxy registers its custom element.

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

Applications that register raw custom elements can import their form accessors
from `@awc-ui/angular/forms`. This entry contains only form accessors and shares
the same directives as `@awc-ui/angular`, without importing the full component
proxy registry. Register the Core elements used by the template and add
`CUSTOM_ELEMENTS_SCHEMA`.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextValueAccessor } from '@awc-ui/angular/forms';
import '@awc-ui/core/components/md-text-field';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, TextValueAccessor],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<md-text-field label="Email" [(ngModel)]="email"></md-text-field>`,
})
export class AppComponent {
  email = '';
}
```

The forms entry does not provide typed component proxies or their ordinary-input
SSR serialization. For raw tags, supply non-form initial state through
server-renderable attributes. Keep SSR-capable `components/*` imports for SSR or
prerendering. Existing imports from `@awc-ui/angular` and `AwcUiModule` keep their
behavior; the smaller forms entry is an optional registration strategy.

Radio controls bind the selected option's `value`, preserving each radio's
identity. Import both `MdRadio` and `RadioValueAccessor` for individual imports:

```html
<md-radio name="plan" value="basic" [(ngModel)]="plan">Basic</md-radio>
<md-radio name="plan" value="pro" [(ngModel)]="plan">Pro</md-radio>
```

Initialize `plan` to `'basic'` or `'pro'`; resetting the form to `null` clears the
selection. Multi-select accessors normalize a form reset to an empty array.

## Server rendering

Ordinary input bindings such as `[label]`, `[value]` and `[selected]` also
serialize their server state using Core's declared attribute names, including
custom aliases. Supported option/item/node arrays use JSON attributes, and
selection arrays use the same initial-value seed as forms. Callback and other
property-only inputs stay out of the HTML. On the client, bindings continue to
update properties without adding synthetic events or reflecting extra attributes.

Angular form accessors serialize their initial values on the server before the
Core HTML transform runs. Text, numeric, checked, selected and disabled values
therefore reach the first paint; radio options keep their own identity. Array
selections use the shared `data-awc-initial-values` seed, including an explicit
empty array. Browser accessors continue to write properties and emit no synthetic
change events during hydration.

Initial control state does not replay interaction animations during hydration;
the first real action and subsequent updates retain their feedback. Deploy
matching Core versions for server rendering and client registration, and rebuild
prerendered HTML after an upgrade. The shared SSR guide covers the class handoff
required when Angular claims server-rendered custom elements.

See the [Angular SSR guide](https://awc-ui.dev/frameworks/angular/) for the shared hydration lifecycle and reference application.
