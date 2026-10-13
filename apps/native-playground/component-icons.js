/** Component-specific Material Symbols from the bundled outlined font. */
export const COMPONENT_ICONS = Object.freeze({
  // Actions
  'md-button': 'smart_button',
  'md-button-group': 'view_week',
  'md-fab': 'add_circle',
  'md-fab-menu': 'bubble_chart',
  'md-icon-button': 'ads_click',
  'md-segmented-button': 'view_column',
  'md-split-button': 'arrow_drop_down_circle',
  // Charts
  'md-area-chart': 'area_chart',
  'md-bar-chart': 'bar_chart',
  'md-line-chart': 'show_chart',
  'md-pie-chart': 'pie_chart',
  'md-sparkline': 'ssid_chart',
  // Communication
  'md-badge': 'filter_1',
  'md-loading-indicator': 'progress_activity',
  'md-meter': 'speed',
  'md-progress-indicator': 'linear_scale',
  'md-skeleton': 'view_stream',
  'md-snackbar': 'announcement',
  'md-status-dot': 'circle',
  'md-tooltip': 'info',
  // Containment
  'md-accordion': 'unfold_more',
  'md-bottom-sheet': 'vertical_align_bottom',
  'md-card': 'credit_card',
  'md-dialog': 'open_in_new',
  'md-divider': 'horizontal_rule',
  'md-list': 'list',
  'md-ripple': 'waves',
  'md-side-sheet': 'vertical_split',
  // Data display
  'md-avatar': 'account_circle',
  'md-organization-chart': 'account_tree',
  'md-table': 'table_chart',
  // Navigation
  'md-app-bar': 'web_asset',
  'md-breadcrumbs': 'chevron_right',
  'md-menu': 'menu',
  'md-navigation-bar': 'bottom_navigation',
  'md-navigation-rail': 'view_sidebar',
  'md-stepper': 'format_list_numbered',
  'md-tabs': 'tab',
  'md-toolbar': 'build',
  // Selection
  'md-checkbox': 'check_box',
  'md-chip': 'sell',
  'md-color-picker': 'palette',
  'md-date-picker': 'calendar_month',
  'md-multi-select': 'checklist',
  'md-radio': 'radio_button_checked',
  'md-rating': 'star',
  'md-select': 'arrow_drop_down',
  'md-slider': 'tune',
  'md-switch': 'toggle_on',
  'md-time-picker': 'schedule',
  'md-transfer-list': 'sync_alt',
  // Text inputs
  'md-autocomplete': 'manage_search',
  'md-number-field': 'pin',
  'md-otp-field': 'password',
  'md-search': 'search',
  'md-text-field': 'text_fields',
});

export function componentIcon(tag) {
  return Object.hasOwn(COMPONENT_ICONS, tag) ? COMPONENT_ICONS[tag] : 'widgets';
}
