import { Directive, ElementRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { ValueAccessor } from './value-accessor';

/**
 * ControlValueAccessor for `md-switch`.
 *
 * Hand-written rather than generated because md-switch stores its state in
 * `selected`, not `checked`. The Stencil Angular output target merges every
 * config that shares a `type`, so listing md-switch alongside md-checkbox under
 * `boolean` produced ONE directive whose writeValue hardcoded `.checked` while
 * its host binding read `.selected` — silently breaking both controls in
 * opposite directions.
 *
 * This file is NOT generated, so the build will not overwrite it.
 */
@Directive({
  /* tslint:disable-next-line:directive-selector */
  selector: 'md-switch',
  host: {
    '(mdChange)': 'handleChangeEvent($event.target.selected)',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: SwitchValueAccessor,
      multi: true,
    },
  ],
})
export class SwitchValueAccessor extends ValueAccessor {
  constructor(el: ElementRef) {
    super(el);
  }

  override writeValue(value: any) {
    this.el.nativeElement.selected = this.lastValue = value == null ? false : value;
  }
}
