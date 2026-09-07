import { Directive, ElementRef, Injectable, Injector, Input, OnDestroy, OnInit } from '@angular/core';
import { NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';
import { ValueAccessor } from './value-accessor';

/** Coordinates radios that share an Angular control or a named form group. */
@Injectable({ providedIn: 'root' })
export class RadioValueAccessorRegistry {
  private readonly accessors = new Set<RadioValueAccessor>();

  add(accessor: RadioValueAccessor) { this.accessors.add(accessor); }
  remove(accessor: RadioValueAccessor) { this.accessors.delete(accessor); }

  select(accessor: RadioValueAccessor) {
    for (const other of this.accessors) {
      if (other !== accessor && accessor.isSameGroup(other)) other.uncheck(accessor.value);
    }
  }
}

/**
 * A radio's value identifies its option; the form model chooses which option
 * is checked. Kept outside valueAccessorConfigs so Stencil cannot replace this
 * with its generic accessor, which writes the model over the option's value.
 */
@Directive({
  selector: 'md-radio',
  host: { '(mdChange)': 'handleRadioChange($event)' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: RadioValueAccessor, multi: true }],
  standalone: true,
})
export class RadioValueAccessor extends ValueAccessor implements OnInit, OnDestroy {
  private control: NgControl | null = null;
  private hasModelValue = false;
  private optionValue: unknown;
  private optionName: string | undefined;

  constructor(el: ElementRef, private registry: RadioValueAccessorRegistry, private injector: Injector) {
    super(el);
  }

  @Input()
  get value(): unknown { return this.optionValue ?? this.el.nativeElement.value; }
  set value(value: unknown) {
    this.optionValue = value;
    this.el.nativeElement.value = value;
    if (this.hasModelValue) this.updateChecked();
  }

  @Input()
  get name(): string { return this.optionName ?? this.el.nativeElement.name ?? ''; }
  set name(name: string) {
    this.optionName = name;
    this.el.nativeElement.name = name;
  }

  ngOnInit() {
    // Resolve after construction: NG_VALUE_ACCESSOR is itself needed while
    // Angular constructs NgControl, so injecting NgControl directly is cyclic.
    this.control = this.injector.get(NgControl, null, { self: true });
    if (this.control) this.registry.add(this);
  }

  ngOnDestroy() { this.registry.remove(this); }

  override writeValue(value: unknown) {
    this.hasModelValue = true;
    this.lastValue = value;
    this.updateChecked();
  }

  private updateChecked() {
    this.el.nativeElement.checked = this.lastValue != null && Object.is(this.lastValue, this.value);
  }

  handleRadioChange(event: Event) {
    if (!this.control || event.target !== this.el.nativeElement || !this.el.nativeElement.checked || this.el.nativeElement.disabled) return;
    this.registry.select(this);
    super.handleChangeEvent(this.value);
  }

  uncheck(selectedValue: unknown) {
    this.lastValue = selectedValue;
    this.el.nativeElement.checked = false;
  }

  isSameGroup(other: RadioValueAccessor): boolean {
    const control = this.control?.control;
    const otherControl = other.control?.control;
    if (control && control === otherControl) return true;
    if (!this.name || this.name !== other.name) return false;
    if (control?.parent || otherControl?.parent) return !!control?.parent && control.parent === otherControl?.parent;
    const element = this.el.nativeElement;
    const otherElement = other.el.nativeElement;
    return element.getRootNode() === otherElement.getRootNode() && element.closest('form') === otherElement.closest('form');
  }
}
