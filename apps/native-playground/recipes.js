// Every source tag gets a working web reference. Structural tags are shown in
// their required parent context; overlays open only after an explicit click.
export const categoryOrder = ['Actions', 'Inputs', 'Navigation', 'Containers', 'Data display', 'Feedback', 'Charts', 'Tables'];
export function categoryFor(tag) {
  if (/table/.test(tag)) return 'Tables';
  if (/chart|sparkline/.test(tag)) return 'Charts';
  if (/button|fab|chip|ripple/.test(tag)) return 'Actions';
  if (/field|select|autocomplete|checkbox|radio|switch|slider|rating|picker|transfer/.test(tag)) return 'Inputs';
  if (/navigation|breadcrumb|tab|app-bar|search|step|toolbar/.test(tag)) return 'Navigation';
  if (/dialog|sheet|card|accordion|menu|list$|list-item/.test(tag)) return 'Containers';
  if (/progress|loading|snackbar|skeleton|tooltip/.test(tag)) return 'Feedback';
  return 'Data display';
}
export const icons = { Actions: '◈', Inputs: '⊞', Navigation: '↗', Containers: '▤', 'Data display': '◉', Feedback: '◌', Charts: '▥', Tables: '▦' };
export const displayName = tag => tag.replace(/^md-/, '').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const options = [{ value: 'design', label: 'Design systems' }, { value: 'mobile', label: 'Mobile apps' }, { value: 'platform', label: 'Platform engineering' }];
const tableMarkup = `<md-table-container variant="outlined"><md-table-toolbar headline="Platform releases" supporting-text="One shared component contract"></md-table-toolbar><md-table columns="3" label="Platform releases" column-template="2fr 1fr 1fr"><md-table-head><md-table-row><md-table-cell><md-table-sort-label column="platform">Platform</md-table-sort-label></md-table-cell><md-table-cell>Framework</md-table-cell><md-table-cell>Status</md-table-cell></md-table-row></md-table-head><md-table-body><md-table-row><md-table-cell>Apple platforms</md-table-cell><md-table-cell>SwiftUI</md-table-cell><md-table-cell>Generated</md-table-cell></md-table-row><md-table-row expandable><div slot="expanded" style="padding:16px">Android builds include native Compose components and shared design tokens.</div><md-table-cell><md-table-expand-toggle></md-table-expand-toggle> Android</md-table-cell><md-table-cell>Compose</md-table-cell><md-table-cell>Generated</md-table-cell></md-table-row></md-table-body><md-table-foot><md-table-row><md-table-cell>2 targets</md-table-cell><md-table-cell>1 contract</md-table-cell><md-table-cell>AWC UI</md-table-cell></md-table-row></md-table-foot></md-table><md-table-pagination count="2" rows-per-page="5"></md-table-pagination></md-table-container>`;
const tabsMarkup = `<div style="width:100%"><md-tabs id="reference-tabs" aria-label="Workspace sections"><md-tab label="Overview"></md-tab><md-tab label="Activity"></md-tab><md-tab label="Settings"></md-tab></md-tabs><md-tab-panels for="reference-tabs"><md-tab-panel active><p class="support-copy">Your workspace, across every platform.</p></md-tab-panel><md-tab-panel><p class="support-copy">Recent activity will appear here.</p></md-tab-panel><md-tab-panel><p class="support-copy">Make this workspace your own.</p></md-tab-panel></md-tab-panels></div>`;
const stepperMarkup = `<md-stepper><md-step label="Details" description="Your workspace"><p class="support-copy">Create a shared design system.</p></md-step><md-step label="Platforms" description="Choose targets"><p class="support-copy">Generate SwiftUI and Compose.</p></md-step><md-step label="Review" description="Ready to build"><p class="support-copy">Run each native playground.</p></md-step></md-stepper>`;
const accordionMarkup = `<md-accordion><md-accordion-item headline="A shared design language" supporting-text="Built for every surface" expanded><p class="support-copy">Colors, spacing, shapes, and component contracts come from the same AWC source.</p></md-accordion-item><md-accordion-item headline="Native by design" supporting-text="Platform-specific implementations"><p class="support-copy">Native views retain each platform's own controls and behavior.</p></md-accordion-item></md-accordion>`;
const listMarkup = `<md-list selection-mode="single-select"><md-list-item headline="Design systems" supporting-text="Tokens and shared primitives" leading-icon="palette" lines="2"></md-list-item><md-list-item headline="Mobile apps" supporting-text="SwiftUI and Jetpack Compose" leading-icon="devices" lines="2"></md-list-item><md-list-item headline="Platform engineering" supporting-text="Build once, inspect everywhere" leading-icon="terminal" lines="2"></md-list-item></md-list>`;
const railMarkup = `<md-navigation-rail><md-navigation-rail-tab icon="home" label="Home" active></md-navigation-rail-tab><md-navigation-rail-tab icon="favorite" label="Saved"></md-navigation-rail-tab><md-navigation-rail-tab icon="settings" label="Settings"></md-navigation-rail-tab></md-navigation-rail>`;
const navMarkup = `<md-navigation-bar><md-navigation-tab icon="home" label="Home"></md-navigation-tab><md-navigation-tab icon="explore" label="Explore"></md-navigation-tab><md-navigation-tab icon="bookmark" label="Saved"></md-navigation-tab></md-navigation-bar>`;
const segmentMarkup = `<md-segmented-button-set><md-segmented-button label="Day" value="day" selected></md-segmented-button><md-segmented-button label="Week" value="week"></md-segmented-button><md-segmented-button label="Month" value="month"></md-segmented-button></md-segmented-button-set>`;
const menuMarkup = `<md-menu id="demo-menu" anchor="demo-menu-trigger"><md-menu-item-group label="Workspace"><md-menu-item headline="New project" supporting-text="Start something new"></md-menu-item><md-menu-item headline="Duplicate" trailing-text="⌘D"></md-menu-item><md-sub-menu-item headline="Export"><md-menu slot="submenu"><md-menu-item headline="SwiftUI"></md-menu-item><md-menu-item headline="Compose"></md-menu-item></md-menu></md-sub-menu-item></md-menu-item-group></md-menu>`;

export function recipeFor(tag) {
  let html = '', props = {}, mode = '', note = 'Interactive reference', setup = null, text;
  const bare = tag.slice(3);
  if (tag.startsWith('md-table')) {
    html = tableMarkup; mode = 'wide'; note = tag === 'md-table' ? 'Composed table reference' : 'Shown inside its table context';
    if (tag === 'md-table') props = { selection: 'multiple' };
    if (tag === 'md-table-pagination') props = { rowsPerPage: 1 };
    // The selected row must be a body row. The first row in the full table is
    // a header, where selection and expanded-detail controls do not apply.
    if (tag === 'md-table-row') {
      html = '<md-table columns="2" label="Platform details" selection="multiple"><md-table-body><md-table-row value="android"><md-table-cell><md-table-expand-toggle></md-table-expand-toggle> Android</md-table-cell><md-table-cell>Jetpack Compose</md-table-cell><div slot="expanded" style="padding:16px">Native Compose components use shared design tokens.</div></md-table-row></md-table-body></md-table>';
      props = { expandable: true, clickable: true };
    }
  }
  else if (['md-tabs', 'md-tab', 'md-tab-panel', 'md-tab-panels'].includes(tag)) { html = tabsMarkup; mode = 'wide'; note = 'Composed tabs reference'; }
  else if (['md-step', 'md-stepper'].includes(tag)) { html = stepperMarkup; mode = 'wide'; }
  else if (tag.startsWith('md-accordion')) { html = accordionMarkup; mode = 'wide'; }
  else if (['md-list', 'md-list-item'].includes(tag)) { html = listMarkup; mode = 'wide'; }
  else if (tag.startsWith('md-navigation-rail')) { html = railMarkup; }
  else if (['md-navigation-bar', 'md-navigation-tab'].includes(tag)) { html = navMarkup; mode = 'wide'; }
  else if (tag.startsWith('md-segmented-button')) { html = segmentMarkup; }
  else if (tag.startsWith('md-breadcrumb')) { html = '<md-breadcrumbs><md-breadcrumb-item>Workspace</md-breadcrumb-item><md-breadcrumb-item>Components</md-breadcrumb-item><md-breadcrumb-item current>Button</md-breadcrumb-item></md-breadcrumbs>'; }
  else if (['md-menu', 'md-menu-item', 'md-menu-item-group', 'md-sub-menu-item'].includes(tag)) {
    html = `<div class="overlay-launch" style="min-height:270px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;padding-top:12px"><md-button id="demo-menu-trigger" variant="tonal" data-awc-action="toggle" data-awc-target="demo-menu">Open menu</md-button><p class="reference-note">This component is presented in its menu context.</p>${menuMarkup}</div>`;
    note = 'Open to inspect the menu';
  } else if (tag.startsWith('md-fab-menu')) {
    html = '<div class="overlay-launch" style="min-height:270px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;padding-top:12px"><md-fab id="demo-fab-anchor" icon="add" label="Create"></md-fab><md-fab-menu id="demo-fab-menu" anchor="demo-fab-anchor" placement="down"><md-fab-menu-item icon="edit" label="New document"></md-fab-menu-item icon="folder" label="New folder"></md-fab-menu-item icon="photo" label="Upload image"></md-fab-menu-item></md-fab-menu></div>';
    note = 'Open to inspect actions';
  } else {
    switch (tag) {
      case 'md-button': text = 'Continue'; html = `<md-button>${text}</md-button>`; props = { variant: 'filled', size: 'md' }; break;
      case 'md-button-group': html = '<md-button-group><md-button value="day" selected>Day</md-button><md-button value="week">Week</md-button><md-button value="month">Month</md-button></md-button-group>'; break;
      case 'md-icon-button': html = '<md-icon-button aria-label="Save to favorites"></md-icon-button>'; props = { icon: 'favorite', variant: 'tonal', toggle: true, size: 'lg' }; break;
      case 'md-fab': html = '<md-fab></md-fab>'; props = { icon: 'add', label: 'Create', extended: true }; break;
      case 'md-split-button': html = '<md-split-button></md-split-button>'; props = { label: 'Create project', icon: 'add', size: 'md' }; break;
      case 'md-chip': html = '<md-chip></md-chip>'; props = { label: 'Design systems', variant: 'filter', icon: 'palette' }; break;
      case 'md-card': html = '<md-card><div class="card-content" style="padding:24px;display:grid;gap:12px"><div class="card-symbol">✧</div><h3>Ideas take shape.</h3><p>A shared design language, built for every surface.</p><md-button variant="text">Explore workspace</md-button></div></md-card>'; break;
      case 'md-avatar': html = '<md-avatar></md-avatar>'; props = { name: 'Alex Morgan', size: 'large' }; break;
      case 'md-badge': html = '<div style="position:relative"><md-icon-button icon="notifications" size="lg" aria-label="Notifications"></md-icon-button><md-badge style="position:absolute;top:-4px;right:-5px"></md-badge></div>'; props = { value: '8' }; break;
      case 'md-status-dot': html = '<md-status-dot></md-status-dot>'; props = { state: 'online', label: 'All systems operational', inline: true }; break;
      case 'md-checkbox': html = '<label style="display:flex;align-items:center;gap:12px"><md-checkbox></md-checkbox><span>Keep me updated</span></label>'; props = { checked: true }; break;
      case 'md-switch': html = '<div style="display:flex;align-items:center;gap:18px"><span class="demo-label">Enable notifications</span><md-switch aria-label="Enable notifications"></md-switch></div>'; props = { selected: true, icons: true }; break;
      case 'md-radio': html = '<fieldset style="border:0;display:grid;gap:12px"><legend>Workspace access</legend><label style="display:flex;align-items:center;gap:12px"><md-radio name="demo-choice" value="shared"></md-radio><span>Shared workspace</span></label><label style="display:flex;align-items:center;gap:12px"><md-radio name="demo-choice" value="private"></md-radio><span>Private workspace</span></label></fieldset>'; props = { checked: true }; break;
      case 'md-text-field': html = '<md-text-field></md-text-field>'; props = { label: 'Workspace name', value: 'AWC Studio', supportingText: 'Make room for your next idea.', variant: 'outlined' }; break;
      case 'md-number-field': html = '<md-number-field></md-number-field>'; props = { label: 'Team members', value: 8, min: 1, max: 100, variant: 'outlined' }; break;
      case 'md-otp-field': html = '<md-otp-field></md-otp-field>'; props = { label: 'Verification code', value: '248', supportingText: 'Enter the 6-digit code.' }; break;
      case 'md-select': case 'md-autocomplete': case 'md-multi-select': html = `<${tag}></${tag}>`; props = { label: 'Team', options, supportingText: 'Choose your workspace team.', variant: 'outlined', value: tag === 'md-multi-select' ? ['design'] : 'design' }; break;
      case 'md-select-option': html = '<md-select label="Team" variant="outlined"><md-select-option value="design" label="Design systems"></md-select-option><md-select-option value="mobile" label="Mobile apps"></md-select-option></md-select>'; note = 'Open the select to inspect its option'; break;
      case 'md-slider': html = '<md-slider></md-slider>'; props = { value: 65, labeled: true, sliderAriaLabel: 'Intensity', size: 'md' }; break;
      case 'md-rating': html = '<md-rating></md-rating>'; props = { value: 4, showValueLabel: true, size: 'lg' }; break;
      case 'md-date-picker': html = '<md-date-picker></md-date-picker>'; props = { value: '2026-10-07', label: 'Start date', variant: 'docked' }; break;
      case 'md-time-picker': html = '<md-time-picker></md-time-picker>'; props = { value: '09:30', label: 'Meeting time', variant: 'input' }; break;
      case 'md-color-picker': html = '<md-color-picker></md-color-picker>'; props = { value: '#08796C', presets: ['#08796C', '#6750A4', '#B45F40', '#466785'] }; break;
      case 'md-divider': html = '<div style="width:100%;max-width:300px"><p class="support-copy">A little space to think.</p><md-divider></md-divider><p class="support-copy">A clear separation of ideas.</p></div>'; break;
      case 'md-progress-indicator': html = '<md-progress-indicator></md-progress-indicator>'; props = { value: 64, wave: true, label: 'Building native components' }; break;
      case 'md-loading-indicator': html = '<md-loading-indicator></md-loading-indicator>'; props = { variant: 'contained' }; break;
      case 'md-meter': html = '<md-meter></md-meter>'; props = { value: 72, showLabel: true, showValue: true, label: 'Storage used' }; break;
      case 'md-skeleton': html = '<div style="width:260px"><md-skeleton></md-skeleton></div>'; props = { lines: 3, animation: 'wave', fullWidth: true }; break;
      case 'md-ripple': html = '<button type="button" class="inline-ripple" style="position:relative;overflow:hidden;padding:16px 24px;border-radius:16px">Tap to see the ripple<md-ripple></md-ripple></button>'; note = 'Interaction primitive inside a button'; break;
      case 'md-tooltip': html = '<md-tooltip><md-button variant="tonal">Hover or focus me</md-button></md-tooltip>'; props = { text: 'One source. Every surface.' }; break;
      case 'md-app-bar': html = '<md-app-bar><md-icon-button slot="trailing" icon="search" aria-label="Search"></md-icon-button></md-app-bar>'; props = { headline: 'Your workspace', leadingIcon: 'menu', leadingIconLabel: 'Open navigation' }; mode = 'wide'; break;
      case 'md-toolbar': html = '<md-toolbar><md-icon-button icon="undo" aria-label="Undo"></md-icon-button><md-icon-button icon="redo" aria-label="Redo"></md-icon-button><md-divider vertical></md-divider><md-icon-button icon="format_bold" aria-label="Bold" toggle></md-icon-button><md-icon-button icon="format_italic" aria-label="Italic" toggle></md-icon-button></md-toolbar>'; props = { variant: 'floating', ariaLabelProp: 'Formatting' }; break;
      case 'md-search': html = '<md-search><md-list slot="results"><md-list-item headline="Design tokens" supporting-text="Shared foundations"></md-list-item><md-list-item headline="Native components" supporting-text="SwiftUI and Compose"></md-list-item></md-list></md-search>'; props = { layout: 'docked', placeholder: 'Search your workspace' }; break;
      case 'md-dialog': case 'md-bottom-sheet': case 'md-side-sheet': case 'md-snackbar': {
        const overlay = tag === 'md-snackbar' ? `<md-snackbar id="demo-overlay" message="Your changes are saved" action="Undo" closeable></md-snackbar>` : `<${tag} id="demo-overlay" headline="Make room for your next idea"${tag === 'md-dialog' ? '' : ' closeable'}><p class="support-copy" style="padding:8px 20px">Every great project starts with a shared workspace.</p><md-button slot="actions" data-awc-action="close" data-awc-target="demo-overlay">Got it</md-button></${tag}>`;
        html = `<div class="overlay-launch"><md-button data-awc-action="open" data-awc-target="demo-overlay" variant="tonal">Open ${bare.replaceAll('-', ' ')}</md-button><p class="reference-note">Open the component to explore its behavior.</p>${overlay}</div>`;
        note = 'Click to open the overlay'; break;
      }
      case 'md-bar-chart': case 'md-area-chart': case 'md-line-chart':
        html = `<${tag}></${tag}>`; props = { label: 'Weekly activity', subtitle: 'Workspace interactions', series: [{ label: 'This week', data: [18, 28, 23, 42, 36, 52, 46] }, { label: 'Last week', data: [12, 18, 16, 25, 29, 36, 33], color: 'tertiary' }], xAxis: { data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }, heightProp: '260px', noAnimation: true }; mode = 'wide'; break;
      case 'md-pie-chart': html = '<md-pie-chart></md-pie-chart>'; props = { label: 'Platform distribution', data: [{ label: 'Web', value: 45 }, { label: 'iOS', value: 30 }, { label: 'Android', value: 25 }], innerRadius: '55%', heightProp: '260px', noAnimation: true }; mode = 'wide'; break;
      case 'md-sparkline': html = '<md-sparkline></md-sparkline>'; props = { data: [12, 18, 15, 28, 24, 34, 31, 42, 37, 48], variant: 'area', heightProp: '90px', noAnimation: true }; break;
      case 'md-organization-chart': html = '<md-organization-chart></md-organization-chart>'; props = { nodes: [{ id: 'studio', name: 'AWC Studio', title: 'Design systems', children: [{ id: 'ios', name: 'iOS', title: 'SwiftUI' }, { id: 'android', name: 'Android', title: 'Compose' }] }], selectionMode: 'single' }; mode = 'wide'; break;
      case 'md-transfer-list': html = '<md-transfer-list></md-transfer-list>'; props = { items: options, value: ['design'], sourceTitle: 'Available teams', targetTitle: 'Your teams', searchable: false }; mode = 'wide'; break;
      default: html = `<${tag}>${displayName(tag)}</${tag}>`; note = 'Source component reference';
    }
  }
  const editableContent = {
    'md-button': ['Continue', 'Button label'],
    'md-breadcrumb-item': ['Workspace', 'Breadcrumb label'],
    'md-accordion-item': ['Colors, spacing, shapes, and component contracts come from the same AWC source.', 'Panel content'],
    'md-tab-panel': ['Your workspace, across every platform.', 'Panel content'],
    'md-step': ['Create a shared design system.', 'Step content'],
    'md-table-sort-label': ['Platform', 'Column label'],
  };
  const content = editableContent[tag];
  if (content) text = content[0];
  if (html.includes('data-awc-action=')) setup = setupRecipeActions;
  if (tag === 'md-table-pagination') note = 'Two sample rows. Page events let your application load another page.';
  return { html, props, mode, note, setup, text, textLabel: content?.[1], textDescription: content ? 'Plain text in the selected component’s default slot. Updates the preview and usage examples.' : undefined };
}

/** The same declarative actions are emitted by the framework snippet builder. */
export function setupRecipeActions(root) {
  for (const trigger of root.querySelectorAll('[data-awc-action]')) {
    const id = trigger.getAttribute('data-awc-target');
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id || '')) continue;
    const target = root.querySelector(`#${id}`);
    if (!target) continue;
    trigger.addEventListener('click', () => {
      const action = trigger.getAttribute('data-awc-action');
      if (action === 'open') target.open = true;
      else if (action === 'close') target.open = false;
      else if (action === 'toggle') target.open = !target.open;
    });
  }
}
