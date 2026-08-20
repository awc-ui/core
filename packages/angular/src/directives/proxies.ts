/* tslint:disable */
/* auto-generated angular directive proxies */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, NgZone } from '@angular/core';

import { ProxyCmp, proxyOutputs } from './angular-component-lib/utils';

import { Components } from '@awc-ui/core';


@ProxyCmp({
  inputs: ['bringToFront', 'defaultExpanded', 'density', 'elevation', 'exclusive', 'floating', 'headingLevel', 'initialX', 'initialY', 'keepOneExpanded', 'region', 'regionThreshold', 'reorderable', 'transition', 'variant']
})
@Component({
  selector: 'md-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['bringToFront', 'defaultExpanded', 'density', 'elevation', 'exclusive', 'floating', 'headingLevel', 'initialX', 'initialY', 'keepOneExpanded', 'region', 'regionThreshold', 'reorderable', 'transition', 'variant'],
})
export class MdAccordion {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdToggle', 'mdReorder', 'mdDragStart', 'mdDragMove', 'mdDragEnd']);
  }
}


import type { MdAccordionDragDetail as IMdAccordionMdAccordionDragDetail } from '@awc-ui/core';

export declare interface MdAccordion extends Components.MdAccordion {
  /**
   * Emitted when an item expands or collapses. Detail carries the
full set of expanded indices.
   */
  mdToggle: EventEmitter<CustomEvent<{ index: number; expanded: boolean; expandedIndices: number[]; }>>;
  /**
   * Emitted when items are reordered via drag-and-drop or keyboard
(Alt+ArrowUp / Alt+ArrowDown). `order` is the new index sequence
relative to the original order, e.g. moving the item that was at
index 0 to index 2 yields `order: [1, 2, 0]`.
   */
  mdReorder: EventEmitter<CustomEvent<{ from: number; to: number; order: number[]; }>>;
  /**
   * Emitted once a floating panel starts being dragged.
   */
  mdDragStart: EventEmitter<CustomEvent<IMdAccordionMdAccordionDragDetail>>;
  /**
   * Emitted continuously while a floating panel is being dragged.
   */
  mdDragMove: EventEmitter<CustomEvent<IMdAccordionMdAccordionDragDetail>>;
  /**
   * Emitted when a floating panel is released.
   */
  mdDragEnd: EventEmitter<CustomEvent<IMdAccordionMdAccordionDragDetail>>;
}


@ProxyCmp({
  inputs: ['collapsible', 'contentMaxHeight', 'density', 'disabled', 'expanded', 'headingLevel', 'headline', 'icon', 'regionRole', 'supportingText'],
  methods: ['toggle', 'focusHeader']
})
@Component({
  selector: 'md-accordion-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['collapsible', 'contentMaxHeight', 'density', 'disabled', 'expanded', 'headingLevel', 'headline', 'icon', 'regionRole', 'supportingText'],
})
export class MdAccordionItem {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdItemToggle', 'mdItemRequestFocus', 'mdItemRequestReorder']);
  }
}


export declare interface MdAccordionItem extends Components.MdAccordionItem {
  /**
   * Emitted whenever the item toggles. The parent `md-accordion` uses
this to coordinate exclusive mode.
   */
  mdItemToggle: EventEmitter<CustomEvent<{ expanded: boolean; index: number }>>;
  /**
   * Internal event the parent listens to for arrow-key roving focus.
Bubbles + composed so the parent receives it through the shadow.
   */
  mdItemRequestFocus: EventEmitter<CustomEvent<{ direction: 'next' | 'prev' | 'first' | 'last'; from: number; }>>;
  /**
   * Internal event the parent listens to for Alt+Arrow keyboard
reordering. Bubbles + composed so the parent receives it
through the shadow.
   */
  mdItemRequestReorder: EventEmitter<CustomEvent<{ direction: 'up' | 'down'; from: number; }>>;
}


@ProxyCmp({
  inputs: ['density', 'headline', 'leadingIcon', 'leadingIconLabel', 'scrolled', 'searchAriaLabel', 'searchDisabled', 'searchPlaceholder', 'searchValue', 'subtitle', 'titleAlignment', 'variant']
})
@Component({
  selector: 'md-app-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'headline', 'leadingIcon', 'leadingIconLabel', 'scrolled', 'searchAriaLabel', 'searchDisabled', 'searchPlaceholder', 'searchValue', 'subtitle', 'titleAlignment', 'variant'],
})
export class MdAppBar {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdLeadingClick', 'mdSearchActivate', 'mdSearchInput']);
  }
}


export declare interface MdAppBar extends Components.MdAppBar {
  /**
   * Emitted when the prop-based leading icon button is activated.
   */
  mdLeadingClick: EventEmitter<CustomEvent<MouseEvent>>;
  /**
   * Search variant only: emitted when the inline search field is selected
(click, focus, Enter, or Space). Wire this to `md-search.show()` to open
the full-screen search view per the MD3 spec.
   */
  mdSearchActivate: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Search variant only: emitted on every inline search field input change.
   */
  mdSearchInput: EventEmitter<CustomEvent<{ value: string }>>;
}


@ProxyCmp({
  inputs: ['animation', 'animationDuration', 'axisTicks', 'connectNulls', 'curve', 'density', 'fillOpacity', 'grid', 'heightProp', 'inverted', 'label', 'labelEmpty', 'labelPlot', 'labelPoint', 'labelZoomEnd', 'labelZoomStart', 'legend', 'lineWidth', 'loading', 'loadingLabel', 'locale', 'markSize', 'noAnimation', 'series', 'seriesLabels', 'showLabels', 'showLine', 'showMarks', 'stack', 'subtitle', 'summary', 'tableLabels', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter', 'xAxis', 'yAxis', 'zoom'],
  methods: ['resize', 'replay', 'toDataURL', 'getInstance', 'setZoom', 'resetZoom']
})
@Component({
  selector: 'md-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['animation', 'animationDuration', 'axisTicks', 'connectNulls', 'curve', 'density', 'fillOpacity', 'grid', 'heightProp', 'inverted', 'label', 'labelEmpty', 'labelPlot', 'labelPoint', 'labelZoomEnd', 'labelZoomStart', 'legend', 'lineWidth', 'loading', 'loadingLabel', 'locale', 'markSize', 'noAnimation', 'series', 'seriesLabels', 'showLabels', 'showLine', 'showMarks', 'stack', 'subtitle', 'summary', 'tableLabels', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter', 'xAxis', 'yAxis', 'zoom'],
})
export class MdAreaChart {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdMarkerClick', 'mdLineClick', 'mdAreaClick', 'mdAxisClick', 'mdLegendClick', 'mdHover', 'mdReady', 'mdZoom']);
  }
}


import type { MdChartClickDetail as IMdAreaChartMdChartClickDetail } from '@awc-ui/core';
import type { MdChartSeries as IMdAreaChartMdChartSeries } from '@awc-ui/core';
import type { MdChartAxisClickDetail as IMdAreaChartMdChartAxisClickDetail } from '@awc-ui/core';
import type { MdChartHoverDetail as IMdAreaChartMdChartHoverDetail } from '@awc-ui/core';

export declare interface MdAreaChart extends Components.MdAreaChart {

  mdMarkerClick: EventEmitter<CustomEvent<IMdAreaChartMdChartClickDetail<IMdAreaChartMdChartSeries>>>;
  /**
   * Fires when a series' drawn line is clicked *between* its data points (a
click on a point emits `mdMarkerClick` instead).
   */
  mdLineClick: EventEmitter<CustomEvent<IMdAreaChartMdChartClickDetail<IMdAreaChartMdChartSeries>>>;
  /**
   * Fires when a series' filled area is clicked — the band between its line
and its base (its own band when stacked), excluding its line and points.
   */
  mdAreaClick: EventEmitter<CustomEvent<IMdAreaChartMdChartClickDetail<IMdAreaChartMdChartSeries>>>;
  /**
   * Fires when the plot background is clicked (inside the plot, but not on a
mark, line or area): the nearest x plus every visible series' value there.
   */
  mdAxisClick: EventEmitter<CustomEvent<IMdAreaChartMdChartAxisClickDetail>>;

  mdLegendClick: EventEmitter<CustomEvent<{ seriesIndex: number; seriesId?: string; selected: boolean }>>;

  mdHover: EventEmitter<CustomEvent<IMdAreaChartMdChartHoverDetail>>;

  mdReady: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the zoom window changes (drag, slider or `setZoom`/`resetZoom`).
   */
  mdZoom: EventEmitter<CustomEvent<{ startIndex: number; endIndex: number; reset: boolean }>>;
}


@ProxyCmp({
  inputs: ['chipPosition', 'clearIcon', 'clearOnBlur', 'clearable', 'density', 'disableCloseOnSelect', 'disabled', 'dropdownIcon', 'error', 'errorText', 'filterMode', 'filterer', 'freeSolo', 'inputValue', 'label', 'limitResults', 'loading', 'loadingText', 'matchTriggerWidth', 'maxHeight', 'maxSelected', 'multiple', 'name', 'noOptionsText', 'noResultsText', 'open', 'options', 'placeholder', 'placement', 'required', 'reserveSupportingSpace', 'rowHeight', 'softDisabled', 'statusTemplate', 'supportingText', 'value', 'valueMissingLabel', 'variant', 'virtualize'],
  methods: ['focusInput', 'showMenu', 'closeMenu', 'loadOptions', 'getLabels', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']
})
@Component({
  selector: 'md-autocomplete',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['chipPosition', 'clearIcon', 'clearOnBlur', 'clearable', 'density', 'disableCloseOnSelect', 'disabled', 'dropdownIcon', 'error', 'errorText', 'filterMode', 'filterer', 'freeSolo', 'inputValue', 'label', 'limitResults', 'loading', 'loadingText', 'matchTriggerWidth', 'maxHeight', 'maxSelected', 'multiple', 'name', 'noOptionsText', 'noResultsText', 'open', 'options', 'placeholder', 'placement', 'required', 'reserveSupportingSpace', 'rowHeight', 'softDisabled', 'statusTemplate', 'supportingText', 'value', 'valueMissingLabel', 'variant', 'virtualize'],
})
export class MdAutocomplete {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdInput', 'mdOpen', 'mdClose', 'mdClear', 'mdValidityChange']);
  }
}


export declare interface MdAutocomplete extends Components.MdAutocomplete {
  /**
   * Fires whenever the committed selection changes.
   */
  mdChange: EventEmitter<CustomEvent<string | string[]>>;
  /**
   * Fires whenever the live input string changes.
   */
  mdInput: EventEmitter<CustomEvent<string>>;
  /**
   * Fires when the menu opens.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the menu closes.
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the user clears the value.
   */
  mdClear: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['alt', 'colorFromName', 'crossorigin', 'density', 'initials', 'label', 'loading', 'name', 'shape', 'size', 'src']
})
@Component({
  selector: 'md-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['alt', 'colorFromName', 'crossorigin', 'density', 'initials', 'label', 'loading', 'name', 'shape', 'size', 'src'],
})
export class MdAvatar {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdLoad', 'mdError']);
  }
}


export declare interface MdAvatar extends Components.MdAvatar {
  /**
   * Image successfully loaded.
   */
  mdLoad: EventEmitter<CustomEvent<{ src: string }>>;
  /**
   * Image failed to load — component fell back to initials/icon.
   */
  mdError: EventEmitter<CustomEvent<{ src: string }>>;
}


@ProxyCmp({
  inputs: ['density', 'icon', 'max', 'value', 'variant']
})
@Component({
  selector: 'md-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'icon', 'max', 'value', 'variant'],
})
export class MdBadge {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdBadge extends Components.MdBadge {}


@ProxyCmp({
  inputs: ['animation', 'animationDuration', 'axisTicks', 'barGap', 'barWidth', 'categoryGap', 'chevron', 'clickable', 'cornerRadius', 'density', 'heightProp', 'label', 'labelPlot', 'labelPoint', 'labelZoomEnd', 'labelZoomStart', 'layout', 'legend', 'loading', 'loadingLabel', 'locale', 'noAnimation', 'polar', 'polarHole', 'polarSweep', 'series', 'showLabels', 'showTotals', 'stack', 'subtitle', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter', 'xAxis', 'yAxis', 'yAxis2', 'zoom'],
  methods: ['resize', 'replay', 'drill', 'toDataURL', 'getInstance', 'setZoom', 'resetZoom']
})
@Component({
  selector: 'md-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['animation', 'animationDuration', 'axisTicks', 'barGap', 'barWidth', 'categoryGap', 'chevron', 'clickable', 'cornerRadius', 'density', 'heightProp', 'label', 'labelPlot', 'labelPoint', 'labelZoomEnd', 'labelZoomStart', 'layout', 'legend', 'loading', 'loadingLabel', 'locale', 'noAnimation', 'polar', 'polarHole', 'polarSweep', 'series', 'showLabels', 'showTotals', 'stack', 'subtitle', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter', 'xAxis', 'yAxis', 'yAxis2', 'zoom'],
})
export class MdBarChart {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdBarClick', 'mdLegendClick', 'mdHover', 'mdReady', 'mdZoom']);
  }
}


import type { MdChartClickDetail as IMdBarChartMdChartClickDetail } from '@awc-ui/core';
import type { MdChartSeries as IMdBarChartMdChartSeries } from '@awc-ui/core';
import type { MdChartHoverDetail as IMdBarChartMdChartHoverDetail } from '@awc-ui/core';

export declare interface MdBarChart extends Components.MdBarChart {

  mdBarClick: EventEmitter<CustomEvent<IMdBarChartMdChartClickDetail<IMdBarChartMdChartSeries>>>;

  mdLegendClick: EventEmitter<CustomEvent<{ seriesIndex: number; seriesId?: string; selected: boolean }>>;

  mdHover: EventEmitter<CustomEvent<IMdBarChartMdChartHoverDetail>>;

  mdReady: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the zoom window changes (drag, slider, or `setZoom`/`resetZoom`).
   */
  mdZoom: EventEmitter<CustomEvent<{ startIndex: number; endIndex: number; reset: boolean }>>;
}


@ProxyCmp({
  inputs: ['bottomDivider', 'closeable', 'contentAlign', 'density', 'headline', 'headlineAlign', 'open', 'scrimDismissible', 'scrollShadow', 'sheetAriaLabel', 'showDragHandle', 'topDivider', 'variant'],
  methods: ['show', 'close']
})
@Component({
  selector: 'md-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['bottomDivider', 'closeable', 'contentAlign', 'density', 'headline', 'headlineAlign', 'open', 'scrimDismissible', 'scrollShadow', 'sheetAriaLabel', 'showDragHandle', 'topDivider', 'variant'],
})
export class MdBottomSheet {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdOpen', 'mdClose', 'mdCancel']);
  }
}


export declare interface MdBottomSheet extends Components.MdBottomSheet {
  /**
   * Emits when the sheet opens
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the sheet closes
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when dismissed via scrim click, Escape, drag, or close button
   */
  mdCancel: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['collapsed', 'current', 'density', 'disabled', 'href', 'icon', 'itemIndex', 'itemTotal', 'rel', 'target']
})
@Component({
  selector: 'md-breadcrumb-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['collapsed', 'current', 'density', 'disabled', 'href', 'icon', 'itemIndex', 'itemTotal', 'rel', 'target'],
})
export class MdBreadcrumbItem {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSelect']);
  }
}


import type { MdBreadcrumbSelectDetail as IMdBreadcrumbItemMdBreadcrumbSelectDetail } from '@awc-ui/core';

export declare interface MdBreadcrumbItem extends Components.MdBreadcrumbItem {
  /**
   * Fires when the user activates a navigable crumb — i.e. when an item with
a non-empty `href` (and not marked `current` / `disabled`) is clicked or
activated with `Enter` while focused. The event is **cancelable**:
call `event.preventDefault()` from the listener to stop the browser's
default navigation. This is the recommended hook for SPA routing — let
the breadcrumb render a real `<a>` (so right-click / middle-click /
"Open in new tab" still work), then intercept `mdSelect` to push the
route through your client-side router instead of a full page reload.

The event bubbles, so consumers can attach a single listener on the
parent `<md-breadcrumbs>` for delegation. The event is composed, so
listeners outside the shadow tree (the typical case) receive it.

```ts
document.querySelector('md-breadcrumbs')!
  .addEventListener('mdSelect', (e) => {
    const { href, label, itemIndex } = (e as CustomEvent).detail;
    e.preventDefault();              // stop the <a> from navigating
    myRouter.push(href);             // SPA navigation
  });
```
   */
  mdSelect: EventEmitter<CustomEvent<IMdBreadcrumbItemMdBreadcrumbSelectDetail>>;
}


@ProxyCmp({
  inputs: ['density', 'expandLabel', 'itemsAfterCollapse', 'itemsBeforeCollapse', 'label', 'maxItems', 'separator'],
  methods: ['expand', 'collapse']
})
@Component({
  selector: 'md-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'expandLabel', 'itemsAfterCollapse', 'itemsBeforeCollapse', 'label', 'maxItems', 'separator'],
})
export class MdBreadcrumbs {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdExpand']);
  }
}


import type { MdBreadcrumbsExpandDetail as IMdBreadcrumbsMdBreadcrumbsExpandDetail } from '@awc-ui/core';

export declare interface MdBreadcrumbs extends Components.MdBreadcrumbs {
  /**
   * Fires when the user reveals the full breadcrumb trail by activating
the overflow ("…") toggle, or when consumers programmatically call
`expand()` / `collapse()`. Not cancelable — the visibility change
has already happened. Use it for analytics or to react to a user
who wants to see the full path.

Bubbles + composed, so consumers outside the shadow tree (the typical
case) receive it.
   */
  mdExpand: EventEmitter<CustomEvent<IMdBreadcrumbsMdBreadcrumbsExpandDetail>>;
}


@ProxyCmp({
  inputs: ['density', 'disabled', 'fullWidth', 'href', 'icon', 'loading', 'mirrorIcon', 'ripple', 'roleOverride', 'selected', 'shape', 'shapeMorph', 'size', 'softDisabled', 'suppressExpandIconFlip', 'target', 'toggle', 'trailingIcon', 'type', 'variant']
})
@Component({
  selector: 'md-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'disabled', 'fullWidth', 'href', 'icon', 'loading', 'mirrorIcon', 'ripple', 'roleOverride', 'selected', 'shape', 'shapeMorph', 'size', 'softDisabled', 'suppressExpandIconFlip', 'target', 'toggle', 'trailingIcon', 'type', 'variant'],
})
export class MdButton {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick', 'mdChange']);
  }
}


import type { MdButtonClickDetail as IMdButtonMdButtonClickDetail } from '@awc-ui/core';
import type { MdButtonChangeDetail as IMdButtonMdButtonChangeDetail } from '@awc-ui/core';

export declare interface MdButton extends Components.MdButton {
  /**
   * Fires every time the user activates the button (mouse click, touch,
or `Enter`/`Space` while focused). The event is **cancelable** and
the detail payload describes what *would* happen: the post-click
toggle state, the navigation `href`, and so on.

Calling `event.preventDefault()` from a listener suppresses the
default side effects (toggle flip + `href` navigation) but lets
the underlying DOM click bubble. This is the hook to use for SPA
routing, "are you sure?" prompts, async confirmation, etc.

The event bubbles and is composed, so listeners outside the
shadow tree (the typical case) receive it.

```ts
document.querySelector('md-button')!.addEventListener('mdClick', (e) => {
  const { href, selected } = (e as CustomEvent).detail;
  if (!confirm('Continue?')) e.preventDefault();
});
```
   */
  mdClick: EventEmitter<CustomEvent<IMdButtonMdButtonClickDetail>>;
  /**
   * Fires when toggle mode flips the `selected` state in response to a
user activation. Not cancelable — the state change has already
happened. Pair with `mdClick` (cancelable) when you need a veto.

Bubbles and is composed.
   */
  mdChange: EventEmitter<CustomEvent<IMdButtonMdButtonChangeDetail>>;
}


@ProxyCmp({
  inputs: ['density', 'fullWidth', 'required', 'selectionMode', 'shape', 'size', 'variant']
})
@Component({
  selector: 'md-button-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'fullWidth', 'required', 'selectionMode', 'shape', 'size', 'variant'],
})
export class MdButtonGroup {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSelectionChange']);
  }
}


import type { MdButtonGroupChangeDetail as IMdButtonGroupMdButtonGroupChangeDetail } from '@awc-ui/core';

export declare interface MdButtonGroup extends Components.MdButtonGroup {
  /**
   * Fires every time a user activation toggles the selection state of
a child button. The detail object describes both the new selection
snapshot (`values`) and the diff from the previous selection
(`added`, `removed`), plus the underlying `originalEvent`.

Distinct from each child button's own `mdChange` (which fires per
individual button toggle); the group's `mdSelectionChange` fires
once per user activation and reports the *group-level* state.

Bubbles and is composed so listeners outside the shadow tree
receive it. @example ```ts
group.addEventListener('mdSelectionChange', (e: CustomEvent<MdButtonGroupChangeDetail>) => {
  console.log('now selected:', e.detail.values);
  console.log('just added:', e.detail.added);
  console.log('just removed:', e.detail.removed);
});
```
   */
  mdSelectionChange: EventEmitter<CustomEvent<IMdButtonGroupMdButtonGroupChangeDetail>>;
}


@ProxyCmp({
  inputs: ['density', 'disabled', 'dragEnabled', 'fullHeight', 'fullWidth', 'interactive', 'ripple', 'softDisabled', 'variant']
})
@Component({
  selector: 'md-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'disabled', 'dragEnabled', 'fullHeight', 'fullWidth', 'interactive', 'ripple', 'softDisabled', 'variant'],
})
export class MdCard {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick', 'mdDragStart', 'mdDragMove', 'mdDragEnd']);
  }
}


import type { MdCardDragDetail as IMdCardMdCardDragDetail } from '@awc-ui/core';

export declare interface MdCard extends Components.MdCard {
  /**
   * Emits when an interactive card is clicked or activated via keyboard
   */
  mdClick: EventEmitter<CustomEvent<MouseEvent>>;
  /**
   * Emits once when a draggable card starts being dragged (after crossing the movement threshold)
   */
  mdDragStart: EventEmitter<CustomEvent<IMdCardMdCardDragDetail>>;
  /**
   * Emits continuously as a dragged card moves — use for drop-zone detection or position tracking
   */
  mdDragMove: EventEmitter<CustomEvent<IMdCardMdCardDragDetail>>;
  /**
   * Emits when a draggable card is released after dragging
   */
  mdDragEnd: EventEmitter<CustomEvent<IMdCardMdCardDragDetail>>;
}


@ProxyCmp({
  inputs: ['checked', 'density', 'disabled', 'error', 'errorText', 'indeterminate', 'name', 'required', 'softDisabled', 'supportingText', 'value', 'valueMissingLabel'],
  methods: ['getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']
})
@Component({
  selector: 'md-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['checked', 'density', 'disabled', 'error', 'errorText', 'indeterminate', 'name', 'required', 'softDisabled', 'supportingText', 'value', 'valueMissingLabel'],
})
export class MdCheckbox {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdValidityChange']);
  }
}


export declare interface MdCheckbox extends Components.MdCheckbox {
  /**
   * Emits when checked or indeterminate state changes
   */
  mdChange: EventEmitter<CustomEvent<{ checked: boolean; indeterminate: boolean }>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['appearance', 'color', 'density', 'disabled', 'elevated', 'icon', 'label', 'removable', 'selectable', 'selected', 'softDisabled', 'trailingIcon', 'variant']
})
@Component({
  selector: 'md-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['appearance', 'color', 'density', 'disabled', 'elevated', 'icon', 'label', 'removable', 'selectable', 'selected', 'softDisabled', 'trailingIcon', 'variant'],
})
export class MdChip {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick', 'mdSelect', 'mdRemove']);
  }
}


export declare interface MdChip extends Components.MdChip {
  /**
   * Emits when the chip is clicked or activated via keyboard
   */
  mdClick: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the selected state changes (filter/input)
   */
  mdSelect: EventEmitter<CustomEvent<{ selected: boolean }>>;
  /**
   * Fires when the trailing remove ("✕") button is activated on a removable
chip (by click, Enter, Space, Delete, or Backspace).

The event is **cancelable**: by default, after `mdRemove` is dispatched
the chip removes itself from the DOM. Call `event.preventDefault()` in a
handler to keep the chip mounted (e.g. when your state layer owns the
list and will re-render with the chip gone).
   */
  mdRemove: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['alpha', 'ariaLabelProp', 'density', 'disabled', 'dismissOnOutsideClick', 'format', 'open', 'presets', 'showHex', 'showInputs', 'value', 'variant'],
  methods: ['show', 'close']
})
@Component({
  selector: 'md-color-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['alpha', 'ariaLabelProp', 'density', 'disabled', 'dismissOnOutsideClick', 'format', 'open', 'presets', 'showHex', 'showInputs', 'value', 'variant'],
})
export class MdColorPicker {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdInput', 'mdChange', 'mdOpenChange']);
  }
}


export declare interface MdColorPicker extends Components.MdColorPicker {
  /**
   * Emitted on every change while the user drags / types.
   */
  mdInput: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Emitted when the user commits a value (release pointer, blur input,
Enter, or click a preset).
   */
  mdChange: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Emitted when the popover opens or closes.
   */
  mdOpenChange: EventEmitter<CustomEvent<{ open: boolean }>>;
}


@ProxyCmp({
  inputs: ['calendarIcon', 'cancelLabel', 'chooseMonthAndYearLabel', 'chooseMonthLabel', 'chooseMonthYearLabel', 'chooseYearLabel', 'clearLabel', 'clearable', 'closeCalendarLabel', 'commitOnSelect', 'dateSeparator', 'density', 'disabled', 'enterDatesLabel', 'error', 'errorText', 'fieldVariant', 'firstDayOfWeek', 'headline', 'invalidDateLabel', 'isDateDisabled', 'label', 'locale', 'max', 'min', 'name', 'nextMonthLabel', 'nextYearLabel', 'okLabel', 'open', 'openCalendarLabel', 'outsideClickDismissible', 'placeholder', 'previousMonthLabel', 'previousYearLabel', 'required', 'reserveSupportingSpace', 'scrimDismissible', 'selectDateLabel', 'supportingText', 'toggleCalendarLabel', 'toggleTextLabel', 'value', 'valueMissingLabel', 'variant', 'yearGridLabel'],
  methods: ['show', 'close', 'clear', 'focusInput', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']
})
@Component({
  selector: 'md-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['calendarIcon', 'cancelLabel', 'chooseMonthAndYearLabel', 'chooseMonthLabel', 'chooseMonthYearLabel', 'chooseYearLabel', 'clearLabel', 'clearable', 'closeCalendarLabel', 'commitOnSelect', 'dateSeparator', 'density', 'disabled', 'enterDatesLabel', 'error', 'errorText', 'fieldVariant', 'firstDayOfWeek', 'headline', 'invalidDateLabel', 'isDateDisabled', 'label', 'locale', 'max', 'min', 'name', 'nextMonthLabel', 'nextYearLabel', 'okLabel', 'open', 'openCalendarLabel', 'outsideClickDismissible', 'placeholder', 'previousMonthLabel', 'previousYearLabel', 'required', 'reserveSupportingSpace', 'scrimDismissible', 'selectDateLabel', 'supportingText', 'toggleCalendarLabel', 'toggleTextLabel', 'value', 'valueMissingLabel', 'variant', 'yearGridLabel'],
})
export class MdDatePicker {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdSelected', 'mdInput', 'mdOpen', 'mdClose', 'mdCancel', 'mdViewChange', 'mdMenuOpen', 'mdMenuSelect', 'mdModeChange', 'mdValidityChange']);
  }
}


import type { MdDatePickerChangeDetail as IMdDatePickerMdDatePickerChangeDetail } from '@awc-ui/core';
import type { MdDatePickerSelectedDetail as IMdDatePickerMdDatePickerSelectedDetail } from '@awc-ui/core';
import type { MdDatePickerViewChangeDetail as IMdDatePickerMdDatePickerViewChangeDetail } from '@awc-ui/core';
import type { MdDatePickerMenuOpenDetail as IMdDatePickerMdDatePickerMenuOpenDetail } from '@awc-ui/core';
import type { MdDatePickerMenuSelectDetail as IMdDatePickerMdDatePickerMenuSelectDetail } from '@awc-ui/core';
import type { MdDatePickerModeChangeDetail as IMdDatePickerMdDatePickerModeChangeDetail } from '@awc-ui/core';

export declare interface MdDatePicker extends Components.MdDatePicker {
  /**
   * Emitted when the user commits a selection.
   */
  mdChange: EventEmitter<CustomEvent<IMdDatePickerMdDatePickerChangeDetail>>;
  /**
   * Emitted when the user selects a day in the calendar (click or keyboard).
   */
  mdSelected: EventEmitter<CustomEvent<IMdDatePickerMdDatePickerSelectedDetail>>;
  /**
   * Emitted on every keystroke in a text-entry field.
   */
  mdInput: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Emitted when the picker opens.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emitted when the picker closes for any reason.
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Emitted when the user dismisses without committing (scrim, Cancel, Esc).
   */
  mdCancel: EventEmitter<CustomEvent<void>>;
  /**
   * Emitted when the displayed calendar month/year changes from user navigation.
   */
  mdViewChange: EventEmitter<CustomEvent<IMdDatePickerMdDatePickerViewChangeDetail>>;
  /**
   * Emitted when the user opens the month or year selection menu / grid.
   */
  mdMenuOpen: EventEmitter<CustomEvent<IMdDatePickerMdDatePickerMenuOpenDetail>>;
  /**
   * Emitted when the user picks a month or year from a selection menu / grid.
   */
  mdMenuSelect: EventEmitter<CustomEvent<IMdDatePickerMdDatePickerMenuSelectDetail>>;
  /**
   * Emitted when the user toggles between calendar and typed-entry views.
   */
  mdModeChange: EventEmitter<CustomEvent<IMdDatePickerMdDatePickerModeChangeDetail>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['cancelLabel', 'closeLabel', 'density', 'divider', 'fullscreen', 'headerDivider', 'headline', 'icon', 'locale', 'okLabel', 'open', 'scrimDismissible'],
  methods: ['show', 'close']
})
@Component({
  selector: 'md-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['cancelLabel', 'closeLabel', 'density', 'divider', 'fullscreen', 'headerDivider', 'headline', 'icon', 'locale', 'okLabel', 'open', 'scrimDismissible'],
})
export class MdDialog {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdOpen', 'mdClose', 'mdCancel']);
  }
}


export declare interface MdDialog extends Components.MdDialog {
  /**
   * Emits when the dialog opens
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the dialog closes
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when dismissed via scrim or Escape
   */
  mdCancel: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['inset', 'insetEnd', 'insetStart', 'vertical']
})
@Component({
  selector: 'md-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['inset', 'insetEnd', 'insetStart', 'vertical'],
})
export class MdDivider {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdDivider extends Components.MdDivider {}


@ProxyCmp({
  inputs: ['density', 'disabled', 'extended', 'icon', 'label', 'lowered', 'ripple', 'size', 'softDisabled', 'variant']
})
@Component({
  selector: 'md-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'disabled', 'extended', 'icon', 'label', 'lowered', 'ripple', 'size', 'softDisabled', 'variant'],
})
export class MdFab {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick']);
  }
}


export declare interface MdFab extends Components.MdFab {
  /**
   * Fires when the user activates the FAB (mouse click, touch, or
`Enter`/`Space` while focused). Not emitted when `disabled` or
`soft-disabled`. Bubbles and is composed so a delegated listener
on a parent element works.

```ts
document.querySelector('md-fab')!.addEventListener('mdClick', (e) => {
  const mouseEvent = (e as CustomEvent<MouseEvent>).detail;
  console.log('FAB clicked at', mouseEvent.clientX, mouseEvent.clientY);
});
```
   */
  mdClick: EventEmitter<CustomEvent<MouseEvent>>;
}


@ProxyCmp({
  inputs: ['anchor', 'density', 'menuLabel', 'open', 'placement', 'quick', 'variant'],
  methods: ['show', 'close']
})
@Component({
  selector: 'md-fab-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['anchor', 'density', 'menuLabel', 'open', 'placement', 'quick', 'variant'],
})
export class MdFabMenu {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdOpen', 'mdClose']);
  }
}


export declare interface MdFabMenu extends Components.MdFabMenu {
  /**
   * Fires when the menu opens.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the menu closes.
   */
  mdClose: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['density', 'disabled', 'icon', 'label', 'rovingFocusVisible', 'softDisabled']
})
@Component({
  selector: 'md-fab-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'disabled', 'icon', 'label', 'rovingFocusVisible', 'softDisabled'],
})
export class MdFabMenuItem {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick']);
  }
}


export declare interface MdFabMenuItem extends Components.MdFabMenuItem {
  /**
   * Fires when the item is activated.
   */
  mdClick: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['buttonWidth', 'density', 'disabled', 'href', 'icon', 'ripple', 'selected', 'selectedIcon', 'shape', 'shapeMorph', 'size', 'softDisabled', 'target', 'toggle', 'variant']
})
@Component({
  selector: 'md-icon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['buttonWidth', 'density', 'disabled', 'href', 'icon', 'ripple', 'selected', 'selectedIcon', 'shape', 'shapeMorph', 'size', 'softDisabled', 'target', 'toggle', 'variant'],
})
export class MdIconButton {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick']);
  }
}


export declare interface MdIconButton extends Components.MdIconButton {
  /**
   * Fires on pointer or keyboard activation. Detail includes toggle `selected` state.
   */
  mdClick: EventEmitter<CustomEvent<{ selected: boolean }>>;
}


@ProxyCmp({
  inputs: ['animation', 'animationDuration', 'area', 'axisTicks', 'connectNulls', 'curve', 'density', 'grid', 'heightProp', 'inverted', 'label', 'labelEmpty', 'labelPlot', 'labelPoint', 'labelZoomEnd', 'labelZoomStart', 'legend', 'lineWidth', 'loading', 'loadingLabel', 'locale', 'markLines', 'markSize', 'noAnimation', 'series', 'seriesLabels', 'showLabels', 'showLine', 'showMarks', 'stack', 'subtitle', 'summary', 'tableLabels', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter', 'xAxis', 'yAxes', 'yAxis', 'zoom'],
  methods: ['resize', 'replay', 'toDataURL', 'getInstance', 'setZoom', 'resetZoom']
})
@Component({
  selector: 'md-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['animation', 'animationDuration', 'area', 'axisTicks', 'connectNulls', 'curve', 'density', 'grid', 'heightProp', 'inverted', 'label', 'labelEmpty', 'labelPlot', 'labelPoint', 'labelZoomEnd', 'labelZoomStart', 'legend', 'lineWidth', 'loading', 'loadingLabel', 'locale', 'markLines', 'markSize', 'noAnimation', 'series', 'seriesLabels', 'showLabels', 'showLine', 'showMarks', 'stack', 'subtitle', 'summary', 'tableLabels', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter', 'xAxis', 'yAxes', 'yAxis', 'zoom'],
})
export class MdLineChart {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdMarkerClick', 'mdLineClick', 'mdAreaClick', 'mdAxisClick', 'mdLegendClick', 'mdHover', 'mdReady', 'mdZoom']);
  }
}


import type { MdChartClickDetail as IMdLineChartMdChartClickDetail } from '@awc-ui/core';
import type { MdChartXYSeries as IMdLineChartMdChartXYSeries } from '@awc-ui/core';
import type { MdChartAxisClickDetail as IMdLineChartMdChartAxisClickDetail } from '@awc-ui/core';
import type { MdChartHoverDetail as IMdLineChartMdChartHoverDetail } from '@awc-ui/core';

export declare interface MdLineChart extends Components.MdLineChart {
  /**
   * Fires on marker click. `dataIndex` addresses the clicked series' own
`data` array (its point index, for series that carry their own x).
   */
  mdMarkerClick: EventEmitter<CustomEvent<IMdLineChartMdChartClickDetail<IMdLineChartMdChartXYSeries>>>;
  /**
   * Fires when a series' drawn line is clicked *between* its data points (a
click on a point emits `mdMarkerClick` instead). `dataIndex` is the point
the click is nearest along x.
   */
  mdLineClick: EventEmitter<CustomEvent<IMdLineChartMdChartClickDetail<IMdLineChartMdChartXYSeries>>>;
  /**
   * Fires when a series' filled area is clicked (`area` charts only) — the
region between that series' line and its baseline, excluding its line and
points. `dataIndex` is the point the click is nearest along x.
   */
  mdAreaClick: EventEmitter<CustomEvent<IMdLineChartMdChartClickDetail<IMdLineChartMdChartXYSeries>>>;
  /**
   * Fires when the plot background is clicked (inside the plot, but not on a
mark, line or area): the nearest x position plus every visible series'
value there.
   */
  mdAxisClick: EventEmitter<CustomEvent<IMdLineChartMdChartAxisClickDetail>>;
  /**
   * Fires when a legend entry is clicked.
   */
  mdLegendClick: EventEmitter<CustomEvent<{ seriesIndex: number; seriesId?: string; selected: boolean }>>;
  /**
   * Fires (throttled to rAF) as the pointer crosses the plot.
   */
  mdHover: EventEmitter<CustomEvent<IMdLineChartMdChartHoverDetail>>;
  /**
   * Fires after the chart finishes its initial render.
   */
  mdReady: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the zoom window changes (drag, slider or `setZoom`/`resetZoom`).
   */
  mdZoom: EventEmitter<CustomEvent<{ startIndex: number; endIndex: number; reset: boolean }>>;
}


@ProxyCmp({
  inputs: ['density', 'interactionMode', 'label', 'labelledby', 'listStyle', 'reorderable', 'roleOverride', 'selectionMode'],
  methods: ['activateNext', 'activatePrevious', 'selectItem', 'getSelectedIndices']
})
@Component({
  selector: 'md-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'interactionMode', 'label', 'labelledby', 'listStyle', 'reorderable', 'roleOverride', 'selectionMode'],
})
export class MdList {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSelect', 'mdActivate', 'mdReorder']);
  }
}


import type { MdListSelectDetail as IMdListMdListSelectDetail } from '@awc-ui/core';

export declare interface MdList extends Components.MdList {
  /**
   * Emitted when selection changes via user input (click / Enter / Space).
   */
  mdSelect: EventEmitter<CustomEvent<IMdListMdListSelectDetail>>;
  /**
   * Emitted whenever roving focus lands on a different row.
   */
  mdActivate: EventEmitter<CustomEvent<{ index: number; item: HTMLMdListItemElement }>>;
  /**
   * Emitted after a drag (or keyboard) reorder completes.

- `from` / `to`: the moved row's old and new positions (item indices,
  ignoring non-item children like dividers).
- `order`: the new order expressed as the original (as-authored) indices,
  so `order[newPosition] === originalPosition`. Use it to reorder a
  backing data array in one pass.
   */
  mdReorder: EventEmitter<CustomEvent<{ from: number; to: number; order: number[] }>>;
}


@ProxyCmp({
  inputs: ['containerRole', 'density', 'disabled', 'expandable', 'expanded', 'headline', 'href', 'interactionMode', 'leadingAvatar', 'leadingAvatarAlt', 'leadingAvatarLabel', 'leadingAvatarName', 'leadingIcon', 'leadingImage', 'leadingImageAlt', 'lines', 'overline', 'reorderable', 'rovingFocusVisible', 'selected', 'selectionMode', 'softDisabled', 'supportingText', 'tabbable', 'target', 'trailingIcon', 'trailingSupportingText', 'type'],
  methods: ['setFocus', 'focusItem', 'toggle', 'expand', 'collapse']
})
@Component({
  selector: 'md-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['containerRole', 'density', 'disabled', 'expandable', 'expanded', 'headline', 'href', 'interactionMode', 'leadingAvatar', 'leadingAvatarAlt', 'leadingAvatarLabel', 'leadingAvatarName', 'leadingIcon', 'leadingImage', 'leadingImageAlt', 'lines', 'overline', 'reorderable', 'rovingFocusVisible', 'selected', 'selectionMode', 'softDisabled', 'supportingText', 'tabbable', 'target', 'trailingIcon', 'trailingSupportingText', 'type'],
})
export class MdListItem {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick', 'mdItemClick', 'mdItemSelect', 'mdRequestActivation', 'mdItemRequestReorder', 'mdExpand']);
  }
}


import type { MdListItemExpandDetail as IMdListItemMdListItemExpandDetail } from '@awc-ui/core';

export declare interface MdListItem extends Components.MdListItem {
  /**
   * Fired when an interactive row is activated (click, Enter, or Space).
   */
  mdClick: EventEmitter<CustomEvent<{ item: HTMLElement }>>;
  /**
   * Bubbles to parent `md-list` so it can manage selection state.
   */
  mdItemClick: EventEmitter<CustomEvent<{ index: number; selected: boolean }>>;
  /**
   * Bubbles to parent `md-list` when an `expanded-content` child row is
selected. The list re-emits `mdSelect` with the parent's list index,
`childIndex`, `expanded`, and the child in `item`.
   */
  mdItemSelect: EventEmitter<CustomEvent<{ index: number; value: string; selected: boolean; item: HTMLMdListItemElement; }>>;
  /**
   * Asks the parent `md-list` to give this row roving focus.
   */
  mdRequestActivation: EventEmitter<CustomEvent<void>>;
  /**
   * Internal event the parent `md-list` listens to for keyboard reordering
(`Alt + ArrowUp / ArrowDown`). Bubbles + composed so it crosses the
shadow boundary up to the list.
   */
  mdItemRequestReorder: EventEmitter<CustomEvent<{ direction: 'up' | 'down'; from: number; }>>;
  /**
   * Fires whenever the expanded state of an expandable row changes.
   */
  mdExpand: EventEmitter<CustomEvent<IMdListItemMdListItemExpandDetail>>;
}


@ProxyCmp({
  inputs: ['density', 'label', 'variant']
})
@Component({
  selector: 'md-loading-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'label', 'variant'],
})
export class MdLoadingIndicator {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdLoadingIndicator extends Components.MdLoadingIndicator {}


@ProxyCmp({
  inputs: ['anchor', 'autoFocus', 'density', 'emptyText', 'layout', 'listLabel', 'listbox', 'matchAnchorWidth', 'maxHeight', 'open', 'persistent', 'placement', 'quick', 'responsive', 'useGap', 'variant'],
  methods: ['setComboboxElement', 'setVirtualProvider', 'getScrollViewport', 'show', 'reposition', 'close']
})
@Component({
  selector: 'md-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['anchor', 'autoFocus', 'density', 'emptyText', 'layout', 'listLabel', 'listbox', 'matchAnchorWidth', 'maxHeight', 'open', 'persistent', 'placement', 'quick', 'responsive', 'useGap', 'variant'],
})
export class MdMenu {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdOpen', 'mdClose']);
  }
}


export declare interface MdMenu extends Components.MdMenu {
  /**
   * Fires when the menu opens. Scoped to the menu element: `bubbles: false`
stops it climbing the light-DOM tree, and `composed: false` stops it
escaping the shadow root of a host that embeds this menu (md-select,
md-multi-select, md-date-picker …). Without `composed: false` a
`composed` event still surfaces at the embedding host as an
`AT_TARGET` event — so a consumer's `mdOpen` listener on the wrapper
would fire for both the wrapper's own event and this inner one
(duplicate open/close). Wrappers listen via `onMdOpen` on the menu
element itself, which still fires regardless.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the menu closes. Scoped like `mdOpen` — see its note.
   */
  mdClose: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['badge', 'checkPosition', 'density', 'disabled', 'divider', 'gap', 'headline', 'indeterminate', 'keepOpen', 'presentation', 'roleOverride', 'selected', 'supportingText', 'trailingText', 'type']
})
@Component({
  selector: 'md-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['badge', 'checkPosition', 'density', 'disabled', 'divider', 'gap', 'headline', 'indeterminate', 'keepOpen', 'presentation', 'roleOverride', 'selected', 'supportingText', 'trailingText', 'type'],
})
export class MdMenuItem {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick']);
  }
}


export declare interface MdMenuItem extends Components.MdMenuItem {
  /**
   * Fires when the item is activated.
   */
  mdClick: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['density', 'label']
})
@Component({
  selector: 'md-menu-item-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'label'],
})
export class MdMenuItemGroup {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdMenuItemGroup extends Components.MdMenuItemGroup {}


@ProxyCmp({
  inputs: ['color', 'density', 'formatOptions', 'label', 'locale', 'max', 'min', 'showLabel', 'showValue', 'size', 'thickness', 'value', 'valueText', 'variant']
})
@Component({
  selector: 'md-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['color', 'density', 'formatOptions', 'label', 'locale', 'max', 'min', 'showLabel', 'showValue', 'size', 'thickness', 'value', 'valueText', 'variant'],
})
export class MdMeter {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdMeter extends Components.MdMeter {}


@ProxyCmp({
  inputs: ['chipOverflow', 'chipPosition', 'clearIcon', 'clearLabel', 'clearable', 'countFormatter', 'density', 'disabled', 'displayMode', 'dropdownIcon', 'error', 'errorText', 'filterLabel', 'filterMode', 'filterable', 'label', 'loading', 'loadingText', 'matchTriggerWidth', 'maxHeight', 'maxSelected', 'name', 'noOptionsText', 'noResultsText', 'open', 'options', 'placeholder', 'placement', 'required', 'reserveSupportingSpace', 'rowHeight', 'searchPlaceholder', 'searchingLabel', 'selectAllLabel', 'showSelectAll', 'softDisabled', 'supportingText', 'trigger', 'triggerIcon', 'triggerLabel', 'value', 'valueMissingLabel', 'variant', 'virtualize'],
  methods: ['show', 'close', 'focusTrigger', 'reset', 'loadOptions', 'setQuery', 'getLabels', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']
})
@Component({
  selector: 'md-multi-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['chipOverflow', 'chipPosition', 'clearIcon', 'clearLabel', 'clearable', 'countFormatter', 'density', 'disabled', 'displayMode', 'dropdownIcon', 'error', 'errorText', 'filterLabel', 'filterMode', 'filterable', 'label', 'loading', 'loadingText', 'matchTriggerWidth', 'maxHeight', 'maxSelected', 'name', 'noOptionsText', 'noResultsText', 'open', 'options', 'placeholder', 'placement', 'required', 'reserveSupportingSpace', 'rowHeight', 'searchPlaceholder', 'searchingLabel', 'selectAllLabel', 'showSelectAll', 'softDisabled', 'supportingText', 'trigger', 'triggerIcon', 'triggerLabel', 'value', 'valueMissingLabel', 'variant', 'virtualize'],
})
export class MdMultiSelect {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdOpen', 'mdClose', 'mdRemove', 'mdClear', 'mdValidityChange']);
  }
}


export declare interface MdMultiSelect extends Components.MdMultiSelect {
  /**
   * Emits the full selected-value array whenever the selection changes.
   */
  mdChange: EventEmitter<CustomEvent<string[]>>;
  /**
   * Emits when the menu opens.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the menu closes.
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Emits the removed value when a chip is dismissed.
   */
  mdRemove: EventEmitter<CustomEvent<string>>;
  /**
   * Emits when the clear button empties the selection.
   */
  mdClear: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['activeIndex', 'density', 'labelBehavior', 'manualActivation'],
  methods: ['select', 'focusTab']
})
@Component({
  selector: 'md-navigation-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['activeIndex', 'density', 'labelBehavior', 'manualActivation'],
})
export class MdNavigationBar {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange']);
  }
}


export declare interface MdNavigationBar extends Components.MdNavigationBar {
  /**
   * Emitted when the selected destination changes (user click,
keyboard activation, or programmatic `select()` call).
Detail includes both the new and previous indices so listeners
can short-circuit no-op reselects.
   */
  mdChange: EventEmitter<CustomEvent<{ index: number; previousIndex: number }>>;
}


@ProxyCmp({
  inputs: ['activeIndex', 'alignment', 'density', 'disableFocusManagement', 'expandable', 'fullHeight', 'label', 'labelVisibility', 'maxVisible', 'modal', 'orientation', 'overflowIcon', 'overflowLabel', 'toggleLabel', 'variant'],
  methods: ['expand', 'collapse', 'toggle', 'focusTab']
})
@Component({
  selector: 'md-navigation-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['activeIndex', 'alignment', 'density', 'disableFocusManagement', 'expandable', 'fullHeight', 'label', 'labelVisibility', 'maxVisible', 'modal', 'orientation', 'overflowIcon', 'overflowLabel', 'toggleLabel', 'variant'],
})
export class MdNavigationRail {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdTabChange', 'mdExpand', 'mdCollapse']);
  }
}


export declare interface MdNavigationRail extends Components.MdNavigationRail {
  /**
   * Emitted when the user selects a destination.
   */
  mdTabChange: EventEmitter<CustomEvent<{ index: number; value: string }>>;
  /**
   * Emitted when the rail transitions from collapsed → expanded.
   */
  mdExpand: EventEmitter<CustomEvent<void>>;
  /**
   * Emitted when the rail transitions from expanded → collapsed.
   */
  mdCollapse: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['active', 'badge', 'badgeValue', 'density', 'disabled', 'expanded', 'href', 'icon', 'label', 'labelVisibility', 'target', 'value'],
  methods: ['clearSubmenuSelection']
})
@Component({
  selector: 'md-navigation-rail-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['active', 'badge', 'badgeValue', 'density', 'disabled', 'expanded', 'href', 'icon', 'label', 'labelVisibility', 'target', 'value'],
})
export class MdNavigationRailTab {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdTabClick', 'mdSubmenuToggle']);
  }
}


export declare interface MdNavigationRailTab extends Components.MdNavigationRailTab {
  /**
   * Fired when the user activates the destination (click / Enter / Space).
   */
  mdTabClick: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Fired when this destination's slotted dropdown opens or closes. `md-menu`'s
own `mdOpen` / `mdClose` are deliberately non-bubbling and non-composed, so
the rail has no way to hear them — this is the signal it listens for (it
lifts its stacking context so the fixed-position menu is not trapped).
   */
  mdSubmenuToggle: EventEmitter<CustomEvent<{ open: boolean }>>;
}


@ProxyCmp({
  inputs: ['active', 'activeIcon', 'badge', 'badgeMax', 'badgeValue', 'density', 'disabled', 'href', 'icon', 'label', 'labelBehavior', 'softDisabled', 'target'],
  methods: ['focusEl']
})
@Component({
  selector: 'md-navigation-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['active', 'activeIcon', 'badge', 'badgeMax', 'badgeValue', 'density', 'disabled', 'href', 'icon', 'label', 'labelBehavior', 'softDisabled', 'target'],
})
export class MdNavigationTab {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdTabClick']);
  }
}


export declare interface MdNavigationTab extends Components.MdNavigationTab {
  /**
   * Fired when the tab is activated (click, Enter, or Space) and the tab is
not disabled. The parent `md-navigation-bar` listens for this to drive
selection; external code may also listen to detect per-tab activation
(including a re-click of the already-active tab, which does not emit
`mdChange` on the bar).
   */
  mdTabClick: EventEmitter<CustomEvent<{ index: number }>>;
}


@ProxyCmp({
  inputs: ['allowOutOfRange', 'allowWheelScrub', 'decrementLabel', 'density', 'disabled', 'error', 'errorText', 'formatOptions', 'incrementLabel', 'label', 'largeStep', 'locale', 'max', 'min', 'name', 'placeholder', 'readOnly', 'required', 'reserveSupportingSpace', 'smallStep', 'snapOnStep', 'step', 'steppers', 'supportingText', 'value', 'valueMissingLabel', 'variant'],
  methods: ['setFocus', 'select', 'stepUp', 'stepDown', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']
})
@Component({
  selector: 'md-number-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['allowOutOfRange', 'allowWheelScrub', 'decrementLabel', 'density', 'disabled', 'error', 'errorText', 'formatOptions', 'incrementLabel', 'label', 'largeStep', 'locale', 'max', 'min', 'name', 'placeholder', 'readOnly', 'required', 'reserveSupportingSpace', 'smallStep', 'snapOnStep', 'step', 'steppers', 'supportingText', 'value', 'valueMissingLabel', 'variant'],
})
export class MdNumberField {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdInput', 'mdChange', 'mdValidityChange']);
  }
}


import type { MdNumberFieldChangeDetail as IMdNumberFieldMdNumberFieldChangeDetail } from '@awc-ui/core';

export declare interface MdNumberField extends Components.MdNumberField {
  /**
   * Fires on every value change (typing included).
   */
  mdInput: EventEmitter<CustomEvent<IMdNumberFieldMdNumberFieldChangeDetail>>;
  /**
   * Fires at commit points: blur/Enter reformat, stepping, wheel.
   */
  mdChange: EventEmitter<CustomEvent<IMdNumberFieldMdNumberFieldChangeDetail>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites embedding a field would
otherwise hear two events for one logical control; `bubbles: true` still
lets a `<form>` or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['collapseLabel', 'collapsible', 'density', 'expandLabel', 'label', 'nodes', 'orientation', 'selectedIds', 'selectionMode']
})
@Component({
  selector: 'md-organization-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['collapseLabel', 'collapsible', 'density', 'expandLabel', 'label', 'nodes', 'orientation', 'selectedIds', 'selectionMode'],
})
export class MdOrganizationChart {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSelectionChange', 'mdNodeToggle']);
  }
}


import type { OrgChartSelectionChangeDetail as IMdOrganizationChartOrgChartSelectionChangeDetail } from '@awc-ui/core';
import type { OrgChartToggleDetail as IMdOrganizationChartOrgChartToggleDetail } from '@awc-ui/core';

export declare interface MdOrganizationChart extends Components.MdOrganizationChart {
  /**
   * Fired when the selection changes.
   */
  mdSelectionChange: EventEmitter<CustomEvent<IMdOrganizationChartOrgChartSelectionChangeDetail>>;
  /**
   * Fired when a node is expanded or collapsed.
   */
  mdNodeToggle: EventEmitter<CustomEvent<IMdOrganizationChartOrgChartToggleDetail>>;
}


@ProxyCmp({
  inputs: ['autoSubmit', 'cellLabelTemplate', 'density', 'disabled', 'error', 'errorText', 'groupSize', 'incompleteLabel', 'inputMode', 'label', 'length', 'mask', 'name', 'readOnly', 'required', 'reserveSupportingSpace', 'supportingText', 'transform', 'validationType', 'value', 'valueMissingLabel'],
  methods: ['setFocus', 'clear', 'getValidity', 'setCustomValidity', 'checkValidity', 'reportValidity']
})
@Component({
  selector: 'md-otp-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['autoSubmit', 'cellLabelTemplate', 'density', 'disabled', 'error', 'errorText', 'groupSize', 'incompleteLabel', 'inputMode', 'label', 'length', 'mask', 'name', 'readOnly', 'required', 'reserveSupportingSpace', 'supportingText', 'transform', 'validationType', 'value', 'valueMissingLabel'],
})
export class MdOtpField {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdInput', 'mdChange', 'mdComplete', 'mdInvalidInput', 'mdValidityChange']);
  }
}


import type { MdOtpFieldCompleteDetail as IMdOtpFieldMdOtpFieldCompleteDetail } from '@awc-ui/core';
import type { MdOtpFieldInvalidDetail as IMdOtpFieldMdOtpFieldInvalidDetail } from '@awc-ui/core';
import type { MdOtpFieldValidityDetail as IMdOtpFieldMdOtpFieldValidityDetail } from '@awc-ui/core';

export declare interface MdOtpField extends Components.MdOtpField {
  /**
   * Fires on every value change from user input (typing, clearing, paste, autofill).
   */
  mdInput: EventEmitter<CustomEvent<string>>;
  /**
   * Commit event: fires when the code becomes complete and when focus leaves the whole group.
   */
  mdChange: EventEmitter<CustomEvent<string>>;
  /**
   * Fires when every cell is filled. A complete paste re-fires it even if the value is unchanged.
   */
  mdComplete: EventEmitter<CustomEvent<IMdOtpFieldMdOtpFieldCompleteDetail>>;
  /**
   * Fires when typed/pasted characters are rejected by the `validationType` charset.
   */
  mdInvalidInput: EventEmitter<CustomEvent<IMdOtpFieldMdOtpFieldInvalidDetail>>;
  /**
   * Fires when this control's validity CHANGES — never on mount, never for a
re-publish landing on the same state. `composed: false` by the library
convention: each control reports only for itself; `bubbles: true` still
reaches `<form>`-level listeners in the same DOM tree.
   */
  mdValidityChange: EventEmitter<CustomEvent<IMdOtpFieldMdOtpFieldValidityDetail>>;
}


@ProxyCmp({
  inputs: ['animation', 'animationDuration', 'cornerRadius', 'data', 'density', 'endAngle', 'gradient', 'heightProp', 'highlight', 'innerRadius', 'label', 'labelEmpty', 'labelMode', 'labelPlot', 'labelPoint', 'legend', 'loading', 'loadingLabel', 'locale', 'monochrome', 'noAnimation', 'outerRadius', 'paddingAngle', 'ringWidths', 'showLabels', 'startAngle', 'subtitle', 'summary', 'tableLabels', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter'],
  methods: ['resize', 'replay', 'drill', 'toDataURL', 'getInstance']
})
@Component({
  selector: 'md-pie-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['animation', 'animationDuration', 'cornerRadius', 'data', 'density', 'endAngle', 'gradient', 'heightProp', 'highlight', 'innerRadius', 'label', 'labelEmpty', 'labelMode', 'labelPlot', 'labelPoint', 'legend', 'loading', 'loadingLabel', 'locale', 'monochrome', 'noAnimation', 'outerRadius', 'paddingAngle', 'ringWidths', 'showLabels', 'startAngle', 'subtitle', 'summary', 'tableLabels', 'titleAlign', 'tooltip', 'tooltipRenderer', 'valueFormatter'],
})
export class MdPieChart {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSliceClick', 'mdLegendClick', 'mdReady']);
  }
}


import type { MdChartClickDetail as IMdPieChartMdChartClickDetail } from '@awc-ui/core';
import type { MdPieDatum as IMdPieChartMdPieDatum } from '@awc-ui/core';

export declare interface MdPieChart extends Components.MdPieChart {

  mdSliceClick: EventEmitter<CustomEvent<IMdPieChartMdChartClickDetail<IMdPieChartMdPieDatum>>>;

  mdLegendClick: EventEmitter<CustomEvent<{ dataIndex: number; selected: boolean }>>;

  mdReady: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['complete', 'density', 'fourColor', 'indeterminate', 'label', 'max', 'size', 'thickness', 'value', 'variant', 'wave', 'waveAmplitude', 'waveLength', 'waveSpeed']
})
@Component({
  selector: 'md-progress-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['complete', 'density', 'fourColor', 'indeterminate', 'label', 'max', 'size', 'thickness', 'value', 'variant', 'wave', 'waveAmplitude', 'waveLength', 'waveSpeed'],
})
export class MdProgressIndicator {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdComplete']);
  }
}


export declare interface MdProgressIndicator extends Components.MdProgressIndicator {
  /**
   * Fired when the completion animation finishes (and the indicator has hidden
itself, or — for flat circular — settled on its empty track ring).
   */
  mdComplete: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['checked', 'density', 'disabled', 'name', 'required', 'softDisabled', 'value', 'valueMissingLabel'],
  methods: ['syncValidityFromGroup', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity', 'setFocus', 'setBlur', 'select']
})
@Component({
  selector: 'md-radio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['checked', 'density', 'disabled', 'name', 'required', 'softDisabled', 'value', 'valueMissingLabel'],
})
export class MdRadio {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdFocus', 'mdBlur', 'mdValidityChange']);
  }
}


export declare interface MdRadio extends Components.MdRadio {
  /**
   * Emits when the checked state changes via user interaction
   */
  mdChange: EventEmitter<CustomEvent<{ checked: boolean; value: string }>>;
  /**
   * Emits when the radio receives focus
   */
  mdFocus: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the radio loses focus
   */
  mdBlur: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['defaultValue', 'density', 'disabled', 'emptyIcon', 'getLabel', 'hover', 'icon', 'max', 'name', 'outlineEmpty', 'precision', 'ratingLabel', 'readonly', 'showValueLabel', 'size', 'softDisabled', 'value'],
  methods: ['focusRating']
})
@Component({
  selector: 'md-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['defaultValue', 'density', 'disabled', 'emptyIcon', 'getLabel', 'hover', 'icon', 'max', 'name', 'outlineEmpty', 'precision', 'ratingLabel', 'readonly', 'showValueLabel', 'size', 'softDisabled', 'value'],
})
export class MdRating {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdHover', 'mdChange']);
  }
}


export declare interface MdRating extends Components.MdRating {
  /**
   * Fires while the user is hovering (or `null` when the cursor leaves).
   */
  mdHover: EventEmitter<CustomEvent<number | null>>;
  /**
   * Fires whenever the value changes via interaction.
   */
  mdChange: EventEmitter<CustomEvent<number>>;
}


@ProxyCmp({
  inputs: ['disabled'],
  methods: ['whenSettled', 'trigger']
})
@Component({
  selector: 'md-ripple',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['disabled'],
})
export class MdRipple {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdRipple extends Components.MdRipple {}


@ProxyCmp({
  inputs: ['announceResults', 'debounce', 'density', 'disabled', 'dismissOnOutsideClick', 'elevation', 'escapeCloses', 'fullWidth', 'initialFocus', 'inputAriaLabel', 'layout', 'leadingIcon', 'loading', 'loadingLabel', 'maxBlockSize', 'noResultsLabel', 'open', 'openLeadingIcon', 'placeholder', 'resultsLabel', 'scrollShadow', 'showClearButton', 'throttle', 'trigger', 'triggerElement', 'triggerFor', 'triggerIcon', 'value', 'variant', 'voiceSearch'],
  methods: ['show', 'close', 'toggle', 'focusInput', 'startVoice', 'stopVoice']
})
@Component({
  selector: 'md-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['announceResults', 'debounce', 'density', 'disabled', 'dismissOnOutsideClick', 'elevation', 'escapeCloses', 'fullWidth', 'initialFocus', 'inputAriaLabel', 'layout', 'leadingIcon', 'loading', 'loadingLabel', 'maxBlockSize', 'noResultsLabel', 'open', 'openLeadingIcon', 'placeholder', 'resultsLabel', 'scrollShadow', 'showClearButton', 'throttle', 'trigger', 'triggerElement', 'triggerFor', 'triggerIcon', 'value', 'variant', 'voiceSearch'],
})
export class MdSearch {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdInput', 'mdSearch', 'mdSubmit', 'mdChange', 'mdOpen', 'mdClose', 'mdClear', 'mdVoice', 'mdLeadingIconClick', 'mdTrailingIconClick']);
  }
}


import type { MdSearchLeadingIconClickDetail as IMdSearchMdSearchLeadingIconClickDetail } from '@awc-ui/core';
import type { MdSearchTrailingIconClickDetail as IMdSearchMdSearchTrailingIconClickDetail } from '@awc-ui/core';

export declare interface MdSearch extends Components.MdSearch {
  /**
   * Fires on every input change (immediate, every keystroke).
   */
  mdInput: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Debounced, de-duplicated query event — the one to wire an async results
fetch to. Honours `debounce` / `throttle` and applies a
distinct-until-changed guard on the trimmed query (so re-typing the same
term, or only adding surrounding whitespace, won't re-trigger a fetch).
Pressing Enter or clearing the field flushes it immediately.
   */
  mdSearch: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Fires when the user presses Enter to submit a query.
   */
  mdSubmit: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Fires when the input loses focus with a different value than on focus.
   */
  mdChange: EventEmitter<CustomEvent<{ value: string }>>;
  /**
   * Fires when the panel opens.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the panel closes.
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when the user clicks the clear (×) button.
   */
  mdClear: EventEmitter<CustomEvent<void>>;
  /**
   * Fires while voice search is active as the transcript streams in. `value`
is the current (interim or final) transcript; `final` is `true` on the
recognised final result. The component already mirrors the transcript into
the input and fires `mdInput` / `mdSearch`, so listen to this only if you
need voice-specific UI (e.g. a transcript preview).
   */
  mdVoice: EventEmitter<CustomEvent<{ value: string; final: boolean }>>;
  /**
   * Fires when the interactive leading affordance is clicked — the morphing
back / dismiss button while the bar is open, or a custom slotted `leading`
icon. The default back button still dismisses the panel as before; this
event is additive. The closed resting search glyph is intentionally NOT a
click target (a click there focuses the input), so it does not emit.
   */
  mdLeadingIconClick: EventEmitter<CustomEvent<IMdSearchMdSearchLeadingIconClickDetail>>;
  /**
   * Fires when a slotted `trailing` affordance is clicked. The built-in clear
(×) and voice (mic) buttons own their dedicated `mdClear` / `mdVoice`
events and do NOT trigger this. Only emitted when slotted trailing content
is actually present and was the click target.
   */
  mdTrailingIconClick: EventEmitter<CustomEvent<IMdSearchMdSearchTrailingIconClickDetail>>;
}


@ProxyCmp({
  inputs: ['density', 'disabled', 'icon', 'label', 'noCheckmark', 'ripple', 'segmentDensity', 'segmentIndex', 'segmentMultiselect', 'segmentTotal', 'selected', 'softDisabled', 'value']
})
@Component({
  selector: 'md-segmented-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'disabled', 'icon', 'label', 'noCheckmark', 'ripple', 'segmentDensity', 'segmentIndex', 'segmentMultiselect', 'segmentTotal', 'selected', 'softDisabled', 'value'],
})
export class MdSegmentedButton {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSegmentClick']);
  }
}


export declare interface MdSegmentedButton extends Components.MdSegmentedButton {
  /**
   * Internal event — caught by the set
   */
  mdSegmentClick: EventEmitter<CustomEvent<{ value: string; selected: boolean }>>;
}


@ProxyCmp({
  inputs: ['density', 'multiselect']
})
@Component({
  selector: 'md-segmented-button-set',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'multiselect'],
})
export class MdSegmentedButtonSet {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange']);
  }
}


export declare interface MdSegmentedButtonSet extends Components.MdSegmentedButtonSet {
  /**
   * Fires when the set of selected segment values changes
   */
  mdChange: EventEmitter<CustomEvent<string[]>>;
}


@ProxyCmp({
  inputs: ['clearIcon', 'clearLabel', 'clearable', 'density', 'disabled', 'dropdownIcon', 'error', 'errorText', 'filterLabel', 'filterMode', 'filterable', 'fullWidth', 'label', 'loading', 'loadingText', 'matchTriggerWidth', 'maxHeight', 'name', 'noOptionsText', 'noResultsText', 'open', 'options', 'placeholder', 'placement', 'required', 'reserveSupportingSpace', 'rowHeight', 'searchPlaceholder', 'searchingLabel', 'supportingText', 'value', 'valueMissingLabel', 'variant', 'virtualize'],
  methods: ['show', 'close', 'focusTrigger', 'reset', 'loadOptions', 'setQuery', 'getLabels', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']
})
@Component({
  selector: 'md-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['clearIcon', 'clearLabel', 'clearable', 'density', 'disabled', 'dropdownIcon', 'error', 'errorText', 'filterLabel', 'filterMode', 'filterable', 'fullWidth', 'label', 'loading', 'loadingText', 'matchTriggerWidth', 'maxHeight', 'name', 'noOptionsText', 'noResultsText', 'open', 'options', 'placeholder', 'placement', 'required', 'reserveSupportingSpace', 'rowHeight', 'searchPlaceholder', 'searchingLabel', 'supportingText', 'value', 'valueMissingLabel', 'variant', 'virtualize'],
})
export class MdSelect {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdOpen', 'mdClose', 'mdValidityChange']);
  }
}


export declare interface MdSelect extends Components.MdSelect {
  /**
   * Emits the newly selected value whenever the selection changes.
   */
  mdChange: EventEmitter<CustomEvent<string>>;
  /**
   * Emits when the dropdown opens.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the dropdown closes.
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['disabled', 'icon', 'iconColor', 'label', 'selected', 'supportingText', 'value']
})
@Component({
  selector: 'md-select-option',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['disabled', 'icon', 'iconColor', 'label', 'selected', 'supportingText', 'value'],
})
export class MdSelectOption {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSelectOptionChange']);
  }
}


export declare interface MdSelectOption extends Components.MdSelectOption {
  /**
   * Fired when the option mounts, unmounts, or its data changes so the
parent picker can re-read its option set.
   */
  mdSelectOptionChange: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['bottomDivider', 'closeable', 'density', 'detached', 'headline', 'open', 'scrimDismissible', 'sheetAriaLabel', 'showBack', 'side', 'topDivider', 'variant'],
  methods: ['show', 'close']
})
@Component({
  selector: 'md-side-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['bottomDivider', 'closeable', 'density', 'detached', 'headline', 'open', 'scrimDismissible', 'sheetAriaLabel', 'showBack', 'side', 'topDivider', 'variant'],
})
export class MdSideSheet {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdOpen', 'mdClose', 'mdCancel', 'mdBack']);
  }
}


export declare interface MdSideSheet extends Components.MdSideSheet {
  /**
   * Emits when the sheet opens
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the sheet closes
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when dismissed via scrim click or Escape
   */
  mdCancel: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the back button is pressed (modal only)
   */
  mdBack: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['animation', 'announce', 'ariaLabelProp', 'density', 'fullHeight', 'fullWidth', 'height', 'lines', 'variant', 'width']
})
@Component({
  selector: 'md-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['animation', 'announce', 'ariaLabelProp', 'density', 'fullHeight', 'fullWidth', 'height', 'lines', 'variant', 'width'],
})
export class MdSkeleton {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdSkeleton extends Components.MdSkeleton {}


@ProxyCmp({
  inputs: ['ariaLabelEnd', 'ariaLabelStart', 'controlled', 'density', 'disabled', 'fullHeight', 'icon', 'insetIcon', 'labeled', 'max', 'min', 'name', 'nameEnd', 'nameStart', 'orientation', 'range', 'size', 'sliderAriaLabel', 'step', 'stops', 'value', 'valueEnd', 'valueEndText', 'valueIndicator', 'valueStart', 'valueStartText', 'valueText', 'variant']
})
@Component({
  selector: 'md-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['ariaLabelEnd', 'ariaLabelStart', 'controlled', 'density', 'disabled', 'fullHeight', 'icon', 'insetIcon', 'labeled', 'max', 'min', 'name', 'nameEnd', 'nameStart', 'orientation', 'range', 'size', 'sliderAriaLabel', 'step', 'stops', 'value', 'valueEnd', 'valueEndText', 'valueIndicator', 'valueStart', 'valueStartText', 'valueText', 'variant'],
})
export class MdSlider {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdInput', 'mdChange', 'mdFocus', 'mdBlur', 'mdDragStart', 'mdDragEnd']);
  }
}


import type { MdSliderValueDetail as IMdSliderMdSliderValueDetail } from '@awc-ui/core';
import type { MdSliderThumbDetail as IMdSliderMdSliderThumbDetail } from '@awc-ui/core';
import type { MdSliderDragDetail as IMdSliderMdSliderDragDetail } from '@awc-ui/core';

export declare interface MdSlider extends Components.MdSlider {
  /**
   * Fires continuously while the user drags or presses arrow keys.
   */
  mdInput: EventEmitter<CustomEvent<IMdSliderMdSliderValueDetail>>;
  /**
   * Fires once when the user commits a value (pointer up, keyboard release, change event).
   */
  mdChange: EventEmitter<CustomEvent<IMdSliderMdSliderValueDetail>>;
  /**
   * Fires when a slider thumb receives focus.
   */
  mdFocus: EventEmitter<CustomEvent<IMdSliderMdSliderThumbDetail>>;
  /**
   * Fires when a slider thumb loses focus.
   */
  mdBlur: EventEmitter<CustomEvent<IMdSliderMdSliderThumbDetail>>;
  /**
   * Fires when a drag/keyboard interaction begins.
   */
  mdDragStart: EventEmitter<CustomEvent<IMdSliderMdSliderDragDetail>>;
  /**
   * Fires when a drag/keyboard interaction ends.
   */
  mdDragEnd: EventEmitter<CustomEvent<IMdSliderMdSliderDragDetail>>;
}


@ProxyCmp({
  inputs: ['action', 'autoHide', 'autoHideDuration', 'closeable', 'density', 'dismissLabel', 'message', 'open', 'politeness', 'position', 'stacked'],
  methods: ['show', 'hide']
})
@Component({
  selector: 'md-snackbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['action', 'autoHide', 'autoHideDuration', 'closeable', 'density', 'dismissLabel', 'message', 'open', 'politeness', 'position', 'stacked'],
})
export class MdSnackbar {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdOpen', 'mdClose', 'mdAction']);
  }
}


export declare interface MdSnackbar extends Components.MdSnackbar {
  /**
   * Emits when the snackbar becomes visible
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the snackbar is dismissed, with reason
   */
  mdClose: EventEmitter<CustomEvent<{ reason: 'auto' | 'action' | 'close' }>>;
  /**
   * Emits when the action button is clicked
   */
  mdAction: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['barWidth', 'color', 'cornerRadius', 'curve', 'data', 'heightProp', 'labels', 'lineWidth', 'markSize', 'max', 'min', 'noAnimation', 'referenceAreas', 'showMarks', 'showTooltip', 'valueFormatter', 'variant'],
  methods: ['resize', 'getInstance']
})
@Component({
  selector: 'md-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['barWidth', 'color', 'cornerRadius', 'curve', 'data', 'heightProp', 'labels', 'lineWidth', 'markSize', 'max', 'min', 'noAnimation', 'referenceAreas', 'showMarks', 'showTooltip', 'valueFormatter', 'variant'],
})
export class MdSparkline {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSparkClick', 'mdReady']);
  }
}


export declare interface MdSparkline extends Components.MdSparkline {

  mdSparkClick: EventEmitter<CustomEvent<{ dataIndex: number; value: number | null }>>;

  mdReady: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['controls', 'density', 'disabled', 'fullWidth', 'haspopup', 'icon', 'label', 'menuLabel', 'ripple', 'size', 'softDisabled', 'trailingChecked', 'trailingIcon', 'variant']
})
@Component({
  selector: 'md-split-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['controls', 'density', 'disabled', 'fullWidth', 'haspopup', 'icon', 'label', 'menuLabel', 'ripple', 'size', 'softDisabled', 'trailingChecked', 'trailingIcon', 'variant'],
})
export class MdSplitButton {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdLeadingClick', 'mdTrailingClick']);
  }
}


export declare interface MdSplitButton extends Components.MdSplitButton {
  /**
   * Fired when the leading button is activated
   */
  mdLeadingClick: EventEmitter<CustomEvent<void>>;
  /**
   * Fired when the trailing button is toggled
   */
  mdTrailingClick: EventEmitter<CustomEvent<{ checked: boolean }>>;
}


@ProxyCmp({
  inputs: ['density', 'label', 'live', 'size', 'state']
})
@Component({
  selector: 'md-status-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'label', 'live', 'size', 'state'],
})
export class MdStatusDot {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdStatusDot extends Components.MdStatusDot {}


@ProxyCmp({
  inputs: ['accessibleName', 'active', 'completed', 'completedIcon', 'density', 'description', 'disabled', 'editable', 'error', 'errorIcon', 'errorText', 'hideActions', 'icon', 'label', 'optional']
})
@Component({
  selector: 'md-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['accessibleName', 'active', 'completed', 'completedIcon', 'density', 'description', 'disabled', 'editable', 'error', 'errorIcon', 'errorText', 'hideActions', 'icon', 'label', 'optional'],
})
export class MdStep {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdStepClick', 'mdStepNext', 'mdStepBack']);
  }
}


export declare interface MdStep extends Components.MdStep {
  /**
   * Bubbled to the parent stepper, which decides whether the move is allowed.
Internal coordination event — consumed (and stopped) by `md-stepper`.
   */
  mdStepClick: EventEmitter<CustomEvent<{ index: number }>>;
  /**
   * Continue pressed in this step's content panel. Consumed by `md-stepper`.
   */
  mdStepNext: EventEmitter<CustomEvent<{ index: number }>>;
  /**
   * Back pressed in this step's content panel. Consumed by `md-stepper`.
   */
  mdStepBack: EventEmitter<CustomEvent<{ index: number }>>;
}


@ProxyCmp({
  inputs: ['active', 'autoComplete', 'backLabel', 'completedWord', 'currentWord', 'density', 'errorWord', 'finishLabel', 'indicator', 'label', 'lazy', 'loading', 'mode', 'nav', 'nextDisabled', 'nextLabel', 'ofWord', 'optionalWord', 'orientation', 'stepWord', 'variant'],
  methods: ['next', 'prev', 'goTo', 'reset']
})
@Component({
  selector: 'md-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['active', 'autoComplete', 'backLabel', 'completedWord', 'currentWord', 'density', 'errorWord', 'finishLabel', 'indicator', 'label', 'lazy', 'loading', 'mode', 'nav', 'nextDisabled', 'nextLabel', 'ofWord', 'optionalWord', 'orientation', 'stepWord', 'variant'],
})
export class MdStepper {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdBeforeChange', 'mdStepChange', 'mdComplete']);
  }
}


export declare interface MdStepper extends Components.MdStepper {
  /**
   * Fires BEFORE a user-driven step change commits (step click, built-in nav, or
`next()`/`prev()`/`goTo()`). Cancelable: call `event.preventDefault()` to
veto the transition (e.g. block Continue until the current step validates).
`detail.index` is the requested step, `detail.previous` the current one.
Does not fire for a direct `active` property assignment — set `active`
yourself to commit authoritatively (e.g. after async validation).
   */
  mdBeforeChange: EventEmitter<CustomEvent<{ index: number; previous: number }>>;
  /**
   * Active step changed (after it commits).
   */
  mdStepChange: EventEmitter<CustomEvent<{ index: number; previous: number }>>;
  /**
   * Continue pressed on the last step (the flow is finished).
   */
  mdComplete: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['badge', 'density', 'disabled', 'divider', 'gap', 'headline', 'supportingText'],
  methods: ['collapse']
})
@Component({
  selector: 'md-sub-menu-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['badge', 'density', 'disabled', 'divider', 'gap', 'headline', 'supportingText'],
})
export class MdSubMenuItem {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdClick']);
  }
}


export declare interface MdSubMenuItem extends Components.MdSubMenuItem {
  /**
   * Fires when the item row itself is clicked (not the submenu).
   */
  mdClick: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['density', 'disabled', 'icons', 'name', 'required', 'selected', 'selectedIcon', 'showOnlySelectedIcon', 'softDisabled', 'unselectedIcon', 'value', 'valueMissingLabel'],
  methods: ['setFocus', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']
})
@Component({
  selector: 'md-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['density', 'disabled', 'icons', 'name', 'required', 'selected', 'selectedIcon', 'showOnlySelectedIcon', 'softDisabled', 'unselectedIcon', 'value', 'valueMissingLabel'],
})
export class MdSwitch {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdInput', 'mdChange', 'mdValidityChange']);
  }
}


export declare interface MdSwitch extends Components.MdSwitch {
  /**
   * Fires **before** the state changes. Call `event.preventDefault()` to
block the internal toggle and manage state externally (controlled mode).

```ts
switch.addEventListener('mdInput', (e) => {
  e.preventDefault();          // prevent internal toggle
  myState.value = e.detail.selected; // update your own state
});
```
   */
  mdInput: EventEmitter<CustomEvent<{ selected: boolean }>>;
  /**
   * Fires **after** the internal state has committed. Use for side effects
like saving preferences, analytics, or syncing with other components.
Not cancelable — the toggle has already happened.

```ts
switch.addEventListener('mdChange', (e) => {
  console.log('Switch is now', e.detail.selected ? 'ON' : 'OFF');
});
```
   */
  mdChange: EventEmitter<CustomEvent<{ selected: boolean }>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['active', 'badge', 'controls', 'density', 'disabled', 'icon', 'inlineIcon', 'label', 'variant']
})
@Component({
  selector: 'md-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['active', 'badge', 'controls', 'density', 'disabled', 'icon', 'inlineIcon', 'label', 'variant'],
})
export class MdTab {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdTabClick']);
  }
}


export declare interface MdTab extends Components.MdTab {
  /**
   * Emits when the tab is activated by click or keyboard
   */
  mdTabClick: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['active']
})
@Component({
  selector: 'md-tab-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['active'],
})
export class MdTabPanel {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTabPanel extends Components.MdTabPanel {}


@ProxyCmp({
  inputs: ['for', 'sizing']
})
@Component({
  selector: 'md-tab-panels',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['for', 'sizing'],
})
export class MdTabPanels {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTabPanels extends Components.MdTabPanels {}


@ProxyCmp({
  inputs: ['caption', 'columnTemplate', 'columns', 'density', 'empty', 'frozenHeader', 'hoverable', 'keepHeight', 'label', 'loading', 'loadingMode', 'loadingRows', 'minWidth', 'motion', 'noDividers', 'pinIcon', 'pinMode', 'rowCount', 'rowOffset', 'scrollbar', 'selection', 'sortBy', 'sortOrder', 'stickyFooter', 'stickyHeader', 'striped', 'summary'],
  methods: ['getSelection', 'selectAll', 'deselectAll', 'toggleSelectAll', 'setSort', 'pinColumn', 'setColumnVisibility', 'animateNextChange']
})
@Component({
  selector: 'md-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['caption', 'columnTemplate', 'columns', 'density', 'empty', 'frozenHeader', 'hoverable', 'keepHeight', 'label', 'loading', 'loadingMode', 'loadingRows', 'minWidth', 'motion', 'noDividers', 'pinIcon', 'pinMode', 'rowCount', 'rowOffset', 'scrollbar', 'selection', 'sortBy', 'sortOrder', 'stickyFooter', 'stickyHeader', 'striped', 'summary'],
})
export class MdTable {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSortChange', 'mdSelectionChange', 'mdPinChange', 'mdColumnVisibilityChange', 'mdScroll']);
  }
}


import type { MdTableSortState as IMdTableMdTableSortState } from '@awc-ui/core';
import type { MdTableSelectionState as IMdTableMdTableSelectionState } from '@awc-ui/core';

export declare interface MdTable extends Components.MdTable {
  /**
   * Emitted when sort changes (after a `md-table-sort-label` is clicked).
   */
  mdSortChange: EventEmitter<CustomEvent<IMdTableMdTableSortState>>;
  /**
   * Emitted whenever the row selection state changes.
   */
  mdSelectionChange: EventEmitter<CustomEvent<IMdTableMdTableSelectionState>>;
  /**
   * Emits when a column is pinned/unpinned via `pinColumn`.
   */
  mdPinChange: EventEmitter<CustomEvent<{ column: number; side: 'start' | 'end' | null }>>;
  /**
   * Emits when a column is hidden/shown via `setColumnVisibility`.
   */
  mdColumnVisibilityChange: EventEmitter<CustomEvent<{ column: number; visible: boolean; hidden: number[] }>>;
  /**
   * rAF-throttled scroll position of the frozen body scroller.
   */
  mdScroll: EventEmitter<CustomEvent<{ scrollLeft: number; scrollTop: number }>>;
}


@ProxyCmp({
})
@Component({
  selector: 'md-table-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: [],
})
export class MdTableBody {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTableBody extends Components.MdTableBody {}


@ProxyCmp({
  inputs: ['align', 'colSpan', 'density', 'ellipsis', 'head', 'noPinIndicator', 'numeric', 'padding', 'pinIcon', 'rowSpan', 'scope', 'sticky', 'variant']
})
@Component({
  selector: 'md-table-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['align', 'colSpan', 'density', 'ellipsis', 'head', 'noPinIndicator', 'numeric', 'padding', 'pinIcon', 'rowSpan', 'scope', 'sticky', 'variant'],
})
export class MdTableCell {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTableCell extends Components.MdTableCell {}


@ProxyCmp({
  inputs: ['elevation', 'maxHeight', 'minHeight', 'shape', 'variant', 'vibrant']
})
@Component({
  selector: 'md-table-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['elevation', 'maxHeight', 'minHeight', 'shape', 'variant', 'vibrant'],
})
export class MdTableContainer {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTableContainer extends Components.MdTableContainer {}


@ProxyCmp({
  inputs: ['buttonLabel', 'icon']
})
@Component({
  selector: 'md-table-expand-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['buttonLabel', 'icon'],
})
export class MdTableExpandToggle {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTableExpandToggle extends Components.MdTableExpandToggle {}


@ProxyCmp({
})
@Component({
  selector: 'md-table-foot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: [],
})
export class MdTableFoot {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTableFoot extends Components.MdTableFoot {}


@ProxyCmp({
})
@Component({
  selector: 'md-table-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: [],
})
export class MdTableHead {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTableHead extends Components.MdTableHead {}


@ProxyCmp({
  inputs: ['compact', 'count', 'density', 'disabled', 'labelAll', 'labelDisplayedRows', 'labelFirstPage', 'labelLastPage', 'labelNextPage', 'labelPreviousPage', 'labelRowsPerPage', 'page', 'rowsPerPage', 'rowsPerPageOptions', 'showFirstLast'],
  methods: ['goToPage', 'setRowsPerPage']
})
@Component({
  selector: 'md-table-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['compact', 'count', 'density', 'disabled', 'labelAll', 'labelDisplayedRows', 'labelFirstPage', 'labelLastPage', 'labelNextPage', 'labelPreviousPage', 'labelRowsPerPage', 'page', 'rowsPerPage', 'rowsPerPageOptions', 'showFirstLast'],
})
export class MdTablePagination {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdPageChange', 'mdRowsPerPageChange']);
  }
}


export declare interface MdTablePagination extends Components.MdTablePagination {
  /**
   * Fired when the user changes the page.
   */
  mdPageChange: EventEmitter<CustomEvent<{ page: number }>>;
  /**
   * Fired when the user changes rows-per-page.
   */
  mdRowsPerPageChange: EventEmitter<CustomEvent<{ rowsPerPage: number }>>;
}


@ProxyCmp({
  inputs: ['clickable', 'disabled', 'expandable', 'expanded', 'highlight', 'rowgroup', 'selectable', 'selected', 'value'],
  methods: ['toggle']
})
@Component({
  selector: 'md-table-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['clickable', 'disabled', 'expandable', 'expanded', 'highlight', 'rowgroup', 'selectable', 'selected', 'value'],
})
export class MdTableRow {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdRowClick', 'mdRowSelectionChange', 'mdRowExpandedChange']);
  }
}


export declare interface MdTableRow extends Components.MdTableRow {
  /**
   * Fired when the user clicks (or Enter/Space-activates) the row.
   */
  mdRowClick: EventEmitter<CustomEvent<{ value: string; row: HTMLElement }>>;
  /**
   * Fired when the `selected` state changes (used by `<md-table>` for
selection coordination).
   */
  mdRowSelectionChange: EventEmitter<CustomEvent<{ selected: boolean; value: string }>>;
  /**
   * Fired when the row's expanded state changes.
   */
  mdRowExpandedChange: EventEmitter<CustomEvent<{ expanded: boolean }>>;
}


@ProxyCmp({
  inputs: ['active', 'column', 'defaultOrder', 'density', 'disabled', 'icon', 'iconPosition', 'order']
})
@Component({
  selector: 'md-table-sort-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['active', 'column', 'defaultOrder', 'density', 'disabled', 'icon', 'iconPosition', 'order'],
})
export class MdTableSortLabel {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdSortRequest']);
  }
}


export declare interface MdTableSortLabel extends Components.MdTableSortLabel {
  /**
   * Fired when the user requests to sort by this column.
   */
  mdSortRequest: EventEmitter<CustomEvent<{ column: string; defaultOrder: 'asc' | 'desc' }>>;
}


@ProxyCmp({
  inputs: ['autoBind', 'compact', 'density', 'headline', 'labelSelected', 'numSelected', 'supportingText']
})
@Component({
  selector: 'md-table-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['autoBind', 'compact', 'density', 'headline', 'labelSelected', 'numSelected', 'supportingText'],
})
export class MdTableToolbar {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdTableToolbar extends Components.MdTableToolbar {}


@ProxyCmp({
  inputs: ['activeTabIndex', 'ariaLabelProp', 'tabWidth', 'variant', 'width'],
  methods: ['selectTab']
})
@Component({
  selector: 'md-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['activeTabIndex', 'ariaLabelProp', 'tabWidth', 'variant', 'width'],
})
export class MdTabs {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdTabChange']);
  }
}


export declare interface MdTabs extends Components.MdTabs {
  /**
   * Emits when the active tab changes
   */
  mdTabChange: EventEmitter<CustomEvent<{ index: number; previousIndex: number }>>;
}


@ProxyCmp({
  inputs: ['appearFocused', 'autoCapitalize', 'autocomplete', 'chipsWrap', 'clearable', 'debounce', 'density', 'disabled', 'enterKeyHint', 'error', 'errorText', 'focusBorderWidth', 'formatOn', 'formatter', 'inputAriaAutocomplete', 'inputExpanded', 'inputMode', 'inputRole', 'label', 'max', 'maxLength', 'min', 'minLength', 'multiline', 'name', 'parser', 'passwordToggle', 'pattern', 'placeholder', 'prefixText', 'readOnly', 'required', 'reserveSupportingSpace', 'restrict', 'rows', 'speechLang', 'speechToText', 'spellcheck', 'step', 'suffixText', 'supportingText', 'throttle', 'type', 'value', 'variant'],
  methods: ['setFocus', 'select', 'getInputElement', 'getValidity', 'setCustomValidity', 'checkValidity', 'reportValidity']
})
@Component({
  selector: 'md-text-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['appearFocused', 'autoCapitalize', 'autocomplete', 'chipsWrap', 'clearable', 'debounce', 'density', 'disabled', 'enterKeyHint', 'error', 'errorText', 'focusBorderWidth', 'formatOn', 'formatter', 'inputAriaAutocomplete', 'inputExpanded', 'inputMode', 'inputRole', 'label', 'max', 'maxLength', 'min', 'minLength', 'multiline', 'name', 'parser', 'passwordToggle', 'pattern', 'placeholder', 'prefixText', 'readOnly', 'required', 'reserveSupportingSpace', 'restrict', 'rows', 'speechLang', 'speechToText', 'spellcheck', 'step', 'suffixText', 'supportingText', 'throttle', 'type', 'value', 'variant'],
})
export class MdTextField {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdInput', 'mdChange', 'mdSearch', 'mdClear', 'mdPasswordToggle', 'mdSpeechResult', 'mdValidityChange']);
  }
}


export declare interface MdTextField extends Components.MdTextField {

  mdInput: EventEmitter<CustomEvent<string>>;

  mdChange: EventEmitter<CustomEvent<string>>;
  /**
   * Emitted with debounce/throttle control. Useful for search-as-you-type, API calls, or filtering.
   */
  mdSearch: EventEmitter<CustomEvent<string>>;

  mdClear: EventEmitter<CustomEvent<void>>;

  mdPasswordToggle: EventEmitter<CustomEvent<{ visible: boolean }>>;

  mdSpeechResult: EventEmitter<CustomEvent<{ transcript: string; listening: boolean }>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['amLabel', 'cancelLabel', 'density', 'disabled', 'format', 'headline', 'headlineDialLabel', 'headlineInputLabel', 'hideTrigger', 'hourLabel', 'label', 'max', 'min', 'minuteLabel', 'minuteStep', 'name', 'okLabel', 'open', 'orientation', 'periodLabel', 'periodLayout', 'pmLabel', 'rangeOutsideLabel', 'rangeOverflowLabel', 'rangeUnderflowLabel', 'required', 'responsive', 'toggleDialLabel', 'toggleInputLabel', 'value', 'valueMissingLabel', 'variant'],
  methods: ['show', 'hide', 'checkValidity', 'reportValidity', 'getValidity']
})
@Component({
  selector: 'md-time-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['amLabel', 'cancelLabel', 'density', 'disabled', 'format', 'headline', 'headlineDialLabel', 'headlineInputLabel', 'hideTrigger', 'hourLabel', 'label', 'max', 'min', 'minuteLabel', 'minuteStep', 'name', 'okLabel', 'open', 'orientation', 'periodLabel', 'periodLayout', 'pmLabel', 'rangeOutsideLabel', 'rangeOverflowLabel', 'rangeUnderflowLabel', 'required', 'responsive', 'toggleDialLabel', 'toggleInputLabel', 'value', 'valueMissingLabel', 'variant'],
})
export class MdTimePicker {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdInput', 'mdOpen', 'mdClose', 'mdCancel', 'mdModeChange', 'mdValidityChange']);
  }
}


import type { MdTimePickerChangeDetail as IMdTimePickerMdTimePickerChangeDetail } from '@awc-ui/core';
import type { MdTimePickerModeChangeDetail as IMdTimePickerMdTimePickerModeChangeDetail } from '@awc-ui/core';

export declare interface MdTimePicker extends Components.MdTimePicker {
  /**
   * Emitted when the user confirms the chosen time (OK button, or
Enter inside the HH/MM fields while the buffers are valid).
This is the canonical "the user has committed a value" event —
use it for form integration, persistence, and analytics.

The detail bundle includes both the human-friendly `value` and
three industry-standard ISO / Date representations so
downstream code never has to re-format the time itself.
   */
  mdChange: EventEmitter<CustomEvent<IMdTimePickerMdTimePickerChangeDetail>>;
  /**
   * Emitted on every intermediate change while the dialog is
open — dial drag, dial-mode keyboard typing, AM/PM toggle,
and input-variant keystrokes that produce a valid HH:MM.

Mirrors the HTML `input` event semantics ("fires for every
user-driven mutation") and matches the pattern used by
`md-date-picker` / `md-text-field`. Use `mdInput` for live
previews and `mdChange` for the final commit. The detail
shape is identical to `mdChange` so a previewer can read the
same fields regardless of which event arrived.
   */
  mdInput: EventEmitter<CustomEvent<IMdTimePickerMdTimePickerChangeDetail>>;
  /**
   * Emitted when the picker opens.
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emitted when the picker closes (whether confirmed, cancelled, or dismissed).
   */
  mdClose: EventEmitter<CustomEvent<void>>;
  /**
   * Emitted when the picker is cancelled or dismissed without committing.
   */
  mdCancel: EventEmitter<CustomEvent<void>>;
  /**
   * Emitted when the user switches between the dial and input
variants via the dialog's keyboard / clock toggle. Lets
analytics or sibling UI react to the variant change (e.g.
announce the new mode to screen readers, or resize a hosting
dialog wrapper).
   */
  mdModeChange: EventEmitter<CustomEvent<IMdTimePickerMdTimePickerModeChangeDetail>>;
  /**
   * Fires when this control's validity CHANGES — never on every keystroke, and
never for a re-publish that lands on the same state.

`composed: false` is deliberate. Composites like md-select embed an
md-text-field, and a composed event escapes that inner shadow root, so a
listener on md-select would receive the inner field's event as well as the
host's — two events, different payloads, for one logical control. Keeping
it uncomposed means each component reports only for itself, while
`bubbles: true` still lets a <form> or app root hear every control.
   */
  mdValidityChange: EventEmitter<CustomEvent<{ valid: boolean; validationMessage: string; flags: Record<string, boolean>; }>>;
}


@ProxyCmp({
  inputs: ['alignment', 'ariaLabelProp', 'ariaLabelledby', 'color', 'containerSemantics', 'density', 'layout', 'variant'],
  methods: ['setFocus']
})
@Component({
  selector: 'md-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['alignment', 'ariaLabelProp', 'ariaLabelledby', 'color', 'containerSemantics', 'density', 'layout', 'variant'],
})
export class MdToolbar {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
  }
}


export declare interface MdToolbar extends Components.MdToolbar {}


@ProxyCmp({
  inputs: ['autoPosition', 'crossOffset', 'density', 'disabled', 'hideDelay', 'offset', 'open', 'position', 'showDelay', 'subhead', 'text', 'variant'],
  methods: ['show', 'hide']
})
@Component({
  selector: 'md-tooltip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['autoPosition', 'crossOffset', 'density', 'disabled', 'hideDelay', 'offset', 'open', 'position', 'showDelay', 'subhead', 'text', 'variant'],
})
export class MdTooltip {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdOpen', 'mdClose']);
  }
}


export declare interface MdTooltip extends Components.MdTooltip {
  /**
   * Emits when the tooltip becomes visible. `bubbles:false` + `composed:false` keep it
from crossing the shadow boundary and retargeting onto an embedding host (the repo's
documented composed-event-leak class — see md-date-picker's swallow guards).
   */
  mdOpen: EventEmitter<CustomEvent<void>>;
  /**
   * Emits when the tooltip is dismissed (does not bubble or cross shadow boundaries).
   */
  mdClose: EventEmitter<CustomEvent<void>>;
}


@ProxyCmp({
  inputs: ['countTemplate', 'density', 'disabled', 'emptyIcon', 'emptyText', 'items', 'moveAllLeftIcon', 'moveAllLeftLabel', 'moveAllRightIcon', 'moveAllRightLabel', 'moveLeftIcon', 'moveLeftLabel', 'moveRightIcon', 'moveRightLabel', 'searchIcon', 'searchable', 'showSelectAll', 'singleStepOnly', 'sourceSearchPlaceholder', 'sourceTitle', 'targetSearchPlaceholder', 'targetTitle', 'value'],
  methods: ['moveSelectedRight', 'moveSelectedLeft']
})
@Component({
  selector: 'md-transfer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content></ng-content>',
  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property
  inputs: ['countTemplate', 'density', 'disabled', 'emptyIcon', 'emptyText', 'items', 'moveAllLeftIcon', 'moveAllLeftLabel', 'moveAllRightIcon', 'moveAllRightLabel', 'moveLeftIcon', 'moveLeftLabel', 'moveRightIcon', 'moveRightLabel', 'searchIcon', 'searchable', 'showSelectAll', 'singleStepOnly', 'sourceSearchPlaceholder', 'sourceTitle', 'targetSearchPlaceholder', 'targetTitle', 'value'],
})
export class MdTransferList {
  protected el: HTMLElement;
  constructor(c: ChangeDetectorRef, r: ElementRef, protected z: NgZone) {
    c.detach();
    this.el = r.nativeElement;
    proxyOutputs(this, this.el, ['mdChange', 'mdMove']);
  }
}


export declare interface MdTransferList extends Components.MdTransferList {
  /**
   * Fires on every change to the target value.
   */
  mdChange: EventEmitter<CustomEvent<string[]>>;
  /**
   * Fires after items are moved. detail describes the operation.
   */
  mdMove: EventEmitter<CustomEvent<{ direction: 'left' | 'right'; moved: string[]; target: string[]; }>>;
}


