<template>
  <div class="app" :data-theme="dark ? 'dark' : undefined">
    <div class="content">
      <h1>AWC UI Vue Integration</h1>
      <p class="subtitle">All 34 Material Design 3 components</p>

      <section>
        <md-button variant="tonal" @click="toggleTheme">
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
          <md-button variant="filled" :disabled="true">Disabled</md-button>
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
          <md-fab variant="primary" size="medium" icon="add"></md-fab>
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
          <md-checkbox :checked="checked" @md-change="checked = $event.detail.checked"></md-checkbox>
          <md-radio name="r" value="a"></md-radio>
          <md-radio name="r" value="b"></md-radio>
          <md-switch :selected="switched" @md-change="switched = $event.detail"></md-switch>
        </div>
      </section>

      <section>
        <h2>Chips</h2>
        <div class="row">
          <md-chip variant="assist" label="Assist"></md-chip>
          <md-chip variant="filter" label="Filter"></md-chip>
          <md-chip variant="input" label="Input" :removable="true"></md-chip>
          <md-chip variant="filter" label="Selected" :selected="true"></md-chip>
        </div>
      </section>

      <section>
        <h2>Progress Indicators</h2>
        <div class="row">
          <md-progress-indicator variant="circular" :value="70"></md-progress-indicator>
          <md-progress-indicator variant="circular" :indeterminate="true"></md-progress-indicator>
          <div style="width:200px"><md-progress-indicator variant="linear" :value="50"></md-progress-indicator></div>
        </div>
      </section>

      <section>
        <h2>Slider</h2>
        <div class="row" style="width:420px">
          <md-slider :min="0" :max="100" :value="40"></md-slider>
          <md-slider :range="true" :value-start="20" :value-end="70"></md-slider>
        </div>
      </section>

      <section>
        <h2>Dialog & Snackbar</h2>
        <div class="row">
          <md-button variant="outlined" @click="dialogOpen = !dialogOpen">
            {{ dialogOpen ? 'Close Dialog' : 'Open Dialog' }}
          </md-button>
          <md-dialog :open="dialogOpen" headline="Demo Dialog">
            <p>This is a static dialog preview.</p>
            <div slot="actions">
              <md-button variant="text" @click="dialogOpen = false">Cancel</md-button>
              <md-button variant="filled" @click="dialogOpen = false">Confirm</md-button>
            </div>
          </md-dialog>
          <md-button variant="outlined" @click="snackbarOpen = !snackbarOpen">
            {{ snackbarOpen ? 'Hide Snackbar' : 'Show Snackbar' }}
          </md-button>
          <md-snackbar :open="snackbarOpen" message="File saved successfully" action="Undo"></md-snackbar>
        </div>
      </section>

      <section>
        <h2>Cards</h2>
        <div class="row" style="align-items:flex-start">
          <md-card v-for="v in ['elevated','filled','outlined']" :key="v" :variant="v" style="width:180px">
            <div slot="header" style="padding:16px 16px 0;font-weight:500;text-transform:capitalize">{{ v }}</div>
            <p style="padding:16px;margin:0;font-size:14px;color:var(--md-sys-color-on-surface-variant)">Vue card content</p>
          </md-card>
        </div>
      </section>

      <section>
        <h2>Navigation Bar</h2>
        <div style="width:400px">
          <md-navigation-bar>
            <md-navigation-tab label="Home" icon="home" :active="true"></md-navigation-tab>
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
            <md-tab label="Details" icon="info" :active="true"></md-tab>
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
            <md-button id="menu-anchor" variant="outlined" @click="menuOpen = !menuOpen">
              {{ menuOpen ? 'Close Menu' : 'Open Menu' }}
            </md-button>
            <md-menu anchor="menu-anchor" :open="menuOpen" placement="bottom-start">
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
            <md-badge value="14" :max="99"></md-badge>
          </div>
          <md-tooltip content="This is a rich tooltip" headline="Tooltip title" variant="rich">
            <md-button variant="tonal">Hover target</md-button>
          </md-tooltip>
        </div>
      </section>

      <section>
        <h2>Navigation Rail</h2>
        <div class="row" style="align-items:flex-start;min-height:260px">
          <md-navigation-rail alignment="top" :has-fab="true">
            <md-fab slot="fab" icon="add" size="small"></md-fab>
            <md-navigation-rail-tab label="Home" icon="home" :active="true"></md-navigation-rail-tab>
            <md-navigation-rail-tab label="Search" icon="search"></md-navigation-rail-tab>
            <md-navigation-rail-tab label="Profile" icon="person" :badge="true" badge-value="2"></md-navigation-rail-tab>
          </md-navigation-rail>
        </div>
      </section>

      <section>
        <h2>Bottom App Bar & Bottom Sheet</h2>
        <div style="display:grid;gap:16px">
          <div>
            <md-button variant="outlined" @click="bottomSheetOpen = !bottomSheetOpen">
              {{ bottomSheetOpen ? 'Close Bottom Sheet' : 'Open Bottom Sheet' }}
            </md-button>
          </div>
          <md-navigation-bar>
            <md-navigation-tab label="Home" icon="home" active></md-navigation-tab>
            <md-navigation-tab label="Search" icon="search"></md-navigation-tab>
            <md-navigation-tab label="Favorites" icon="favorite"></md-navigation-tab>
          </md-navigation-bar>
          <md-bottom-sheet :open="bottomSheetOpen" variant="standard" headline="Quick actions" @md-close="bottomSheetOpen = false">
            <md-list>
              <md-list-item headline="Share" leading-icon="share"></md-list-item>
              <md-list-item headline="Save" leading-icon="bookmark"></md-list-item>
            </md-list>
          </md-bottom-sheet>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const dark = ref(false);
const checked = ref(false);
const switched = ref(false);
const dialogOpen = ref(false);
const menuOpen = ref(false);
const bottomSheetOpen = ref(false);
const snackbarOpen = ref(false);

function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.setAttribute('data-theme', dark.value ? 'dark' : '');
  document.documentElement.style.backgroundColor = dark.value ? 'var(--md-sys-color-background)' : '';
}

</script>

<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background-color: var(--md-sys-color-background, #FFFBFE); }

.app { background-color: var(--md-sys-color-background); color: var(--md-sys-color-on-background); min-height: 100vh; }
.content { padding: 24px; font-family: Roboto, sans-serif; max-width: 900px; }

h1 { font-size: 32px; font-weight: 400; margin-bottom: 8px; }
.subtitle { color: var(--md-sys-color-on-surface-variant); margin-bottom: 32px; }
h2 { font-size: 22px; font-weight: 400; margin-bottom: 16px; }
section { margin-bottom: 32px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
</style>
