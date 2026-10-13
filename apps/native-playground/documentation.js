// Documentation data only. Callers render/escape these strings; nothing here
// evaluates source, mutates a component, or assumes browser APIs are native APIs.
import { literalChoices } from './contracts.js';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const typeText = value => typeof value === 'string' ? value : value?.text || '';
const clone = value => Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
const lists = ['properties', 'events', 'slots', 'methods', 'attributes', 'cssProperties', 'cssParts', 'dataTypes', 'callableProps', 'eventTypes', 'eventPayloads'];
const aliases = { properties: 'property', prop: 'property', props: 'property', events: 'event', slots: 'slot', methods: 'method', cssProperties: 'cssProperty', cssCustomProps: 'cssProperty', cssParts: 'cssPart', 'css-property': 'cssProperty', 'css-part': 'cssPart', dataTypes: 'dataType', callableProps: 'callableProp' };
const collection = { property: 'properties', event: 'events', slot: 'slots', method: 'methods', cssProperty: 'cssProperties', cssPart: 'cssParts', dataType: 'dataTypes', callableProp: 'callableProps' };

function mergeRecord(source = {}, generated = {}) {
  const result = { ...clone(source), ...clone(Object.fromEntries(Object.entries(generated).filter(([, value]) => value !== undefined))) };
  for (const key of ['description', 'summary']) {
    if (nonempty(source[key])) result[key] = source[key];
    else if (!nonempty(result[key])) delete result[key];
  }
  // Empty parser metadata must not erase an authored type/default description.
  if (!typeText(generated.type) && typeText(source.type)) result.type = clone(source.type);
  if (generated.default === '' && nonempty(source.default)) result.default = source.default;
  return result;
}

function mergeNamed(source = [], generated = []) {
  const result = new Map();
  for (const item of source) if (item && typeof item.name === 'string') result.set(item.name, clone(item));
  for (const item of generated) if (item && typeof item.name === 'string') result.set(item.name, mergeRecord(result.get(item.name), item));
  return [...result.values()];
}

function normalize(component = {}) {
  const result = clone(component);
  result.tag = component.tag || component.tagName;
  const attributes = component.attributes || [];
  const fields = component.properties || component.props || (component.members || []).filter(member => member.kind === 'field' && !['private', 'protected'].includes(member.privacy));
  result.properties = fields.map(field => {
    const attribute = attributes.find(item => item.fieldName === field.name || (!item.fieldName && item.name === field.name));
    if (!attribute) return clone(field);
    const merged = mergeRecord(attribute, field);
    merged.name = field.name;
    if (!own(field, 'attribute')) merged.attribute = attribute.name;
    return merged;
  });
  result.methods = component.methods || (component.members || []).filter(member => member.kind === 'method' && !['private', 'protected'].includes(member.privacy));
  result.slots = (component.slots || []).map(slot => ({ ...clone(slot), name: slot.name === '(default)' ? '' : slot.name }));
  result.cssProperties = component.cssProperties || component.cssCustomProps || [];
  return result;
}

/** Accept raw CEM declarations or normalized catalog components and optional docs JSON. */
export function mergeComponentDocumentation(manifestComponent = {}, catalogComponent = {}, usageData = {}) {
  const manifest = normalize(manifestComponent), catalog = normalize(catalogComponent), usage = normalize(usageData);
  const source = mergeRecord(usage, manifest);
  const result = mergeRecord(source, catalog);
  result.tag = catalog.tag || manifest.tag || usage.tag;
  for (const key of lists) {
    const declared = mergeNamed(manifest[key], catalog[key]);
    if (['dataTypes', 'callableProps', 'eventTypes', 'eventPayloads'].includes(key)) result[key] = mergeNamed(usage[key], declared);
    else result[key] = declared.map(member => {
      const extra = usage[key]?.find(item => item.name === member.name);
      const enriched = mergeRecord(extra, member);
      // Reference JSON supplements the declared API; it cannot introduce a
      // stale member or replace newer source JSDoc/type signatures.
      for (const textKey of ['description', 'summary']) if (nonempty(member[textKey])) enriched[textKey] = member[textKey];
      return enriched;
    });
  }
  return result;
}

// Curated from md-button.tsx, md-button.css and its checked-in README. These
// complement missing JSDoc only; source descriptions always take precedence.
const buttonProperties = {
  type: 'Selects the implicit form action: button has none, submit requests validation and submission, and reset restores the associated form. A nonempty href takes the link path instead.',
  variant: 'Chooses the visual emphasis: filled, outlined, text, elevated or tonal. It does not change the activation behavior.',
  size: 'Chooses one of five size tiers. At default density, xs/sm/md/lg/xl have minimum heights of 32/40/56/96/136 CSS pixels. The default tier is sm.',
  shape: 'Chooses the resting round or square shape. Press and toggle morphing can change its corners when shapeMorph is enabled.',
  disabled: 'Blocks activation and removes the button from keyboard focus. Use softDisabled when the unavailable action should remain focusable.',
  softDisabled: 'Blocks activation while keeping the button keyboard-focusable. The unavailable state remains exposed to accessibility.',
  ripple: 'Enables the press ripple. Pointer presses start at the pointer location; Enter and Space start a centered wave. Disabling it does not disable the action or shape morph.',
  loading: 'Shows the loading indicator and blocks activation. A custom loader slot can replace the built-in indicator.',
  icon: 'Material Symbols name for the leading icon. Content in the leading-icon slot replaces this fallback.',
  trailingIcon: 'Material Symbols name for the trailing icon. Content in the trailing-icon slot replaces this fallback.',
  href: 'Makes the button a link. An accepted activation follows a sanitized URL; a nonempty link does not also submit or reset a form. Use mdClick cancellation to veto navigation.',
  target: 'Selects the destination for href navigation. On the web this is a browsing-context target such as _self or _blank. Native routing uses the configured native destination policy.',
  toggle: 'Enables selected/unselected behavior. Accepted activation flips selected and emits mdChange; mdClick can cancel the change beforehand.',
  selected: 'The current selected state. In toggle mode, accepted activation updates it. Groups and composite controls can also supply selected state.',
  shapeMorph: 'Enables corner-shape changes during a press and when toggle selection changes. Turn it off to retain the chosen resting shape.',
  mirrorIcon: 'Mirrors directional leading and trailing icon glyphs in right-to-left layouts. Leave it off for nondirectional symbols such as add or favorite.',
  suppressExpandIconFlip: 'Prevents the trailing icon from rotating 180 degrees when aria-expanded is true. Useful when the application supplies a different expanded glyph.',
  fullWidth: 'Stretches the button across its parent’s inline width while preserving its size tier’s minimum height.',
  connectedLeft: 'Internal group input: marks the left side as connected to a neighboring button. Let md-button-group manage connected edges.',
  connectedRight: 'Internal group input: marks the right side as connected to a neighboring button. Let md-button-group manage connected edges.',
  value: 'Value included in button event details and used for button-group association. It is not automatically submitted as a form name/value entry.',
  groupTabindex: 'Internal group focus input: null keeps normal behavior, 0 allows sequential entry, and -1 omits sequential entry while preserving other supported focus and activation paths. Let the group manage it.',
  roleOverride: 'Overrides the source button role for composite widgets, such as gridcell in a date picker. Native adapters support a limited role mapping; unsupported role strings do not create arbitrary native accessibility roles.',
  density: 'Sets the local density rung from 0 (default) to -4 (most compact), overriding inherited density for this button.',
};
const buttonSlots = {
  '': 'Button label content. Supply a short action label such as Continue.',
  'leading-icon': 'Custom leading icon content; replaces the icon property fallback.',
  'trailing-icon': 'Custom trailing icon content; replaces the trailingIcon property fallback.',
  loader: 'Custom loading indicator displayed while loading is true; replaces the built-in indicator.',
};
const buttonEvents = {
  mdClick: 'Emitted before activation effects. detail.selected describes the proposed state. Cancel this event synchronously to prevent toggle, navigation and implicit form actions; the visual press feedback remains.',
  mdChange: 'Emitted after toggle mode commits a selected-state change. Its detail contains selected and value. Canceling this notification does not undo the change; use mdClick to veto it.',
};
const textFieldProperties = {
  variant: 'Chooses the filled or outlined field surface; input behavior is configured separately.',
  label: 'Field label displayed above or within the input according to its focus and value state.',
  placeholder: 'Hint text forwarded to the inner input or textarea when it is empty. It does not replace a persistent field label.',
  type: 'HTML input type for single-line mode, such as text, email, password or number. Multiline modes render a textarea instead.',
  minLength: 'Minimum text length constraint forwarded to the inner input or textarea and reflected in form validity. Leave unset to omit this constraint.',
  maxLength: 'Maximum text length forwarded to the inner input or textarea. Leave unset to omit the length limit.',
  min: 'Lower value constraint forwarded to the input. Its interpretation depends on type, for example a numeric minimum for type="number".',
  max: 'Upper value constraint forwarded to the input. Its interpretation depends on type, for example a numeric maximum for type="number".',
  step: 'Allowed value increment forwarded to the input for types that support stepping. Supply a number or an applicable HTML step value such as "any".',
  inputMode: 'Mobile keyboard hint forwarded as inputmode. It suggests a keyboard layout without changing the value type or validating the text.',
  enterKeyHint: 'Hint for the virtual keyboard’s Enter-key label, such as search, next or done. It does not install an action handler.',
  autoCapitalize: 'Automatic-capitalization hint forwarded to the text input, for example off, sentences or words.',
  disabled: 'Disables the inner input and excludes the control from normal user editing and successful form submission.',
  readOnly: 'Keeps the input focusable and its value available while preventing user edits. It is distinct from disabled.',
  required: 'Requires a value for the field’s constraint-validation flow; applicable input-type constraints still apply.',
  error: 'Application-controlled error appearance. Use setCustomValidity() when the application must also make form validation fail.',
  errorText: 'Message preferred while the field is in an error state. It takes precedence over the validation message and supportingText.',
  supportingText: 'Helper text below the field. Error text or a validation message takes precedence while an error is shown.',
  prefixText: 'Text displayed before the editable value while the field label is floating. It is presentation content, not part of the submitted value.',
  suffixText: 'Text displayed after the editable value while the field label is floating. It is presentation content, not part of the submitted value.',
};
const chartProperties = {
  label: 'Visible chart title. Use the chart’s separate accessibility labels for plot and data announcements.',
  series: 'Array of chart series, including their data and optional labels or presentation overrides. See MdChartSeries in Data & callback types.',
  xAxis: 'Horizontal/category-axis configuration, including data, scale and labels supported by the chart engine. See MdChartAxis.',
  yAxis: 'Value-axis configuration, including scale, bounds and labels supported by the chart engine. See MdChartAxis.',
  curve: 'Interpolation used to connect area data points, such as linear, smooth, monotone or a step variant.',
  connectNulls: 'Bridges gaps between missing/null data points instead of breaking the plotted series at those gaps.',
  showMarks: 'Shows markers at plotted data points. Per-series marker settings can override the chart default.',
  legend: 'Controls the legend position; use none to hide the legend.',
  tooltip: 'Selects the tooltip trigger mode supported by the chart engine, such as axis or item.',
  zoom: 'Enables in-plot zoom, the range slider, both, or neither. setZoom() and resetZoom() control the data-index window programmatically.',
  valueFormatter: 'Application callback that formats raw chart values for tooltips and the accessible data presentation. Assign a function in code; it is not an expression evaluated from text.',
  heightProp: 'CSS block-size applied to the web chart host through the height attribute, for example 320px. It is a CSS size string, not a numeric data value.',
  data: 'Array of pie-chart data records describing slices. See MdPieDatum for their value, label and optional presentation fields.',
};
const scopedProperties = {
  'md-text-field': textFieldProperties,
  'md-area-chart': chartProperties, 'md-bar-chart': chartProperties, 'md-pie-chart': chartProperties,
  'md-fab': {
    variant: 'Chooses the floating action button’s surface or color-role palette.',
    size: 'Chooses the standard, medium or large floating action button size.',
    disabled: 'Blocks activation and removes the floating action button from sequential keyboard focus.',
    softDisabled: 'Blocks activation while retaining keyboard focus and an accessible unavailable state.',
    lowered: 'Uses the lower elevation treatment. The surface variant also switches from surface-container-high to surface-container-low.',
    ripple: 'Enables the visual ripple for pointer and keyboard activation. It does not change whether activation is allowed.',
    icon: 'Material Symbols name used when no custom icon slot or temporary menu icon replaces it.',
    label: 'Text for an extended floating action button and its accessible-name fallback. When extended is unset, a nonempty label enables the extended presentation.',
  },
  'md-icon-button': { connectedLeft: buttonProperties.connectedLeft, connectedRight: buttonProperties.connectedRight, groupTabindex: buttonProperties.groupTabindex, value: 'Value identifying this icon button within md-button-group.' },
  'md-list': { reorderable: 'Enables row drag handles and Alt+ArrowUp/ArrowDown reordering. Successful reordering moves children and emits mdReorder; disabled rows cannot be picked up.' },
  'md-menu': { listLabel: 'Accessible label for the popup listbox when the menu is used with a virtualized combobox provider.' },
  'md-ripple': { disabled: 'Prevents new pointer or programmatically triggered ripple waves.' },
  'md-slider': {
    min: 'Lower bound of the slider’s numeric range.', max: 'Upper bound of the slider’s numeric range.',
    value: 'Current numeric value in single-thumb mode. In range mode, use valueStart and valueEnd.',
    step: 'Increment between allowed slider values and the spacing used for step/tick marks.',
    disabled: 'Disables the slider’s native range inputs and user interaction.',
    valueStart: 'Lower-thumb value used in range mode.', valueEnd: 'Upper-thumb value used in range mode.',
    orientation: 'Lays out the slider horizontally or vertically.',
    labeled: 'Deprecated alias for showing the value indicator bubble. Prefer valueIndicator.',
    sliderAriaLabel: 'Accessible label for the slider input, exposed through aria-label. Range-specific thumb labels take precedence when supplied.',
  },
  'md-table-body': { presentational: 'Internal table input: removes this wrapper’s rowgroup role in frozen-header mode because its scroll wrapper already supplies the rowgroup.' },
  'md-table-foot': { presentational: 'Internal table input: removes this wrapper’s rowgroup role in frozen-header mode because its scroll wrapper already supplies the rowgroup.' },
};
const formMethodTags = new Set(['md-text-field', 'md-number-field', 'md-checkbox', 'md-radio', 'md-switch', 'md-select', 'md-multi-select', 'md-autocomplete', 'md-date-picker', 'md-otp-field', 'md-time-picker']);
const formMethods = {
  getValidity: 'Reads current validity and the validation message without changing the value. The declared return type shows whether individual validity flags are nested or returned directly.',
  setCustomValidity: 'Sets an application validation error. A nonempty message keeps the control invalid until this method is called with an empty string.',
  checkValidity: 'Returns whether the control currently satisfies its constraints. This query does not reveal validation errors or move focus; use reportValidity() to request presentation.',
  reportValidity: 'Checks constraints and requests the component’s validation-error presentation when invalid, including focus where applicable. Resolves to the validity result.',
};
const chartMethodTags = new Set(['md-line-chart', 'md-area-chart', 'md-bar-chart', 'md-pie-chart', 'md-sparkline']);
const chartMethods = {
  refreshTheme: 'Reads the current theme and reapplies the chart engine configuration. Use after changing theme values that do not otherwise trigger an update.',
  resize: 'Asks the existing chart engine to remeasure and redraw for its current container size.',
  replay: 'Restarts the chart’s entry animation using the current animation settings.',
  toDataURL: 'Returns the rendered web chart as a PNG data URL, or an empty string when its engine is not available.',
  getInstance: 'Returns the underlying web chart-engine instance, or null before it is available. This is an imperative browser object, not serializable chart data.',
  setZoom: 'Sets the visible chart window using absolute start and end data indices.',
  resetZoom: 'Clears the current zoom window and restores the full data range.',
};
const scopedMethods = {
  'md-text-field': { setFocus: 'Moves focus to the inner input or textarea.', select: 'Selects all text in the inner input or textarea; it does not change the value.', getInputElement: 'Returns the actual inner input or textarea so composite controls can wire focus or accessibility. Returns null before the first render.' },
  'md-number-field': { setFocus: 'Moves focus to the inner number field.', select: 'Selects the inner field’s text without changing its numeric value.', stepUp: 'Increases the numeric value by the configured step multiplied by times (at least one), using the component’s normal stepping constraints.', stepDown: 'Decreases the numeric value by the configured step multiplied by times (at least one), using the component’s normal stepping constraints.' },
  'md-radio': { setFocus: 'Focuses the radio and requests its visible programmatic focus indicator.', setBlur: 'Removes focus from the radio.', select: 'Checks an enabled, unchecked radio and emits mdChange. Does nothing when already checked or disabled.', syncValidityFromGroup: 'Recomputes validity after the associated radio group changes. Normally called by group coordination.' },
  'md-switch': { setFocus: 'Focuses the switch and requests its visible programmatic focus indicator without toggling its value.' },
  'md-otp-field': { setFocus: 'Focuses the first empty code cell, or the last cell when all cells are filled.', clear: 'Clears the code and committed value. This programmatic operation does not emit mdInput or mdChange.' },
  'md-date-picker': { clear: 'Clears the selected date value and error presentation, then emits the component’s change notification. Does nothing while disabled.', focusInput: 'Focuses the date text input when present, otherwise the trigger.' },
  'md-autocomplete': { focusInput: 'Moves focus to the autocomplete input field.', showMenu: 'Opens the suggestions popup unless the component is disabled.', closeMenu: 'Closes the suggestions popup.' },
  'md-select': { show: 'Opens the option popup unless disabled.', close: 'Closes the option popup.', focusTrigger: 'Moves focus to the select’s trigger field.', reset: 'Clears the current selection and emits mdChange with an empty string when a selection existed.' },
  'md-multi-select': { show: 'Opens the option popup unless disabled.', close: 'Closes the option popup.', focusTrigger: 'Moves focus to the multi-select’s trigger field.', reset: 'Clears all selected values and emits mdChange with an empty array when selections existed.' },
  'md-list-item': { setFocus: 'Focuses this row’s appropriate interactive target, passing through optional browser FocusOptions.', focusItem: 'Convenience alias that focuses the item through setFocus().', toggle: 'Toggles an expandable, enabled row’s expanded state.', expand: 'Expands the row when expandable and enabled.', collapse: 'Collapses the row when expandable and enabled.' },
  'md-navigation-bar': { select: 'Selects the tab at the supplied index through the bar’s selection flow.', focusTab: 'Focuses the tab at the supplied index without selecting it. Hard-disabled tabs are skipped.' },
  'md-navigation-rail': { expand: 'Switches the rail to its expanded variant.', collapse: 'Switches the rail to its standard variant.', toggle: 'Switches between standard and expanded rail variants.', focusTab: 'Moves the rail’s roving focus to the tab at the supplied index without selecting it.' },
  'md-navigation-tab': { focusEl: 'Focuses this tab unless it is disabled.' },
  'md-toolbar': { setFocus: 'Focuses the retained active toolbar item, or the preferred eligible item when no active item remains.' },
  'md-rating': { focusRating: 'Moves focus to the rating’s interactive items container.' },
  'md-accordion-item': { focusHeader: 'Moves keyboard focus to the accordion header and requests its visible focus indicator.' },
  'md-fab': { setMenuIcon: 'Temporarily replaces the displayed icon for menu morphing without changing the authored icon or slot. Pass null to restore authored content.' },
  'md-ripple': { trigger: 'Starts a centered, self-releasing ripple wave unless disabled or suppressed by the ripple token.', whenSettled: 'Waits for the tracked ripple to settle, with a bounded release timeout. It is not an indefinite wait for a held pointer.' },
  'md-stepper': { next: 'Moves to the next enabled step, or completes the sequence and emits mdComplete when no next step remains.', prev: 'Moves to the previous enabled step when one exists.', goTo: 'Requests navigation to a step index, applying the stepper’s bounds and navigation rules.', reset: 'Clears completion and error flags on all steps and restores active index zero.' },
  'md-snackbar': { show: 'Shows the snackbar.', hide: 'Hides an open snackbar and emits mdClose with the supplied reason; the default reason is close.' },
};

function curatedMethod(tag, name) {
  if (scopedMethods[tag]?.[name]) return scopedMethods[tag][name];
  if (formMethodTags.has(tag) && formMethods[name]) return formMethods[name];
  if (chartMethodTags.has(tag) && chartMethods[name]) return chartMethods[name];
  if (['md-select', 'md-multi-select', 'md-autocomplete'].includes(tag)) {
    if (name === 'loadOptions') return 'Replaces the option dataset from an array or a row-source factory. Uses virtualization when available and falls back to ordinary option rendering.';
    if (name === 'getLabels') return 'Returns the labels currently known for the requested option values. The returned record is keyed by value.';
    if (name === 'setQuery') return 'Updates the option filter query and the displayed search text.';
  }
  if (['md-dialog', 'md-fab-menu', 'md-side-sheet', 'md-menu', 'md-search', 'md-bottom-sheet', 'md-color-picker'].includes(tag)) {
    if (name === 'show') return 'Requests that the component open through its own visibility and overlay lifecycle.';
    if (name === 'close') return 'Requests that the component close through its own visibility and overlay lifecycle.';
    if (name === 'whenClosed') return 'Returns a promise for completion of the component’s current close lifecycle.';
  }
  return undefined;
}

function parameterDescription(tag, method, name) {
  if (formMethodTags.has(tag) && method === 'setCustomValidity' && name === 'message') return 'Validation error text; pass an empty string to clear the custom error.';
  if (tag === 'md-number-field' && ['stepUp', 'stepDown'].includes(method) && name === 'times') return 'Step multiplier. Defaults to 1; values below 1 are treated as 1.';
  if (chartMethodTags.has(tag) && method === 'setZoom' && ['startIndex', 'endIndex'].includes(name)) return name === 'startIndex' ? 'Absolute data index at the start of the requested zoom window.' : 'Absolute data index at the end of the requested zoom window.';
  if (['md-select', 'md-multi-select', 'md-autocomplete'].includes(tag)) {
    if (method === 'loadOptions' && name === 'source') return 'Option array or row source with count and getRow(index).';
    if (method === 'getLabels' && name === 'values') return 'Option values whose labels should be looked up.';
    if (method === 'setQuery' && name === 'query') return 'New option-filter text.';
  }
  if (tag === 'md-fab' && method === 'setMenuIcon' && name === 'icon') return 'Temporary Material Symbols name, or null to restore the authored icon.';
  if (tag === 'md-list-item' && method === 'setFocus' && name === 'options') return 'Optional browser FocusOptions, for example preventScroll.';
  return undefined;
}
const commonProperties = {
  disabled: 'Controls whether this component is disabled. Focus and form behavior follow the component’s contract.',
  value: 'The component value. Its accepted shape is described by the declared type; change notifications are listed under Events.',
  label: 'Text used to label the component.',
  icon: 'Icon name used by the component. Check its slots for custom icon content.',
  variant: 'Selects a component presentation from the declared variants.',
  size: 'Selects a component size from the declared options.',
  required: 'Marks the control as required for its supported validation flow.',
  name: 'Identifies the control in its supported form or grouping contract.',
  placeholder: 'Hint text shown when the input has no value.',
  readOnly: 'Prevents editing through the control while retaining its current value.',
};

function memberSupport(component, kind, name, platform) {
  if (platform === 'web') return { platform, status: 'source', description: 'Declared by the source web component.' };
  const policy = component.support?.[platform], key = kind === 'callableProp' ? 'properties' : collection[kind];
  const has = values => Array.isArray(values) && values.some(item => (typeof item === 'string' ? item : item?.name) === name);
  if (kind === 'cssPart' && has(policy?.visualParts)) {
    const appearance = policy.appearance?.api;
    return { platform, status: 'native-equivalent', description: `CSS selector: Web only. Native visual equivalent: implemented.${appearance ? ` Customize supported appearance fields with ${appearance}.` : ''}${name === 'anchor' ? ' Navigation uses the native action/router; style the button surface.' : ''}` };
  }
  const unsupportedKey = key ? `unsupported${key[0].toUpperCase()}${key.slice(1)}` : '';
  if (policy?.status === 'missing-adapter' || has(policy?.[unsupportedKey])) return { platform, status: 'unsupported', description: 'Not implemented by this native adapter.' };
  if (has(policy?.[key])) return { platform, status: 'supported', description: 'Listed as supported by this native adapter. Platform limitations still apply.' };
  return { platform, status: 'unknown', description: ['cssProperty', 'cssPart'].includes(kind) ? 'This is a web styling hook. Native support for this hook is not declared.' : 'Support for this member has not been declared for this platform.' };
}

function fallbackDescription(component, kind, member) {
  const tag = component.tag || component.tagName || 'this component', name = member.name || '';
  if (tag === 'md-button') {
    const curated = kind === 'property' ? buttonProperties[name] : kind === 'slot' ? buttonSlots[name] : kind === 'event' ? buttonEvents[name] : undefined;
    if (curated) return { description: curated, descriptionSource: 'curated' };
    if (kind === 'cssProperty' && name === '--md-button-loading-size') return { description: 'Size of the button loading indicator.', descriptionSource: 'curated' };
    if (kind === 'cssProperty' && name === '--md-button-focus-ring-color') return { description: 'Color of the keyboard focus ring.', descriptionSource: 'curated' };
    if (kind === 'cssPart' && name === 'anchor') return { description: 'Internal link surface rendered for a safe href.', descriptionSource: 'curated' };
  }
  const scoped = kind === 'property' ? scopedProperties[tag]?.[name] : kind === 'method' ? curatedMethod(tag, name) : undefined;
  if (scoped) return { description: scoped, descriptionSource: 'curated' };
  if (kind === 'property' && commonProperties[name]) return { description: commonProperties[name], descriptionSource: 'generic' };
  if (kind === 'dataType') return { description: `Source type definition for ${name}. Consult its fields when constructing component values.`, descriptionSource: 'generic' };
  if (kind === 'callableProp') return { description: `Callback signature for the ${name} property. Supply a function in application code; this playground does not evaluate function text.`, descriptionSource: 'generic' };
  const description = kind === 'property' ? `Configures the ${name} property of ${tag}. The source has no further description for this member.`
    : kind === 'event' ? `The ${name} event exposed by ${tag}. Inspect its declared payload before handling it.`
    : kind === 'slot' ? name ? `Named content location: ${name}.` : 'Default component content.'
    : kind === 'method' ? `Public ${name} method on ${tag}. Its behavior is not further described in the available metadata.`
    : kind === 'cssProperty' ? `CSS custom property exposed by ${tag}. Set it on the web component to customize the corresponding style.`
    : kind === 'cssPart' ? `Exposed shadow part named ${name}; use the web ::part() selector to style it.`
    : 'No additional source description is available.';
  return { description, descriptionSource: 'generic' };
}

function usageFor(kind, member, platform, support) {
  if (platform !== 'web') {
    const target = platform === 'ios' ? 'SwiftUI' : platform === 'android' ? 'Compose' : 'native';
    if (kind === 'dataType') return 'This is a source type reference. Consult the native API example for its platform representation; the TypeScript definition is not a native API declaration.';
    if (['cssProperty', 'cssPart'].includes(kind)) return 'This styling hook belongs to the web component. Use the native theme or component API where documented; CSS declarations and shadow-part selectors are not sent to the native renderer.';
    if (support.status !== 'supported') return `This member has no declared ${target} implementation. Consult the source documentation and platform coverage before using it in a native app.`;
    if (kind === 'property') return `Pass a typed value through the ${target} component properties shown in Usage. The playground serializes supported values to the native host; changing a property restarts its preview.`;
    if (kind === 'event') return `Handle the ${target} native event callback shown in Usage. Native event payloads and cancellation follow the adapter contract; source DOM flags and originalEvent are not automatically reproduced.`;
    if (kind === 'slot') return `Supply ${member.name ? `named “${member.name}”` : 'default'} native child content through the ${target} composition API. Consult adapter coverage for slot limitations.`;
    if (kind === 'method') return `Use the documented ${target} method or native action API. The source JavaScript signature is a reference; consult adapter coverage for the native entry point.`;
    if (kind === 'callableProp') return `Supply the documented ${target} callback in application code. A JavaScript function cannot be serialized through this playground; check the native signature and adapter limitations.`;
  }
  if (kind === 'property') return member.attribute === null || member.attribute === false ? 'Set this member as a JavaScript property; no HTML attribute is declared.' : 'Set the property on the component. An HTML attribute is available only when listed; complex values should be assigned as properties.';
  if (kind === 'event') return 'Listen for this event and read event.detail. Native callbacks use their platform event contract rather than a DOM CustomEvent.';
  if (kind === 'slot') return member.name ? `Place content with slot="${member.name}" inside the web component. Native callers supply named child content.` : 'Place content inside the web component without a slot attribute. Native callers supply default child content.';
  if (kind === 'method') return 'Call this public method on the ready web component instance. Check the platform support row before assuming a native equivalent.';
  if (kind === 'cssProperty') return 'Assign this CSS custom property on the web component. A CSS value is not automatically a native property.';
  if (kind === 'cssPart') return 'Style the exposed part with the web component’s ::part(name) selector. Native views do not use shadow-part selectors.';
  if (kind === 'dataType') return 'This is a source type reference, not an editable component property. Native representations can differ.';
  if (kind === 'callableProp') return 'Assign a function to the property in application code. Source signatures describe the web callback; check native support separately.';
  return '';
}

/** Returns plain data, including source-only payloads and explicit native support. */
export function memberDocumentation(component = {}, requestedKind, requestedMember, platform = 'web') {
  const kind = aliases[requestedKind] || requestedKind;
  const normalized = normalize(component), members = normalized[collection[kind]] || [];
  const member = typeof requestedMember === 'string' ? members.find(item => item.name === requestedMember) || { name: requestedMember } : requestedMember || {};
  const name = member.name === '(default)' && kind === 'slot' ? '' : member.name || '';
  const sourceDescription = nonempty(member.description) ? member.description : nonempty(member.summary) ? member.summary : '';
  const support = memberSupport(normalized, kind, name, platform);
  const result = {
    kind, name,
    ...(sourceDescription ? { description: sourceDescription, descriptionSource: 'source' } : fallbackDescription(normalized, kind, { ...member, name })),
    type: kind === 'event' ? typeText(member.detail) || typeText(member.type) : ['dataType', 'callableProp'].includes(kind) ? typeText(member.body) || typeText(member.type) : typeText(member.type),
    options: [], support, usage: usageFor(kind, { ...member, name }, platform, support),
  };
  try { result.options = clone(literalChoices(member)); } catch { result.options = clone(member.options || []); }
  for (const key of ['default', 'defaultValue', 'attribute', 'parameters', 'params', 'returns', 'return', 'returnType', 'detail', 'body', 'cancelable', 'bubbles', 'composed', 'reflect', 'mutable', 'optional']) if (own(member, key) && member[key] !== undefined) result[key] = clone(member[key]);
  if (kind === 'method' && Array.isArray(result.parameters)) result.parameters = result.parameters.map(parameter => {
    const description = parameterDescription(normalized.tag, name, parameter.name);
    return !nonempty(parameter.description) && description ? { ...parameter, description } : parameter;
  });
  if (kind === 'property' && (/@internal\b/.test(result.description) || normalized.tag === 'md-button' && ['connectedLeft', 'connectedRight', 'groupTabindex'].includes(name))) result.internal = true;
  if (kind === 'event') {
    const payload = (normalized.eventPayloads || []).find(item => item.name === name);
    if (payload) result.payload = clone(payload);
    const detail = typeText(member.detail) || typeText(payload?.detail) || typeText(member.type).replace(/^CustomEvent<([\s\S]+)>$/, '$1');
    const payloadType = (normalized.eventTypes || []).find(item => item.name === detail || item.name === detail.replace(/<.*$/, ''));
    if (payloadType) result.payloadType = clone(payloadType);
    // Fields are supplied by the server's TypeScript AST analysis. Keep the
    // browser renderer independent of source parsing and preserve authored prose.
    const fields = payload?.fields ?? payloadType?.fields;
    if (Array.isArray(fields)) result.payloadFields = clone(fields);
  }
  return result;
}

/** Plain presentation data for an event payload; never parses TypeScript text. */
export function eventPayloadDocumentation(component = {}, doc = {}) {
  const type = typeText(doc.detail) || typeText(doc.payload?.detail) || typeText(doc.type).replace(/^CustomEvent<([\s\S]+)>$/, '$1') || 'unknown';
  const fields = (doc.payloadFields || []).filter(field => nonempty(field.name)).map(field => ({
    name: field.name, type: typeText(field.type) || 'unknown', optional: Boolean(field.optional),
    description: nonempty(field.description) ? field.description : 'No additional field description is declared in the source.',
  }));
  const empty = ['void', 'undefined', 'never'].includes(type.trim());
  const simple = { string: 'The detail is a text value.', number: 'The detail is a number.', boolean: 'The detail is true or false.', null: 'The detail is null.' };
  const description = empty ? 'This event does not carry payload data.' : fields.length ? 'Read these fields from event.detail.' : simple[type.trim()] || 'Read event.detail using the declared source type below.';
  const source = doc.payloadType;
  const definition = source?.body ? source.kind === 'interface' ? `interface ${source.name}${source.extends ? ` extends ${source.extends}` : ''} {\n${source.body}\n}` : `type ${source.name} = ${source.body};` : type;
  const readableFields = fields.filter(field => !/\b(?:MouseEvent|KeyboardEvent|PointerEvent|HTMLElement|Element)\b/.test(field.type));
  const firstFields = component.tag === 'md-button' && ['mdClick', 'mdChange'].includes(doc.name)
    ? ['value', 'selected'].map(name => readableFields.find(field => field.name === name)).filter(Boolean)
    : readableFields.slice(0, 2);
  const access = firstFields.length ? firstFields.map(field => `event.detail[${JSON.stringify(field.name)}]`).join(', ') : 'event.detail';
  const example = /^md-[a-z0-9-]+$/.test(component.tag || '') && nonempty(doc.name)
    ? `document.querySelector(${JSON.stringify(component.tag)}).addEventListener(${JSON.stringify(doc.name)}, (event) => {\n  console.log(${empty ? JSON.stringify(doc.name) : access});\n${component.tag === 'md-button' && doc.name === 'mdClick' ? '  // event.preventDefault(); // Cancel this activation before its effects.\n' : ''}});`
    : '';
  return { type, fields, empty, description, definition, example };
}
