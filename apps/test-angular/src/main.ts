import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
// AppComponent's reactive-form demo imports AwcUiModule, whose standalone
// proxies register the bundler-compatible custom elements before bootstrap.
bootstrapApplication(AppComponent).catch(err => console.error(err));
