#!/usr/bin/env python3
"""Maintain the explicit adapter subset, intersecting it with the source contract."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[2]
shared='disabled softDisabled'
actions='variant disabled softDisabled loading icon trailingIcon toggle selected href target fullWidth value label'
text='variant label value placeholder type disabled softDisabled readOnly required error errorText supportingText maxLength clearable passwordToggle showPasswordLabel hidePasswordLabel multiline rows prefixText suffixText'
select='label placeholder options value disabled softDisabled open error errorText supportingText filterable searchPlaceholder noOptionsText noResultsText clearable clearLabel loading maxHeight'
chart='label subtitle series xAxis heightProp loading loadingLabel labelEmpty summary legend showMarks markSize lineWidth connectNulls'
props={
'md-button':actions.replace(' target','')+' size shape shapeMorph density ripple connectedLeft connectedRight mirrorIcon suppressExpandIconFlip','md-icon-button':actions+' selectedIcon','md-fab':actions,'md-fab-menu-item':actions,'md-split-button':actions+' menuLabel trailingChecked','md-segmented-button':actions,
'md-checkbox':shared+' checked indeterminate value error errorText supportingText','md-radio':shared+' checked value','md-switch':shared+' selected value',
'md-slider':'min max value step disabled range valueStart valueEnd sliderAriaLabel labeled valueIndicator valueText',
'md-rating':shared+' value defaultValue max readonly showValueLabel',
'md-text-field':text,'md-search':'disabled value placeholder showClearButton','md-number-field':text+' min max step allowOutOfRange steppers incrementLabel decrementLabel','md-otp-field':text+' length validationType transform mask',
'md-select':select,'md-multi-select':select+' maxSelected showSelectAll selectAllLabel','md-autocomplete':select+' inputValue multiple maxSelected limitResults freeSolo','md-select-option':'value label disabled selected supportingText',
'md-date-picker':'value label disabled open supportingText error errorText min max scrimDismissible okLabel cancelLabel',
'md-time-picker':'value label disabled open supportingText error errorText min max hideTrigger format minuteStep headline okLabel cancelLabel',
'md-color-picker':'value disabled open presets alpha showHex ariaLabelProp dismissOnOutsideClick',
'md-dialog':'open headline icon scrimDismissible fullscreen okLabel cancelLabel',
'md-bottom-sheet':'open headline showDragHandle closeable scrimDismissible topDivider bottomDivider',
'md-side-sheet':'open headline side showBack closeable scrimDismissible',
'md-menu':'open','md-fab-menu':'open menuLabel','md-tooltip':'open text subhead disabled','md-snackbar':'open message action closeable autoHide autoHideDuration stacked dismissLabel',
'md-bar-chart':chart+' cornerRadius grid','md-line-chart':chart+' area grid','md-area-chart':chart+' fillOpacity grid','md-sparkline':'data heightProp variant min max showMarks lineWidth markSize cornerRadius','md-pie-chart':'label subtitle data heightProp loading loadingLabel labelEmpty summary legend innerRadius startAngle endAngle',
'md-transfer-list':'items value sourceTitle targetTitle searchable sourceSearchPlaceholder targetSearchPlaceholder showSelectAll emptyText disabled singleStepOnly moveLeftLabel moveRightLabel moveAllLeftLabel moveAllRightLabel',
'md-organization-chart':'nodes selectionMode selectedIds collapsible label expandLabel collapseLabel',
'md-list':'label selectionMode listStyle','md-menu-item-group':'label','md-list-item':shared+' headline overline supportingText trailingSupportingText leadingIcon selected expandable expanded','md-menu-item':'headline supportingText trailingText disabled selected type divider','md-sub-menu-item':'headline supportingText disabled divider',
'md-card':shared+' variant interactive fullWidth','md-chip':shared+' variant selected selectable removable label icon','md-avatar':'src alt name initials size shape label','md-badge':'variant value max',
'md-divider':'inset insetStart insetEnd vertical','md-progress-indicator':'variant value max indeterminate label','md-loading-indicator':'label','md-meter':'value min max label showLabel showValue valueText variant','md-skeleton':'variant lines height announce ariaLabelProp','md-status-dot':'state shape inline label',
'md-toolbar':'density','md-app-bar':'headline subtitle leadingIcon leadingIconLabel density','md-ripple':'disabled',
'md-accordion':'exclusive keepOneExpanded defaultExpanded','md-accordion-item':'headline supportingText icon expanded disabled collapsible',
'md-navigation-bar':'activeIndex','md-navigation-rail':'activeIndex','md-tabs':'activeTabIndex divider','md-tab-panels':'','md-tab-panel':'active',
'md-navigation-tab':shared+' active label icon activeIcon badge badgeValue labelBehavior','md-navigation-rail-tab':'active disabled label icon badge badgeValue labelVisibility','md-tab':'label icon active disabled',
'md-stepper':'active readonly nextDisabled loading backLabel nextLabel finishLabel','md-step':'label description active completed error errorText disabled editable hideActions',
'md-breadcrumbs':'','md-breadcrumb-item':'href current icon disabled collapsed',
'md-button-group':'selectionMode required fullWidth','md-segmented-button-set':'multiselect',
'md-table':'caption loading','md-table-container':'variant','md-table-head':'','md-table-body':'','md-table-foot':'','md-table-row':'selected disabled selectable clickable value expandable expanded','md-table-cell':'align numeric padding head','md-table-sort-label':'column disabled defaultOrder order','md-table-expand-toggle':'buttonLabel','md-table-pagination':'count page rowsPerPage rowsPerPageOptions showFirstLast disabled labelPreviousPage labelNextPage','md-table-toolbar':'headline supportingText numSelected labelSelected',
}
events={
'md-avatar':'mdLoad mdError','md-button-group':'mdSelectionChange','md-segmented-button-set':'mdChange','md-accordion':'mdToggle','md-list':'mdSelect','md-button':'mdClick mdChange','md-icon-button':'mdClick','md-fab':'mdClick','md-fab-menu-item':'mdClick','md-split-button':'mdLeadingClick mdTrailingClick','md-segmented-button':'mdSegmentClick',
'md-checkbox':'mdChange','md-radio':'mdChange','md-switch':'mdInput mdChange','md-slider':'mdInput mdChange','md-rating':'mdChange',
'md-text-field':'mdInput mdChange mdSearch mdClear mdPasswordToggle','md-number-field':'mdInput mdChange','md-otp-field':'mdInput mdChange mdComplete mdInvalidInput','md-search':'mdInput mdChange mdSearch mdSubmit mdClear',
'md-select':'mdChange mdOpen mdClose','md-multi-select':'mdChange mdOpen mdClose mdRemove mdClear','md-autocomplete':'mdChange mdInput mdOpen mdClose mdClear','md-select-option':'mdSelectOptionChange',
'md-date-picker':'mdChange mdSelected mdOpen mdClose mdCancel','md-time-picker':'mdInput mdChange mdOpen mdClose mdCancel','md-color-picker':'mdInput mdChange mdOpenChange',
'md-dialog':'mdOpen mdClose mdCancel','md-bottom-sheet':'mdOpen mdClose mdCancel','md-side-sheet':'mdOpen mdClose mdCancel mdBack','md-menu':'mdOpen mdClose','md-fab-menu':'mdOpen mdClose','md-tooltip':'mdOpen mdClose','md-snackbar':'mdOpen mdClose mdAction',
'md-bar-chart':'mdBarClick mdLegendClick mdReady','md-line-chart':'mdMarkerClick mdLegendClick mdReady','md-area-chart':'mdAreaClick mdLegendClick mdReady','md-pie-chart':'mdSliceClick mdLegendClick mdReady','md-sparkline':'mdSparkClick mdReady',
'md-transfer-list':'mdChange mdMove','md-organization-chart':'mdSelectionChange mdNodeToggle','md-list-item':'mdClick mdItemClick mdItemSelect mdExpand','md-menu-item':'mdClick','md-sub-menu-item':'mdClick','md-card':'mdClick','md-chip':'mdClick mdSelect mdRemove','md-progress-indicator':'mdComplete','md-app-bar':'mdLeadingClick','md-accordion-item':'mdItemToggle',
'md-navigation-bar':'mdChange','md-navigation-rail':'mdTabChange','md-tabs':'mdTabChange','md-stepper':'mdBeforeChange mdStepChange mdComplete','md-navigation-tab':'mdTabClick','md-navigation-rail-tab':'mdTabClick','md-tab':'mdTabClick','md-step':'mdStepClick mdStepNext mdStepBack','md-breadcrumb-item':'mdSelect','md-table-row':'mdRowClick mdRowSelectionChange mdRowExpandedChange','md-table-sort-label':'mdSortRequest','md-table-pagination':'mdPageChange mdRowsPerPageChange'
}
slots={
'md-button':'|leading-icon|trailing-icon|loader','md-fab':'icon','md-fab-menu-item':'|icon','md-split-button':'','md-segmented-button':'|icon',
'md-select':'','md-multi-select':'','md-text-field':'trailing-icon','md-dialog':'|actions','md-bottom-sheet':'|actions','md-side-sheet':'|actions','md-menu':'','md-fab-menu':'','md-tooltip':'|actions','md-snackbar':'',
'md-list':'','md-menu-item-group':'','md-list-item':'|leading|trailing|expanded-content','md-sub-menu-item':'submenu','md-card':'','md-chip':'','md-toolbar':'|leading|trailing','md-app-bar':'leading|trailing','md-ripple':'',
'md-accordion':'','md-accordion-item':'','md-navigation-bar':'','md-navigation-rail':'|header|footer','md-tabs':'','md-tab-panel':'','md-tab-panels':'','md-stepper':'','md-step':'','md-navigation-rail-tab':'submenu','md-breadcrumbs':'','md-breadcrumb-item':'','md-button-group':'','md-segmented-button-set':'',
'md-table':'','md-table-container':'','md-table-head':'','md-table-body':'','md-table-foot':'','md-table-row':'|expanded','md-table-cell':'','md-table-sort-label':'','md-table-toolbar':'actions'
}
notes={
'md-button':'Dedicated Compose button matches source size/density rules, all five palette/toggle variants, bundled source Roboto and Material Symbols fonts, 200ms press/400ms release corner morph, source pointer-origin ripple timing and polygon loading animation. Real Compose PressInteraction owns press state. Source slots replace icon/label/loader fallbacks. Platform elevation shadows, antialiasing, HTML submit/reset, target contexts, cancelable DOM events, role overrides and group keyboard navigation remain different. Soft-disabled controls block activation without web focusability. mdClick reports proposed selected state before commit; mdChange follows commit. DOM originalEvent is omitted. RTL mirroring/expanded rotation currently applies to icon string fallbacks; custom icon slots retain their own transforms. Per-instance CSS custom properties are not evaluated.',
'md-avatar':'Native asynchronous HTTP(S) bitmap loading with initials/name fallback. CSS loading/crossorigin policies do not map to Android.',
'md-button-group':'Native single/multi selection and required coordination. DOM originalEvent is omitted from payloads.',
'md-segmented-button-set':'Native exclusive/multiple selection coordinated by child identity; supports duplicate child values.',
'md-accordion':'Native exclusive and keep-one-expanded coordination with comma-separated defaultExpanded indices. Reorder and floating drag remain unsupported.',
'md-list':'Native single/multi selection; native events omit DOM item references. Reordering remains unsupported.',
'md-ripple':'Uses the Compose ripple on a tappable native surface; standalone DOM ripple attachment has no native counterpart.',
'md-table-expand-toggle':'Standalone visual toggle; nested table row has its own bound expansion control.',
'md-tab-panels':'Composition container. Pass active on child panels; HTML for/id linkage is not available.',
'md-breadcrumbs':'Composition row. Automatic collapse/maxItems and generated separators are not yet implemented.',
'md-organization-chart':'Native indented tree with accessible cards; horizontal connector layout is not yet ported.',
'md-slider':'Horizontal Compose slider/range slider; vertical, custom icons and drag event parity remain unsupported.',
'md-rating':'Native whole-star rating; fractional precision, hover and custom icon rendering remain unsupported.',
'md-otp-field':'Uses a native constrained text entry; separated cells, grouping and automatic form submission are not yet ported.',
'md-tooltip':'Native visible tooltip surface toggles on tap; platform hover/delay/anchor positioning is not ported.',
'md-color-picker':'Native RGB sliders, alpha and presets; HEX/RGB output implemented. HSL output and complete source color parsing remain unsupported.',
'md-date-picker':'Uses Material DatePicker; ISO date strings replace JavaScript Date objects in event details.',
'md-time-picker':'Uses Material TimePicker; dialog native layout replaces docked web variants.',
'md-skeleton':'Static native skeleton blocks; shimmer/pulse motion remains unsupported.',
}
components={}
for source in sorted((ROOT/'packages/core/src/components').glob('md-*/*.tsx')):
 tag=source.parent.name; text=source.read_text()
 source_props=set(re.findall(r'@Prop\([^)]*\)\s+(?:\w+\s+)*?(\w+)\??\s*(?::|=)',text))
 source_events=set(re.findall(r'@Event\([^)]*\)\s+(\w+)',text))
 source_slots=set(re.findall(r'<slot(?:\s+name=[\'"]([^\'"]+)[\'"])?',text))
 assert tag in props,tag
 handled=set(props[tag].split())
 n=['Native Material/Compose appearance; CSS selectors, DOM APIs, form association, cancelable DOM events and source imperative methods are not compiled. Unsupported source properties are reported by the compiler.']
 if tag in notes:n.append(notes[tag])
 if 'chart' in tag or tag=='md-sparkline':n.append('Native Canvas baseline: index-based linear plotting and simple hit selection. Advanced scales, curves, stacking, zoom, exact source tooltip/hit-test/event payload parity remain incomplete.')
 components[tag]={'properties':sorted(handled & source_props),'events':sorted(set(events.get(tag,'').split()) & source_events),'methods':[],'slots':sorted(set(slots[tag].split('|')) & source_slots) if tag in slots else [],'notes':n}
Path(__file__).with_name('support.json').write_text(json.dumps({'platform':'android','components':components},indent=2)+'\n')
print(f'{len(components)} native Android adapter contracts')
