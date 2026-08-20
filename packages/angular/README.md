# @awc-ui/angular

Angular bindings for [AWC UI](https://www.npmjs.com/package/@awc-ui/core) — Material Design 3 web components, with directives that bridge Angular templates (including `ngModel` / reactive forms) to the underlying custom elements.

## Install

```bash
npm install @awc-ui/angular @awc-ui/core
```

Requires Angular 17+.

## Usage

```ts
// NgModule apps
import { AwcUiModule } from '@awc-ui/angular';

@NgModule({
  imports: [AwcUiModule],
})
export class AppModule {}
```

```ts
// Standalone apps
import { importProvidersFrom } from '@angular/core';
import { AwcUiModule, provideAwcUi } from '@awc-ui/angular';

bootstrapApplication(AppComponent, {
  providers: [provideAwcUi(), importProvidersFrom(AwcUiModule)],
});
```

```html
<md-button variant="filled">Click me</md-button>
```

## Documentation

Component docs, theming, and per-component manuals ship with [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core).
