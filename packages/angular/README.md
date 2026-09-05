# Angular Web Components and Angular SSR — @awc-ui/angular

Angular 17+ components for [AWC UI](https://www.npmjs.com/package/@awc-ui/core) — accessible Material Design 3 Web Components with directives that bridge Angular templates, `ngModel`, reactive forms, and Angular SSR.

## Install

```bash
npm install @awc-ui/angular @awc-ui/core
```

Requires Angular 17+.

## Usage

```ts
// NgModule apps
import { AwcUiModule } from "@awc-ui/angular";

@NgModule({
  imports: [AwcUiModule],
})
export class AppModule {}
```

```ts
// Standalone apps
import { importProvidersFrom } from "@angular/core";
import { AwcUiModule, provideAwcUi } from "@awc-ui/angular";

bootstrapApplication(AppComponent, {
  providers: [provideAwcUi(), importProvidersFrom(AwcUiModule)],
});
```

```html
<md-button variant="filled">Click me</md-button>
```

## Documentation

[Angular and Angular SSR guide](https://awc-ui.dev/frameworks/angular/) · [All component docs](https://awc-ui.dev/components/)

Component manuals and AI-readable documentation also ship with [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core).
