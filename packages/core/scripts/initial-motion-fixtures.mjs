const image = 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2740%27%20height=%2740%27%3E%3Crect%20width=%2740%27%20height=%2740%27%20fill=%27navy%27/%3E%3C/svg%3E';

export const interactionFixture = `
  <section>
    <md-button id="button-default">Default</md-button>
    <md-button id="button-filled" variant="filled">Filled</md-button>
    <md-button id="button-selected" toggle selected>Selected</md-button>
    <md-checkbox id="check" aria-label="Agree"></md-checkbox>
    <md-checkbox id="check-on" checked aria-label="Checked"></md-checkbox>
    <md-checkbox id="check-mixed" indeterminate aria-label="Mixed"></md-checkbox>
    <md-button-group variant="standard" aria-label="Sort options">
      <md-button id="group-first">Name</md-button><md-button>Date</md-button>
    </md-button-group>
  </section>
  <section>
    <md-list selection-mode="single-select" aria-label="Photos">
      <md-list-item id="list-selected" selected leading-image="${image}">Selected photo</md-list-item>
      <md-list-item>Another photo</md-list-item>
    </md-list>
    <md-table-toolbar id="toolbar-selected" num-selected="3"></md-table-toolbar>
    <md-skeleton id="skeleton-none" animation="none" width="100px" height="30px"></md-skeleton>
  </section>
`;

export const ambientFixture = `
  <section>
    <md-loading-indicator id="loading" label="Loading items"></md-loading-indicator>
    <md-progress-indicator id="progress-indeterminate" variant="circular" indeterminate></md-progress-indicator>
    <md-skeleton id="skeleton-pulse" animation="pulse" width="100px" height="18px"></md-skeleton>
    <md-skeleton id="skeleton-wave" animation="wave" width="100px" height="18px"></md-skeleton>
    <md-status-dot id="live" state="online" inline live label="Live"></md-status-dot>
  </section>
`;

export const externalSearchFixture = `
  <button id="overlay-anchor" type="button">Search contacts</button>
  <md-search id="external-search" layout="full-screen" trigger-for="#overlay-anchor" value="Ada">
    <p slot="results">Ada Lovelace</p>
  </md-search>
`;

export const openPickerFixtures = [
  {
    label: 'color popover',
    html: '<md-color-picker id="picker" variant="popover" open value="#426617"><button type="button" slot="trigger">Accent color</button></md-color-picker>',
    panel: '[part="popover"]',
    close: 'close',
    entrance: 'md-color-picker-pop-in',
  },
  ...['modal', 'modal-input', 'docked'].map((variant) => ({
    label: `date ${variant}`,
    html: `<md-date-picker id="picker" variant="${variant}" label="Due date" open value="2026-06-20"></md-date-picker>`,
    panel: '[part="panel"]',
    initialMode: '[part="calendar"]',
    close: 'close',
    entrance: variant === 'docked' ? 'md-date-picker-selection-bloom-in' : 'md-date-picker-scale',
    ...(variant === 'modal' && { modeToggle: '[part="mode-toggle"]', nextMode: '[part="entry-input"]' }),
  })),
  ...['dial', 'input'].map((variant) => ({
    label: `time ${variant}`,
    html: `<md-time-picker id="picker" variant="${variant}" label="Due time" open value="09:30"></md-time-picker>`,
    panel: '[part="dialog"]',
    initialMode: variant === 'dial' ? '[part="dial"]' : '[part="input-hour"]',
    close: 'hide',
    entrance: 'md-time-picker-dialog-in',
    modeToggle: '[part="toggle-mode"]',
    nextMode: variant === 'dial' ? '[part="input-hour"]' : '[part="dial"]',
    modeAnimation: 'md-time-picker-mode-in',
  })),
];

export const catalogFixture = `
  ${interactionFixture}
  ${ambientFixture}
  <section>
    <md-app-bar headline="Workspace"><md-icon-button slot="leading" icon="menu" aria-label="Menu"></md-icon-button></md-app-bar>
    <md-toolbar variant="floating"><md-icon-button icon="edit" aria-label="Edit"></md-icon-button></md-toolbar>
  </section>
  <section>
    <md-avatar initials="AL" label="Ada Lovelace"></md-avatar>
    <md-badge value="3"></md-badge>
    <md-card variant="filled"><h2>Project</h2><p>Project details</p></md-card>
    <md-chip variant="filter" selected>Assigned to me</md-chip>
    <md-divider></md-divider>
    <md-icon-button variant="filled" toggle selected icon="star" aria-label="Favourite"></md-icon-button>
    <md-meter value="72" label="CPU"></md-meter>
    <md-progress-indicator value="72" label="Download"></md-progress-indicator>
    <md-rating value="3" rating-label="Rating"></md-rating>
    <md-slider value="70" step="10" aria-label="Volume"></md-slider>
    <md-split-button label="Save" icon="save"><md-menu-item slot="menu" headline="Save copy"></md-menu-item></md-split-button>
    <button type="button" style="position:relative">Ripple target<md-ripple></md-ripple></button>
  </section>
  <section>
    <md-accordion default-expanded="0">
      <md-accordion-item id="details" headline="Details" expanded><p>Project details</p></md-accordion-item>
      <md-accordion-item id="history" headline="History"><p>Recent changes</p></md-accordion-item>
    </md-accordion>
    <md-breadcrumbs max-items="3">
      <md-breadcrumb-item href="#root">Home</md-breadcrumb-item>
      <md-breadcrumb-item href="#team">Team</md-breadcrumb-item>
      <md-breadcrumb-item href="#work">Work</md-breadcrumb-item>
      <md-breadcrumb-item current>Project</md-breadcrumb-item>
    </md-breadcrumbs>
    <md-stepper active="1" orientation="vertical">
      <md-step label="Pick a project" completed><p>Choose a project.</p></md-step>
      <md-step label="Review" error error-text="Missing document"><p>Review details.</p></md-step>
    </md-stepper>
    <md-navigation-bar active-index="1">
      <md-navigation-tab label="Home" icon="home"></md-navigation-tab>
      <md-navigation-tab label="Files" icon="folder"></md-navigation-tab>
    </md-navigation-bar>
    <md-navigation-rail active-index="1">
      <md-navigation-rail-tab label="Home" icon="home" value="home"></md-navigation-rail-tab>
      <md-navigation-rail-tab label="Files" icon="folder" value="files"></md-navigation-rail-tab>
    </md-navigation-rail>
    <md-segmented-button-set aria-label="File view">
      <md-segmented-button value="list" selected>List</md-segmented-button>
      <md-segmented-button value="grid">Grid</md-segmented-button>
    </md-segmented-button-set>
    <md-tabs id="workspace-tabs" active-tab-index="1" aria-label="Project views">
      <md-tab label="Overview"></md-tab><md-tab label="Activity"></md-tab>
    </md-tabs>
    <md-tab-panels for="workspace-tabs" sizing="active">
      <md-tab-panel>Overview details</md-tab-panel><md-tab-panel>Activity details</md-tab-panel>
    </md-tab-panels>
  </section>
  <section>
    <md-text-field label="Name" value="Ada" error error-text="Name is reserved"></md-text-field>
    <md-number-field label="Quantity" value="6" min="1" max="10"></md-number-field>
    <md-otp-field label="Code" value="123456"></md-otp-field>
    <md-radio name="period" value="week" checked aria-label="Week"></md-radio>
    <md-radio name="period" value="month" aria-label="Month"></md-radio>
    <md-switch selected aria-label="Notifications"></md-switch>
    <md-select value="de" label="Country">
      <md-select-option value="fr">France</md-select-option><md-select-option value="de">Germany</md-select-option>
    </md-select>
    <md-multi-select label="Countries">
      <md-select-option value="fr">France</md-select-option><md-select-option value="de">Germany</md-select-option>
    </md-multi-select>
    <md-autocomplete label="Search contacts" value="Ada"></md-autocomplete>
    <md-color-picker aria-label="Accent colour" value="#426617"></md-color-picker>
    <md-date-picker label="Due date" value="2026-06-20"></md-date-picker>
    <md-time-picker label="Due time" value="09:30"></md-time-picker>
    <md-transfer-list source-title="Available" target-title="Selected" items='[{"value":"one","label":"First choice"}]'></md-transfer-list>
  </section>
  <section>
    <button id="menu-anchor" type="button">Options</button>
    <md-menu anchor="menu-anchor" variant="standard" layout="grouped">
      <md-menu-item-group label="Sort by">
        <md-menu-item type="radio" headline="Name" selected></md-menu-item>
        <md-menu-item type="radio" headline="Date"></md-menu-item>
      </md-menu-item-group>
      <md-sub-menu-item headline="More actions">
        <md-menu slot="submenu"><md-menu-item headline="Archive"></md-menu-item></md-menu>
      </md-sub-menu-item>
    </md-menu>
    <md-fab id="create-fab" icon="add" aria-label="Create"></md-fab>
    <md-fab-menu anchor="create-fab" menu-label="Create">
      <md-fab-menu-item icon="description" label="Document"></md-fab-menu-item>
    </md-fab-menu>
    <md-bottom-sheet headline="Files"><p>New files</p></md-bottom-sheet>
    <md-dialog headline="Save project"><p>Save changes?</p><button slot="actions" type="button">Save</button></md-dialog>
    ${externalSearchFixture}
    <md-side-sheet headline="Filters"><p>Labels</p></md-side-sheet>
    <md-snackbar message="Changes saved"></md-snackbar>
    <md-tooltip text="Help with the project"><md-icon-button icon="help" aria-label="Help"></md-icon-button></md-tooltip>
  </section>
  <section>
    <md-table-container style="width: min(680px, 100%)">
      <md-table label="Invoices" column-template="80px 2fr 1fr">
        <md-table-head>
          <md-table-row>
            <md-table-cell head scope="col">Details</md-table-cell>
            <md-table-cell head scope="col"><md-table-sort-label active order="desc">Project</md-table-sort-label></md-table-cell>
            <md-table-cell head scope="col">Total</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row expandable expanded selected value="invoice">
            <md-table-cell><md-table-expand-toggle></md-table-expand-toggle></md-table-cell>
            <md-table-cell>Project</md-table-cell>
            <md-table-cell>$38</md-table-cell>
            <p slot="expanded">Invoice details</p>
          </md-table-row>
        </md-table-body>
        <md-table-foot><md-table-row><md-table-cell>Total</md-table-cell><md-table-cell></md-table-cell><md-table-cell>$38</md-table-cell></md-table-row></md-table-foot>
      </md-table>
    </md-table-container>
    <md-table-pagination count="30" page="1"></md-table-pagination>
  </section>
  <section>
    <md-area-chart style="width:300px;height:180px" label="Area chart"></md-area-chart>
    <md-bar-chart style="width:300px;height:180px" label="Bar chart"></md-bar-chart>
    <md-line-chart style="width:300px;height:180px" label="Line chart"></md-line-chart>
    <md-pie-chart style="width:300px;height:180px" label="Pie chart"></md-pie-chart>
    <md-sparkline style="width:180px" height="80px"></md-sparkline>
    <md-organization-chart nodes='[{"id":"lead","name":"Ada Lovelace","children":[{"id":"eng","name":"Grace Hopper"}]}]'></md-organization-chart>
  </section>
`;

export function fixtureTags(html) {
  return [...new Set(Array.from(html.matchAll(/<(md-[a-z0-9-]+)\b/g), ([, tag]) => tag))].sort();
}
