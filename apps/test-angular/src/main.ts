import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { defineCustomElements } from '@awc-ui/core/loader';

defineCustomElements(window);

bootstrapApplication(AppComponent).catch(err => console.error(err));
