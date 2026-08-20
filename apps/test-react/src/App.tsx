import { useState } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [checked, setChecked] = useState(false);
  const [switched, setSwitched] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  const toggleTheme = () => {
    const newDark = !dark;
    setDark(newDark);
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : '');
    document.documentElement.style.backgroundColor = newDark ? 'var(--md-sys-color-background)' : '';
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Roboto, sans-serif', backgroundColor: 'var(--md-sys-color-background)', color: 'var(--md-sys-color-on-background)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 400, marginBottom: '8px' }}>AWC UI React Integration</h1>
      <p style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '32px' }}>All 34 Material Design 3 components</p>

      {/* Theme Toggle */}
      <section style={{ marginBottom: '32px' }}>
        <md-button variant="tonal" onClick={toggleTheme}>
          {dark ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </md-button>
      </section>

      {/* Buttons */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Buttons</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <md-button variant="filled">Filled</md-button>
          <md-button variant="outlined">Outlined</md-button>
          <md-button variant="text">Text</md-button>
          <md-button variant="elevated">Elevated</md-button>
          <md-button variant="tonal">Tonal</md-button>
          <md-button variant="filled" icon="add">With Icon</md-button>
          <md-button variant="filled" disabled>Disabled</md-button>
          <md-button variant="filled" loading>Loading</md-button>
        </div>
      </section>

      {/* Icon Buttons */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Icon Buttons</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <md-icon-button variant="standard" icon="favorite"></md-icon-button>
          <md-icon-button variant="filled" icon="favorite"></md-icon-button>
          <md-icon-button variant="outlined" icon="favorite"></md-icon-button>
          <md-icon-button variant="tonal" icon="favorite"></md-icon-button>
        </div>
      </section>

      {/* FABs */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>FABs</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <md-fab variant="primary" size="small" icon="add"></md-fab>
          <md-fab variant="primary" size="medium" icon="add"></md-fab>
          <md-fab variant="secondary" size="medium" icon="favorite"></md-fab>
          <md-fab variant="primary" size="extended" icon="add" label="Create"></md-fab>
        </div>
      </section>

      {/* Text Fields */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Text Fields</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ width: '240px' }}><md-text-field variant="filled" label="Filled"></md-text-field></div>
          <div style={{ width: '240px' }}><md-text-field variant="outlined" label="Outlined"></md-text-field></div>
          <div style={{ width: '240px' }}><md-text-field variant="filled" label="Error" error error-text="Required"></md-text-field></div>
          <div style={{ width: '240px' }}><md-text-field variant="filled" label="Disabled" disabled></md-text-field></div>
        </div>
      </section>

      {/* Select */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Select</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ width: '200px' }}>
            <md-select label="Color" variant="filled">
              <md-select-option value="red">Red</md-select-option>
              <md-select-option value="green">Green</md-select-option>
              <md-select-option value="blue">Blue</md-select-option>
            </md-select>
          </div>
          <div style={{ width: '200px' }}>
            <md-select label="Size" variant="outlined">
              <md-select-option value="s">Small</md-select-option>
              <md-select-option value="m">Medium</md-select-option>
              <md-select-option value="l">Large</md-select-option>
            </md-select>
          </div>
        </div>
      </section>

      {/* Checkboxes & Radio */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Checkboxes & Radio</h2>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <md-checkbox
              checked={checked}
              onMdChange={(e: CustomEvent) => setChecked(e.detail.checked)}
            ></md-checkbox>
            <span>Checkbox {checked ? '(checked)' : '(unchecked)'}</span>
          </div>
          <md-radio name="r" value="a"></md-radio>
          <md-radio name="r" value="b"></md-radio>
          <md-radio name="r" value="c" disabled></md-radio>
        </div>
      </section>

      {/* Switch */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Switch</h2>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <md-switch
            selected={switched}
            onMdChange={(e: CustomEvent) => setSwitched(e.detail)}
          ></md-switch>
          <span>{switched ? 'On' : 'Off'}</span>
          <md-switch selected icons></md-switch>
          <md-switch disabled></md-switch>
        </div>
      </section>

      {/* Chips */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Chips</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <md-chip variant="assist" label="Assist"></md-chip>
          <md-chip variant="filter" label="Filter"></md-chip>
          <md-chip variant="input" label="Input" removable></md-chip>
          <md-chip variant="suggestion" label="Suggestion"></md-chip>
          <md-chip variant="filter" label="Selected" selected></md-chip>
        </div>
      </section>

      {/* Dialog */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Dialog</h2>
        <md-button variant="outlined" onClick={() => setDialogOpen(true)}>Open Dialog</md-button>
        <md-dialog
          open={dialogOpen}
          headline="Confirm Action"
          onMdCancel={() => setDialogOpen(false)}
        >
          <p>Are you sure you want to proceed with this action?</p>
          <div slot="actions">
            <md-button variant="text" onClick={() => setDialogOpen(false)}>Cancel</md-button>
            <md-button variant="filled" onClick={() => setDialogOpen(false)}>Confirm</md-button>
          </div>
        </md-dialog>
      </section>

      {/* Snackbar */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Snackbar</h2>
        <md-button variant="outlined" onClick={() => { const s = document.querySelector('#snackbar') as any; s?.show(); }}>
          Show Snackbar
        </md-button>
        <md-snackbar id="snackbar" message="File saved successfully" action="Undo" auto-hide-duration="3000"></md-snackbar>
      </section>

      {/* Progress */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Progress Indicators</h2>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <md-progress-indicator variant="circular" value="75"></md-progress-indicator>
          <md-progress-indicator variant="circular" indeterminate></md-progress-indicator>
          <div style={{ width: '200px' }}>
            <md-progress-indicator variant="linear" value="60"></md-progress-indicator>
          </div>
          <div style={{ width: '200px' }}>
            <md-progress-indicator variant="linear" indeterminate></md-progress-indicator>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Cards</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {(['elevated', 'filled', 'outlined'] as const).map(v => (
            <md-card key={v} variant={v} style={{ width: '200px' }}>
              <div slot="header" style={{ padding: '16px 16px 0', fontWeight: 500, textTransform: 'capitalize' }}>{v}</div>
              <p style={{ padding: '16px', margin: 0, fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)' }}>Card content</p>
            </md-card>
          ))}
        </div>
      </section>

      {/* Navigation Bar */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Navigation Bar</h2>
        <div style={{ width: '400px' }}>
          <md-navigation-bar>
            <md-navigation-tab label="Home" icon="home" active></md-navigation-tab>
            <md-navigation-tab label="Search" icon="search"></md-navigation-tab>
            <md-navigation-tab label="Library" icon="library_music"></md-navigation-tab>
            <md-navigation-tab label="Profile" icon="person" badge badge-value="3"></md-navigation-tab>
          </md-navigation-bar>
        </div>
      </section>

      {/* Tabs */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Tabs</h2>
        <div style={{ width: '460px' }}>
          <md-tabs active-tab-index="1">
            <md-tab label="Overview" icon="dashboard"></md-tab>
            <md-tab label="Details" icon="info" active></md-tab>
            <md-tab label="Settings" icon="settings"></md-tab>
          </md-tabs>
        </div>
      </section>

      {/* Top App Bar */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>App Bar — Top</h2>
        <div style={{ border: '1px solid var(--md-sys-color-outline-variant)' }}>
          <md-app-bar title-alignment="center" headline="Inbox">
            <md-icon-button slot="leading" icon="menu"></md-icon-button>
            <md-icon-button slot="trailing" icon="search"></md-icon-button>
          </md-app-bar>
        </div>
      </section>

      {/* Date Picker */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Date Picker</h2>
        <div style={{ width: '260px' }}>
          <md-date-picker label="Meeting Date" value="2026-03-12"></md-date-picker>
        </div>
      </section>

      {/* List & Menu */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>List, Menu & Sub Menu Item</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ width: '320px' }}>
            <md-list>
              <md-list-item headline="Profile" supporting-text="Manage account" leading-icon="person"></md-list-item>
              <md-divider></md-divider>
              <md-list-item headline="Notifications" supporting-text="Push and email settings" trailing-icon="chevron_right"></md-list-item>
            </md-list>
          </div>
          <div>
            <md-button id="menu-anchor" variant="outlined" onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? 'Close Menu' : 'Open Menu'}
            </md-button>
            <md-menu anchor="menu-anchor" open={menuOpen} placement="bottom-start">
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

      {/* Badge & Tooltip */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Badge & Tooltip</h2>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <md-icon-button icon="mail"></md-icon-button>
            <md-badge value="14" max="99"></md-badge>
          </div>
          <md-tooltip content="This is a rich tooltip" headline="Tooltip title" variant="rich">
            <md-button variant="tonal">Hover target</md-button>
          </md-tooltip>
        </div>
      </section>

      {/* Navigation Rail */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Navigation Rail</h2>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', minHeight: '260px' }}>
          <md-navigation-rail alignment="top" has-fab>
            <md-fab slot="fab" icon="add" size="small"></md-fab>
            <md-navigation-rail-tab label="Home" icon="home" active></md-navigation-rail-tab>
            <md-navigation-rail-tab label="Search" icon="search"></md-navigation-rail-tab>
            <md-navigation-rail-tab label="Profile" icon="person" badge badge-value="2"></md-navigation-rail-tab>
          </md-navigation-rail>
        </div>
      </section>

      {/* Navigation Bar & Bottom Sheet */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px' }}>Navigation Bar & Bottom Sheet</h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <md-button variant="outlined" onClick={() => setBottomSheetOpen((v) => !v)}>
              {bottomSheetOpen ? 'Close Bottom Sheet' : 'Open Bottom Sheet'}
            </md-button>
          </div>
          <md-navigation-bar>
            <md-navigation-tab label="Home" icon="home" active></md-navigation-tab>
            <md-navigation-tab label="Search" icon="search"></md-navigation-tab>
            <md-navigation-tab label="Favorites" icon="favorite"></md-navigation-tab>
          </md-navigation-bar>
          <md-bottom-sheet open={bottomSheetOpen} onMdClose={() => setBottomSheetOpen(false)} variant="standard" headline="Quick actions">
            <md-list>
              <md-list-item headline="Share" leading-icon="share"></md-list-item>
              <md-list-item headline="Save" leading-icon="bookmark"></md-list-item>
            </md-list>
          </md-bottom-sheet>
        </div>
      </section>
    </div>
  );
}
