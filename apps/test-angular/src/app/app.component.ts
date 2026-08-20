import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormComponent } from './reactive-form.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="app" [attr.data-theme]="dark ? 'dark' : null">
      <div class="content">
        <h1>AWC UI Angular Integration</h1>

        <section>
          <h2>Reactive Forms (ControlValueAccessor)</h2>
          <app-reactive-form></app-reactive-form>
        </section>
        <p class="subtitle">All 34 Material Design 3 components</p>

        <section>
          <md-button variant="tonal" (mdClick)="toggleTheme()">
            {{ dark ? '☀️ Light Mode' : '🌙 Dark Mode' }}
          </md-button>
        </section>

        <section>
          <h2>Buttons</h2>
          <div class="row">
            <md-button variant="filled">Filled</md-button>
            <md-button variant="outlined">Outlined</md-button>
            <md-button variant="text">Text</md-button>
            <md-button variant="elevated">Elevated</md-button>
            <md-button variant="tonal">Tonal</md-button>
            <md-button variant="filled" icon="add">With Icon</md-button>
            <md-button variant="filled" [attr.disabled]="true">Disabled</md-button>
            <md-button variant="filled" loading>Loading</md-button>
          </div>
        </section>

        <section>
          <h2>Icon Buttons</h2>
          <div class="row">
            <md-icon-button variant="standard" icon="favorite"></md-icon-button>
            <md-icon-button variant="filled" icon="favorite"></md-icon-button>
            <md-icon-button variant="outlined" icon="favorite"></md-icon-button>
            <md-icon-button variant="tonal" icon="favorite"></md-icon-button>
          </div>
        </section>

        <section>
          <h2>FABs</h2>
          <div class="row" style="align-items:flex-end">
            <md-fab variant="primary" size="small" icon="add"></md-fab>
            <md-fab variant="primary" icon="add"></md-fab>
            <md-fab variant="secondary" icon="favorite"></md-fab>
            <md-fab variant="primary" size="extended" icon="add" label="Create"></md-fab>
          </div>
        </section>

        <section>
          <h2>Text Fields</h2>
          <div class="row">
            <div style="width:240px"><md-text-field variant="filled" label="Filled"></md-text-field></div>
            <div style="width:240px"><md-text-field variant="outlined" label="Outlined"></md-text-field></div>
          </div>
        </section>

        <section>
          <h2>Select</h2>
          <div class="row">
            <div style="width:200px">
              <md-select label="Color" variant="filled">
                <md-select-option value="red">Red</md-select-option>
                <md-select-option value="green">Green</md-select-option>
                <md-select-option value="blue">Blue</md-select-option>
              </md-select>
            </div>
            <div style="width:200px">
              <md-select label="Size" variant="outlined">
                <md-select-option value="s">Small</md-select-option>
                <md-select-option value="m">Medium</md-select-option>
                <md-select-option value="l">Large</md-select-option>
              </md-select>
            </div>
          </div>
        </section>

        <section>
          <h2>Checkboxes, Radio & Switch</h2>
          <div class="row">
            <md-checkbox></md-checkbox>
            <md-radio name="r" value="a"></md-radio>
            <md-radio name="r" value="b"></md-radio>
            <md-switch></md-switch>
          </div>
        </section>

        <section>
          <h2>Chips</h2>
          <div class="row">
            <md-chip variant="assist" label="Assist"></md-chip>
            <md-chip variant="filter" label="Filter"></md-chip>
            <md-chip variant="input" label="Input" removable></md-chip>
          </div>
        </section>

        <section>
          <h2>Progress Indicators</h2>
          <div class="row">
            <md-progress-indicator variant="circular" value="70"></md-progress-indicator>
            <md-progress-indicator variant="circular" indeterminate></md-progress-indicator>
            <div style="width:200px">
              <md-progress-indicator variant="linear" value="50"></md-progress-indicator>
            </div>
          </div>
        </section>

        <section>
          <h2>Slider</h2>
          <div class="row" style="width:420px">
            <md-slider min="0" max="100" value="40"></md-slider>
            <md-slider range value-start="20" value-end="70"></md-slider>
          </div>
        </section>

        <section>
          <h2>Dialog & Snackbar</h2>
          <div class="row">
            <md-button variant="outlined" (mdClick)="dialogOpen = !dialogOpen">
              {{ dialogOpen ? 'Close Dialog' : 'Open Dialog' }}
            </md-button>
            <md-dialog [attr.open]="dialogOpen ? '' : null" headline="Demo Dialog">
              <p>This is a static dialog preview.</p>
              <div slot="actions">
                <md-button variant="text" (mdClick)="dialogOpen = false">Cancel</md-button>
                <md-button variant="filled" (mdClick)="dialogOpen = false">Confirm</md-button>
              </div>
            </md-dialog>
            <md-button variant="outlined" (mdClick)="snackbarOpen = !snackbarOpen">
              {{ snackbarOpen ? 'Hide Snackbar' : 'Show Snackbar' }}
            </md-button>
            <md-snackbar [attr.open]="snackbarOpen ? '' : null" message="File saved successfully" action="Undo"></md-snackbar>
          </div>
        </section>

        <section>
          <h2>Cards</h2>
          <div class="row" style="align-items:flex-start">
            <md-card variant="elevated" style="width:180px">
              <div slot="header" style="padding:16px 16px 0;font-weight:500">Elevated</div>
              <p style="padding:16px;margin:0;font-size:14px;color:var(--md-sys-color-on-surface-variant)">Angular card</p>
            </md-card>
            <md-card variant="filled" style="width:180px">
              <div slot="header" style="padding:16px 16px 0;font-weight:500">Filled</div>
              <p style="padding:16px;margin:0;font-size:14px;color:var(--md-sys-color-on-surface-variant)">Angular card</p>
            </md-card>
            <md-card variant="outlined" style="width:180px">
              <div slot="header" style="padding:16px 16px 0;font-weight:500">Outlined</div>
              <p style="padding:16px;margin:0;font-size:14px;color:var(--md-sys-color-on-surface-variant)">Angular card</p>
            </md-card>
          </div>
        </section>

        <section>
          <h2>Navigation Bar</h2>
          <div style="width:400px">
            <md-navigation-bar>
              <md-navigation-tab label="Home" icon="home" active></md-navigation-tab>
              <md-navigation-tab label="Search" icon="search"></md-navigation-tab>
              <md-navigation-tab label="Profile" icon="person"></md-navigation-tab>
            </md-navigation-bar>
          </div>
        </section>

        <section>
          <h2>Tabs</h2>
          <div style="width:460px">
            <md-tabs active-tab-index="1">
              <md-tab label="Overview" icon="dashboard"></md-tab>
              <md-tab label="Details" icon="info" active></md-tab>
              <md-tab label="Settings" icon="settings"></md-tab>
            </md-tabs>
          </div>
        </section>

        <section>
          <h2>App Bar — Top</h2>
          <div style="border:1px solid var(--md-sys-color-outline-variant)">
            <md-app-bar title-alignment="center" headline="Inbox">
              <md-icon-button slot="leading" icon="menu"></md-icon-button>
              <md-icon-button slot="trailing" icon="search"></md-icon-button>
            </md-app-bar>
          </div>
        </section>

        <section>
          <h2>Date Picker</h2>
          <div style="width:260px">
            <md-date-picker label="Meeting Date" value="2026-03-12"></md-date-picker>
          </div>
        </section>

        <section>
          <h2>List, Menu & Sub Menu Item</h2>
          <div class="row" style="align-items:flex-start">
            <div style="width:320px">
              <md-list>
                <md-list-item headline="Profile" supporting-text="Manage account" leading-icon="person"></md-list-item>
                <md-divider></md-divider>
                <md-list-item headline="Notifications" supporting-text="Push and email settings" trailing-icon="chevron_right"></md-list-item>
              </md-list>
            </div>
            <div>
              <md-button id="menu-anchor" variant="outlined" (mdClick)="menuOpen = !menuOpen">
                {{ menuOpen ? 'Close Menu' : 'Open Menu' }}
              </md-button>
              <md-menu anchor="menu-anchor" [attr.open]="menuOpen ? '' : null" placement="bottom-start">
                <md-menu-item headline="Edit" leading-icon="edit"></md-menu-item>
                <md-sub-menu-item headline="More options" leading-icon="more_horiz">
                  <md-menu slot="submenu">
                    <md-menu-item headline="Archive"></md-menu-item>
                    <md-menu-item headline="Delete"></md-menu-item>
                  </md-menu>
                </md-sub-menu-item>
              </md-menu>
            </div>
          </div>
        </section>

        <section>
          <h2>Badge & Tooltip</h2>
          <div class="row">
            <div style="position:relative;display:inline-block">
              <md-icon-button icon="mail"></md-icon-button>
              <md-badge value="14" max="99"></md-badge>
            </div>
            <md-tooltip content="This is a rich tooltip" headline="Tooltip title" variant="rich">
              <md-button variant="tonal">Hover target</md-button>
            </md-tooltip>
          </div>
        </section>

        <section>
          <h2>Navigation Rail</h2>
          <div class="row" style="align-items:flex-start;min-height:260px">
            <md-navigation-rail alignment="top" has-fab>
              <md-fab slot="fab" icon="add" size="small"></md-fab>
              <md-navigation-rail-tab label="Home" icon="home" active></md-navigation-rail-tab>
              <md-navigation-rail-tab label="Search" icon="search"></md-navigation-rail-tab>
              <md-navigation-rail-tab label="Profile" icon="person" badge badge-value="2"></md-navigation-rail-tab>
            </md-navigation-rail>
          </div>
        </section>

        <section>
          <h2>Bottom App Bar & Bottom Sheet</h2>
          <div style="display:grid;gap:16px">
            <div>
            <md-button variant="outlined" (mdClick)="bottomSheetOpen = !bottomSheetOpen">
                {{ bottomSheetOpen ? 'Close Bottom Sheet' : 'Open Bottom Sheet' }}
              </md-button>
            </div>
            <md-navigation-bar>
              <md-navigation-tab label="Home" icon="home" active></md-navigation-tab>
              <md-navigation-tab label="Search" icon="search"></md-navigation-tab>
              <md-navigation-tab label="Favorites" icon="favorite"></md-navigation-tab>
            </md-navigation-bar>
            <md-bottom-sheet [open]="bottomSheetOpen" (mdClose)="bottomSheetOpen = false" variant="standard" headline="Quick actions">
              <md-list>
                <md-list-item headline="Share" leading-icon="share"></md-list-item>
                <md-list-item headline="Save" leading-icon="bookmark"></md-list-item>
              </md-list>
            </md-bottom-sheet>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .app { background-color: var(--md-sys-color-background); color: var(--md-sys-color-on-background); min-height: 100vh; font-family: Roboto, sans-serif; }
    .content { padding: 24px; max-width: 900px; }
    h1 { font-size: 32px; font-weight: 400; margin-bottom: 8px; }
    .subtitle { color: var(--md-sys-color-on-surface-variant); margin-bottom: 32px; }
    h2 { font-size: 22px; font-weight: 400; margin-bottom: 16px; }
    section { margin-bottom: 32px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  `],
})
export class AppComponent {
  dark = false;
  dialogOpen = false;
  menuOpen = false;
  bottomSheetOpen = false;
  snackbarOpen = false;

  toggleTheme() {
    this.dark = !this.dark;
    document.documentElement.setAttribute('data-theme', this.dark ? 'dark' : '');
    document.documentElement.style.backgroundColor = this.dark ? 'var(--md-sys-color-background)' : '';
  }

}
