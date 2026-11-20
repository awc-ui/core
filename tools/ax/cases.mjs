// Accessibility cases per component: Laboratory requests (tag + properties/slots/direction) covering names, roles,
// states, values, disabled vs soft-disabled and live regions. `tabs`: Tab presses for the focus-order walk. `inactive`: the case
// renders an inactive component whose text is exempt from text contrast (WCAG 1.4.3) although no element reports it disabled.
// macOS renders the Laboratory request and returns its effective node; Web and iOS render that exact node;
// Android renders the same Laboratory request through its own live host.
const lab = (id, properties = {}, extra = {}) => ({ id, properties, ...extra });
const AC_FRUIT = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Apricot' }, { value: 'c', label: 'Avocado', disabled: true }, { value: 'd', label: 'Banana' }];
const named = (label, more = {}) => ({ 'aria-label': label, ...more });
// Charts (2026-10-29): the dedicated chart renderers on all three native platforms; data pinned per case.
const CHART_SERIES = [{ label: 'Revenue', data: [12, 18, 15, 22, 28, 26] }, { label: 'Cost', data: [8, 11, 10, 14, 16, 18] }];
const CHART_X = { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] };
const CHART_PIE = [{ label: 'Search', value: 42 }, { label: 'Direct', value: 26 }, { label: 'Social', value: 18 }];
const chartCase = (more = {}) => ({ label: 'Monthly revenue', series: CHART_SERIES, xAxis: CHART_X, noAnimation: true, ...more });
// md-organization-chart (fx, 2026-10-30): a WAI-ARIA tree (roving tab stop, levels, folds, selection).
const OC_NODES = [{ id: 'lead', name: 'Alex Morgan', title: 'Product lead', children: [{ id: 'design', name: 'Sam Lee', title: 'Design' },
  { id: 'eng', name: 'Robin Chen', title: 'Engineering', children: [{ id: 'dev', name: 'Casey Diaz', title: 'Developer' }] }, { id: 'ops', name: 'Finley Ross', title: 'Operations', selectable: false }] }];
const ocCase = (more = {}) => ({ nodes: OC_NODES, label: 'Product team', selectionMode: 'single', selectedIds: ['design'], ...more });
const TL_ITEMS = [{ value: 'a', label: 'Analytics', description: 'Dashboards' }, { value: 'b', label: 'Billing' }, { value: 'c', label: 'Calendar' }, { value: 'd', label: 'Directory', disabled: true }];
export const CASES = {
  // n5 navigation (2026-10-30): the Laboratory recipe (a floating Formatting toolbar: undo, redo, divider, bold, italic).
  // n5 navigation rail (2026-10-31): the Laboratory recipe (Home active, Saved, Settings).
  // n5 app bar (2026-11-05): the Laboratory recipe (Your workspace, the menu leading icon, a trailing Search action).
  'md-app-bar': [lab('default', {}, { tabs: 2 }), lab('center', { titleAlignment: 'center', subtitle: '12 unread' }, { tabs: 2 }),
    lab('medium', { variant: 'medium', subtitle: '12 unread' }, { tabs: 2 }), lab('search', { variant: 'search', searchPlaceholder: 'Search mail' }, { tabs: 3 })],
  'md-navigation-rail': [lab('default', { activeIndex: 0 }, { tabs: 1 }), lab('expanded', { variant: 'expanded', expandable: true, activeIndex: 0 }, { tabs: 2 }),
    lab('horizontal', { orientation: 'horizontal', activeIndex: 0 }, { tabs: 1 }), lab('labels-none', { labelVisibility: 'none', activeIndex: 0 }, { tabs: 1 })],
  'md-toolbar': [lab('default', { variant: 'floating', ariaLabelProp: 'Formatting' }, { tabs: 3 }), lab('docked', { variant: 'docked', ariaLabelProp: 'Formatting' }, { tabs: 2 }),
    lab('vertical', { variant: 'floating', layout: 'vertical', ariaLabelProp: 'Formatting' }, { tabs: 2 }), lab('generic', { variant: 'floating', containerSemantics: 'generic' }, { tabs: 3 })],
  // fa (2026-10-30): the dedicated md-stepper / md-step renderers on all three native platforms.
  'md-stepper': [lab('horizontal', {}, { tabs: 6, settle: 2 }), lab('vertical', { orientation: 'vertical' }, { tabs: 6, settle: 2 }),
    lab('dot-nonlinear', { indicator: 'dot', mode: 'non-linear' }, { tabs: 6, settle: 2 }), lab('mobile', { variant: 'mobile' }, { tabs: 3, settle: 2 }),
    lab('readonly', { readonly: true }, { tabs: 3, settle: 2 })],
  'md-step': [lab('standalone', {}, { tabs: 2 })],
  // fa (2026-10-29): the dedicated md-slider / md-rating renderers on all three native platforms.
  'md-slider': [lab('default', { value: 30, sliderAriaLabel: 'Volume' }, { tabs: 2 }),
    lab('range', { range: true, valueStart: 20, valueEnd: 60, ariaLabelStart: 'Minimum price', ariaLabelEnd: 'Maximum price' }, { tabs: 3 }),
    lab('valuetext', { min: 0, max: 5, step: 1, stops: true, value: 3, sliderAriaLabel: 'Brightness', valueText: 'Level 3 of 5' }),
    lab('vertical', { value: 40, orientation: 'vertical', sliderAriaLabel: 'Volume' }),
    lab('disabled', { value: 30, sliderAriaLabel: 'Volume', disabled: true }, { tabs: 2 })],
  'md-rating': [lab('default', { value: 3, ratingLabel: 'Rating' }, { tabs: 2 }), lab('half', { value: 3.5, precision: 0.5, ratingLabel: 'Rating' }),
    lab('readonly', { value: 4, readonly: true, ratingLabel: 'Average rating' }, { tabs: 2 }), lab('disabled', { value: 2, disabled: true, ratingLabel: 'Rating' }, { tabs: 2 }),
    lab('soft-disabled', { value: 2, softDisabled: true, ratingLabel: 'Rating' }, { tabs: 2 })],
  // n4 (2026-10-30): the md-table family on all three native platforms (the shared example table of AWCExamples).
  'md-table': [lab('multiple', {}, { tabs: 6 }), lab('sorted', { sortBy: 'name', sortOrder: 'desc' }, { tabs: 3 }), lab('loading', { loading: true }), lab('rowspan', {}, { rowSpanFixture: true })],
  'md-table-container': [lab('outlined', { variant: 'outlined' }, { tabs: 4 })],
  'md-table-row': [lab('expandable', {}, { tabs: 2 }), lab('selected', { selected: true })],
  'md-table-cell': [lab('cell')], 'md-table-head': [lab('head', {}, { tabs: 2 })], 'md-table-body': [lab('body', {}, { tabs: 3 })], 'md-table-foot': [lab('foot')],
  'md-table-toolbar': [lab('default', {}, { tabs: 2 }), lab('selection', { numSelected: 2 }, { tabs: 2 })],
  'md-table-sort-label': [lab('inactive', {}, { tabs: 2 }), lab('active-desc', { active: true, order: 'desc' }, { tabs: 2 })],
  'md-table-pagination': [lab('default', {}, { tabs: 6 }), lab('disabled', { disabled: true }, { tabs: 2 })],
  'md-table-expand-toggle': [lab('default', {}, { tabs: 2 })],
  // n2: the menu recipe (AWCPreviewMenu / LivePreviewMenuHost): the tonal trigger anchoring the menu, closed and open
  // (Workspace group, a two-line row, a trailing-text row and the Export submenu row).
  // open: the menu takes focus to its first row (auto-focus, as on the Web, where the capture then moves focus back to
  // the guard before tabbing; the native hosts keep the row focused), so its Tab order is read with auto-focus off.
  'md-menu': [lab('closed', {}, { tabs: 2 }), lab('open', { open: true }), lab('open-no-autofocus', { open: true, autoFocus: false }, { tabs: 3 })],
  'md-line-chart': [lab('default', chartCase(), { tabs: 2 }), lab('loading', chartCase({ loading: true })), lab('empty', chartCase({ series: [] }))],
  'md-area-chart': [lab('default', chartCase(), { tabs: 2 })],
  'md-bar-chart': [lab('default', chartCase(), { tabs: 2 }), lab('horizontal', chartCase({ layout: 'horizontal' }), { tabs: 2 })],
  'md-pie-chart': [lab('default', { label: 'Traffic sources', data: CHART_PIE, noAnimation: true }, { tabs: 2 }),
    lab('donut', { label: 'Traffic sources', data: CHART_PIE, innerRadius: '60%', noAnimation: true })],
  'md-sparkline': [lab('default', { data: [3, 5, 4, 7, 6, 9, 8], noAnimation: true })],
  // md-transfer-list (n1, 2026-11-12): two multiselectable listboxes (options with selected/disabled), select-all checkboxes,
  // search fields, the movers (named, disabled when they cannot move), the disabled list (its listboxes stay Tab stops) and the
  // empty state's status (announced when a side runs empty: `emptied` moves every item to the target).
  'md-transfer-list': [lab('default', { items: TL_ITEMS, value: ['c'] }, { tabs: 7 }), lab('not-searchable', { items: TL_ITEMS, value: ['c'], searchable: false }, { tabs: 5 }),
    lab('single-step', { items: TL_ITEMS, value: ['c'], singleStepOnly: true }, { tabs: 7 }), lab('disabled', { items: TL_ITEMS, value: ['c'], disabled: true }, { tabs: 3, inactive: true }),
    lab('empty-target', { items: TL_ITEMS, value: [] }, { tabs: 6 }), lab('emptied', { items: TL_ITEMS, value: [] }, { update: { value: ['a', 'b', 'c', 'd'] } })],
  'md-button': [lab('default', {}, { tabs: 2 }), lab('disabled', { disabled: true }, { tabs: 2 }), lab('soft-disabled', { softDisabled: true }, { tabs: 2 }),
    lab('toggle-selected', { toggle: true, selected: true }, { tabs: 2 }), lab('aria-label', named('Continue to checkout')), lab('link', { href: 'https://example.com/docs' }, { tabs: 2 }),
    lab('icon', { icon: 'add' }), lab('loading', { loading: true })],
  'md-icon-button': [lab('toggle', named('Favorite'), { tabs: 2 }), lab('toggle-selected', named('Favorite', { selected: true })),
    lab('plain', named('Settings', { icon: 'settings', toggle: false })), lab('disabled', named('Favorite', { disabled: true }), { tabs: 2 }),
    lab('soft-disabled', named('Favorite', { softDisabled: true }), { tabs: 2 }), lab('link', named('Docs', { toggle: false, href: 'https://example.com' }))],
  'md-button-group': [lab('default', {}, { tabs: 4 }), lab('multi-select', { selectionMode: 'multi-select' }, { tabs: 4 }), lab('no-selection', { selectionMode: 'none' }, { tabs: 4 })],
  'md-fab': [lab('extended', {}, { tabs: 2 }), lab('icon-only', named('Create', { extended: false, label: '' }), { tabs: 2 }),
    lab('disabled', { disabled: true }, { tabs: 2 }), lab('soft-disabled', { softDisabled: true }, { tabs: 2 })],
  'md-fab-menu': [lab('closed', {}, { tabs: 2 }), lab('open', { open: true }, { tabs: 4 })],
  'md-segmented-button-set': [lab('single', {}, { tabs: 4 }), lab('multiselect', { multiselect: true }, { tabs: 4 })],
  'md-segmented-button': [lab('standalone', {}, { tabs: 2 })],
  'md-split-button': [lab('default', {}, { tabs: 3 }), lab('expanded', { trailingChecked: true }, { tabs: 3 }),
    lab('disabled', { disabled: true }, { tabs: 3 }), lab('soft-disabled', { softDisabled: true }, { tabs: 3 })],
  'md-badge': [lab('count', {}, { tabs: 2 }), lab('small', { variant: 'small' }), lab('overflow', { value: '1200', max: 999 })],
  'md-loading-indicator': [lab('default'), lab('contained', { variant: 'contained', label: 'Loading projects' })],
  'md-meter': [lab('default', { value: 72, label: 'Storage used', showValue: true }), lab('valuetext', { value: 3, max: 5, label: 'Rating', valueText: '3 of 5 stars' }),
    lab('circular', { value: 40, variant: 'circular', label: 'Battery' })],
  'md-progress-indicator': [lab('determinate', { value: 64, label: 'Building native components' }), lab('indeterminate', { indeterminate: true, label: 'Loading' }),
    lab('circular', { variant: 'circular', value: 30, label: 'Uploading' })],
  'md-skeleton': [lab('announce', { lines: 3 }), lab('silent', { announce: false, lines: 2 })],
  'md-snackbar': [lab('open', {}, { tabs: 3, update: { message: 'Changes archived' } }), lab('assertive', { politeness: 'assertive' }), lab('message-only', { action: '', closeable: false })],
  'md-status-dot': [lab('online', {}, { tabs: 2 }), lab('inline', { inline: true }), lab('live', { live: true, state: 'error', label: 'Connection lost' })],
  'md-tooltip': [lab('plain', {}, { tabs: 2 }), lab('rich', { variant: 'rich', subhead: 'Design systems' }, { tabs: 2 })],
  'md-divider': [lab('horizontal'), lab('vertical', { vertical: true })],
  'md-accordion': [lab('default', {}, { tabs: 5 }), lab('exclusive', { exclusive: true }, { tabs: 5 })],
  'md-card': [lab('static', {}, { tabs: 2 }), lab('interactive', named('Open workspace', { interactive: true }), { tabs: 3 }),
    lab('disabled', named('Open workspace', { interactive: true, disabled: true }), { tabs: 3, inactive: true })],
  'md-list': [lab('single-select', {}, { tabs: 4 }), lab('multi-select', { selectionMode: 'multi-select' }, { tabs: 4 }), lab('none', { selectionMode: 'none' }, { tabs: 4 })],
  'md-dialog': [lab('open', { open: true }, { tabs: 4, settle: 1.2 })],
  'md-bottom-sheet': [lab('open', { open: true }, { tabs: 4, settle: 1.2 })],
  'md-side-sheet': [lab('open', { open: true }, { tabs: 4, settle: 1.2 }), lab('modal', { open: true, variant: 'modal' }, { tabs: 4, settle: 1.2 })],
  'md-avatar': [lab('name'), lab('initials', { initials: 'AM', name: '' }), lab('labelled', { label: 'Alex Morgan, online' })],
  'md-organization-chart': [lab('single', ocCase(), { tabs: 2 }), lab('multiple', ocCase({ selectionMode: 'multiple', selectedIds: ['design', 'dev'] }), { tabs: 2 }),
    lab('selection-none', ocCase({ selectionMode: 'none', selectedIds: [] }), { tabs: 2 }), lab('locked-open', ocCase({ collapsible: false }), { tabs: 2 }),
    lab('folded', ocCase({ nodes: [{ ...OC_NODES[0], children: OC_NODES[0].children.map(c => c.id === 'eng' ? { ...c, expanded: false } : c) }] }), { tabs: 2 }),
    lab('horizontal', ocCase({ orientation: 'horizontal' }), { tabs: 2, width: 760 }), lab('rtl', ocCase(), { tabs: 2, direction: 'rtl' }),
    lab('empty', { nodes: [], label: 'Product team' })],
  'md-switch': [lab('off', named('Enable notifications'), { tabs: 2 }), lab('on', named('Enable notifications', { selected: true })),
    lab('disabled', named('Enable notifications', { disabled: true }), { tabs: 2 }), lab('soft-disabled', named('Enable notifications', { softDisabled: true }), { tabs: 2 }),
    lab('required', named('Accept terms', { required: true }))],
  'md-checkbox': [lab('unchecked', named('Receive updates'), { tabs: 2 }), lab('checked', named('Receive updates', { checked: true })),
    lab('indeterminate', named('Select all', { indeterminate: true })), lab('disabled', named('Receive updates', { disabled: true }), { tabs: 2 }),
    lab('soft-disabled', named('Receive updates', { softDisabled: true }), { tabs: 2 }),
    lab('error', named('Accept terms', { error: true, errorText: 'You must accept the terms' })), lab('error-appears', named('Accept terms'), { update: { error: true, errorText: 'You must accept the terms' } }), lab('required', named('Accept terms', { required: true }))],
  'md-radio': [lab('unchecked', named('Shared workspace'), { tabs: 2 }), lab('checked', named('Shared workspace', { checked: true })),
    lab('disabled', named('Shared workspace', { disabled: true }), { tabs: 2 }), lab('soft-disabled', named('Shared workspace', { softDisabled: true }), { tabs: 2 }),
    lab('required', named('Shared workspace', { required: true }))],
  'md-chip': [lab('filter', {}, { tabs: 3 }), lab('filter-selected', { selected: true }), lab('assist', { variant: 'assist', removable: false, label: 'Add to calendar', icon: 'event' }, { tabs: 2 }),
    lab('input', { variant: 'input', label: 'Alex Morgan', removable: true }, { tabs: 3 }), lab('disabled', { disabled: true }, { tabs: 3 }), lab('soft-disabled', { softDisabled: true }, { tabs: 3 })],
  // n1 (landed 2026-10-28): the ripple is decorative feedback on its container (the Laboratory's token-styled button surface,
  // presentation.mjs / AWCRippleExampleSurface); the container's content is what is exposed.
  'md-navigation-bar': [lab('bar', {}, { tabs: 2 }), lab('manual', { manualActivation: true, labelBehavior: 'selected' }, { tabs: 3 })],
  'md-navigation-tab': [lab('destination', {}, { tabs: 2 }), lab('soft-disabled', { active: false, softDisabled: true }, { tabs: 2 })],
  'md-tabs': [lab('tablist', {}, { tabs: 2 }), lab('secondary', { variant: 'secondary', activeTabIndex: 1 }, { tabs: 2 })],
  'md-tab': [lab('tab', {}, { tabs: 2 }), lab('disabled', { active: false, disabled: true }, { tabs: 1 })],
  'md-tab-panels': [lab('panels', {}, { tabs: 2 })],
  'md-tab-panel': [lab('panel', {}, { tabs: 2 })],
  'md-breadcrumbs': [lab('trail', {}, { tabs: 3 }), lab('collapsed', { maxItems: 2, itemsBeforeCollapse: 1, itemsAfterCollapse: 1 }, { tabs: 3 })],
  'md-breadcrumb-item': [lab('link', {}, { tabs: 2 }), lab('current', { current: true }, { tabs: 1 }), lab('disabled', { disabled: true }, { tabs: 1 })],
  // The pickers use the overlay viewport (the time picker's dialog, the colour picker's popover): 640 × 640.
  'md-color-picker': [lab('inline', { value: '#6750A4', presets: ['#6750A4', '#386A20', '#006A6A'], showHex: true }, { tabs: 6, height: 640 }),
    lab('disabled', { value: '#6750A4', disabled: true }, { tabs: 2, inactive: true, height: 640 })],
  // md-date-picker uses the overlay viewport (the dialog, the docked panel): 640 × 640.
  'md-date-picker': [lab('closed', { label: 'Start date', value: '2026-10-07', locale: 'en-US', clearable: true }, { tabs: 4, height: 640 }),
    lab('open', { label: 'Start date', value: '2026-10-07', locale: 'en-US', variant: 'modal-input', open: true }, { tabs: 8, settle: 1.2, height: 640 }),
    lab('docked', { label: 'Start date', value: '2026-10-07', locale: 'en-US', variant: 'docked', open: true }, { tabs: 10, settle: 1.2, height: 640 })],
  'md-time-picker': [lab('closed', { label: 'Meeting time', value: '14:30' }, { tabs: 2, height: 640 }),
    lab('open', { label: 'Meeting time', value: '14:30', variant: 'dial', open: true }, { tabs: 6, settle: 1.2, height: 640 }),
    lab('input', { label: 'Meeting time', value: '14:30', variant: 'input', open: true }, { tabs: 6, settle: 1.2, height: 640 })],
  'md-ripple': [lab('default', {}, { tabs: 2 }), lab('disabled', { disabled: true }, { tabs: 2 })],
  // Landed 2026-10-28 in AWCUI (macOS/iOS: NativeTextField) and 2026-10-29 in dev.awc.nativeui (Android: NativeTextField.kt).
  // md-otp-field: every cell is a Tab stop (6), named by the cell label template; the group is labelled.
  'md-otp-field': [lab('empty', { label: 'Verification code' }, { tabs: 3 }), lab('partial', { label: 'Verification code', value: '12', required: true, supportingText: 'Sent to •••• 42' }),
    lab('error', { label: 'Verification code', value: '123456', error: true, errorText: 'Wrong code' }), lab('mask-groups', { label: 'Recovery code', value: 'AB12', length: 4, groupSize: 2, validationType: 'alphanumeric', mask: true }),
    lab('disabled', { label: 'Verification code', value: '12', disabled: true }, { tabs: 1, inactive: true })],
  // md-autocomplete: the combobox input is a Tab stop, the clear button another once there is a value; open shows the listbox.
  'md-autocomplete': [lab('empty', { label: 'Fruit', options: AC_FRUIT, value: '' }, { tabs: 1 }), lab('value', { label: 'Fruit', options: AC_FRUIT, value: 'b' }, { tabs: 2 }),
    lab('open', { label: 'Fruit', options: AC_FRUIT, value: '', open: true }, { settle: 1.2 }), lab('multiple', { label: 'Fruit', options: AC_FRUIT, multiple: true, value: ['a', 'd'] }),
    lab('required', { label: 'Fruit', options: AC_FRUIT, value: '', required: true, supportingText: 'Pick one' }), lab('error', { label: 'Fruit', options: AC_FRUIT, value: '', error: true, errorText: 'Pick a fruit' }),
    lab('disabled', { label: 'Fruit', options: AC_FRUIT, value: 'a', disabled: true }, { tabs: 1, inactive: true })],
  // md-number-field: the input is the only tab stop (the steppers are pointer-only, as in the source: groupTabindex -1).
  'md-number-field': [lab('inline', { label: 'Guests', value: 2, min: 0, max: 8 }, { tabs: 1 }), lab('split', { label: 'Guests', value: 8, min: 0, max: 8, steppers: 'split' }),
    lab('required', { label: 'Quantity', required: true, supportingText: 'Whole units' }), lab('error', { label: 'Quantity', value: 12, error: true, errorText: 'At most 8' }),
    lab('none', { label: 'Amount', value: 1234.5, locale: 'de-DE', steppers: 'none' }), lab('disabled', { label: 'Guests', value: 2, disabled: true }, { tabs: 1, inactive: true })],
  'md-select': [lab('closed', { label: 'City', options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] }, { tabs: 2 }), lab('value', { label: 'City', value: 'paris', options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] }),
    lab('open', { label: 'City', value: 'paris', open: true, options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] }), lab('error', { label: 'City', required: true, error: true, errorText: 'Choose a city', options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] }),
    lab('disabled', { label: 'City', value: 'paris', disabled: true, options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] }, { tabs: 2, inactive: true })],
  'md-multi-select': [lab('chips', { label: 'Cities', value: ['london', 'paris'], options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] }, { tabs: 3 }), lab('open', { label: 'Cities', value: ['paris'], open: true, options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] }),
    lab('count', { label: 'Cities', value: ['london', 'paris', 'tokyo'], displayMode: 'count', options: [{ label: 'London', value: 'london' }, { label: 'Paris', value: 'paris' }, { label: 'Tokyo', value: 'tokyo' }] })],
  'md-search': [lab('docked', { layout: 'docked', placeholder: 'Search projects', value: 'pro' }, { tabs: 2, height: 400 }), lab('docked-open', { layout: 'docked', placeholder: 'Search projects', value: 'pro', open: true }, { tabs: 3, height: 400 }), lab('icon-trigger', { layout: 'full-screen', placeholder: 'Search projects' }, { tabs: 1, height: 400 }), lab('disabled', { layout: 'docked', placeholder: 'Search projects', value: 'pro', disabled: true }, { tabs: 0, height: 400 })],
  'md-text-field': [lab('default', { label: 'Project name' }, { tabs: 2 }), lab('filled', { label: 'Project name', value: 'AWC Native', supportingText: 'Visible to your team' }),
    lab('error', { label: 'Email', value: 'alex@', error: true, errorText: 'Enter a valid email address' }), lab('required', { label: 'Project name', required: true }),
    lab('disabled', { label: 'Project name', value: 'AWC Native', disabled: true }, { tabs: 2, inactive: true })],
};
// Content the hosts' default examples do not share (each host has its own sample text): pinned so every platform renders
// the same fixture. Case properties override these.
const PIN = { 'md-fab': { label: 'New project' }, 'md-chip': { label: 'Design system' }, 'md-loading-indicator': { label: 'Loading your workspace' },
  'md-status-dot': { label: 'All systems operational' }, 'md-split-button': { menuLabel: 'More actions' }, 'md-badge': { value: '12' }, 'md-accordion': { keepOneExpanded: false }, 'md-snackbar': { message: 'Project saved' } };
for (const [tag, list] of Object.entries(CASES)) if (PIN[tag]) for (const c of list) c.properties = { ...PIN[tag], ...c.properties };

export const CODEX_DONE = ['md-button', 'md-button-group', 'md-fab', 'md-fab-menu', 'md-icon-button', 'md-segmented-button-set', 'md-segmented-button', 'md-split-button', 'md-badge',
  'md-loading-indicator', 'md-meter', 'md-progress-indicator', 'md-skeleton', 'md-snackbar', 'md-status-dot', 'md-tooltip', 'md-divider'];
export const N_DONE = ['md-menu', 'md-ripple', 'md-text-field', 'md-number-field', 'md-otp-field', 'md-autocomplete'];
// Native platforms a component has landed on (default: all three). Captures skip the others; the report shows them as not run.
export const LANDED = {};
export const SESSION_DONE = ['md-accordion', 'md-card', 'md-list', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet', 'md-avatar', 'md-switch', 'md-checkbox', 'md-radio', 'md-chip'];
