import { bootstrapApplication } from '@angular/platform-browser';
// The demos use raw custom elements. Each public component entry registers
// its element and any elements it renders inside its shadow root.
import '@awc-ui/core/components/md-app-bar';
import '@awc-ui/core/components/md-badge';
import '@awc-ui/core/components/md-bottom-sheet';
import '@awc-ui/core/components/md-button';
import '@awc-ui/core/components/md-card';
import '@awc-ui/core/components/md-checkbox';
import '@awc-ui/core/components/md-chip';
import '@awc-ui/core/components/md-date-picker';
import '@awc-ui/core/components/md-dialog';
import '@awc-ui/core/components/md-divider';
import '@awc-ui/core/components/md-fab';
import '@awc-ui/core/components/md-icon-button';
import '@awc-ui/core/components/md-list';
import '@awc-ui/core/components/md-list-item';
import '@awc-ui/core/components/md-menu';
import '@awc-ui/core/components/md-menu-item';
import '@awc-ui/core/components/md-navigation-bar';
import '@awc-ui/core/components/md-navigation-rail';
import '@awc-ui/core/components/md-navigation-rail-tab';
import '@awc-ui/core/components/md-navigation-tab';
import '@awc-ui/core/components/md-progress-indicator';
import '@awc-ui/core/components/md-radio';
import '@awc-ui/core/components/md-rating';
import '@awc-ui/core/components/md-select';
import '@awc-ui/core/components/md-select-option';
import '@awc-ui/core/components/md-slider';
import '@awc-ui/core/components/md-snackbar';
import '@awc-ui/core/components/md-sub-menu-item';
import '@awc-ui/core/components/md-switch';
import '@awc-ui/core/components/md-tab';
import '@awc-ui/core/components/md-tabs';
import '@awc-ui/core/components/md-text-field';
import '@awc-ui/core/components/md-tooltip';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent).catch(err => console.error(err));
