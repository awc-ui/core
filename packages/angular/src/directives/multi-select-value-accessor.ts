import { Directive, ElementRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { ValueAccessor } from './ssr-value-accessor';

/** Angular reset() writes null; a multi-select's empty value must remain an array. */
@Directive({
  selector: 'md-multi-select',
  host: { '(mdChange)': 'handleChangeEvent($event.target.value)' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: MultiSelectValueAccessor, multi: true }],
  standalone: true,
})
export class MultiSelectValueAccessor extends ValueAccessor {
  constructor(el: ElementRef) { super(el); }

  override writeValue(value: string[] | null | undefined) {
    this.writeHostProperty('value', this.lastValue = value ?? []);
  }
}
