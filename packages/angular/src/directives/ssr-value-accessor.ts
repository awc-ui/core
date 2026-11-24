import { Directive, inject, PLATFORM_ID } from "@angular/core";
import { isPlatformServer } from "@angular/common";
import { ValueAccessor as GeneratedValueAccessor } from "./value-accessor";

/** Hand-owned extension: DOM properties do not survive Angular HTML serialization. */
@Directive({})
export class ValueAccessor extends GeneratedValueAccessor {
  private readonly server = isPlatformServer(inject(PLATFORM_ID));

  protected writeHostProperty(property: string, value: unknown) {
    const element = this.el.nativeElement;
    element[property] = value;
    // Client CVAs remain property-only: no reflected attributes or extra events.
    if (!this.server) return;
    if (property === "value") {
      const arraySelection =
        element.localName === "md-multi-select" ||
        element.localName === "md-autocomplete";
      if (
        arraySelection &&
        Array.isArray(value) &&
        value.every((item) => typeof item === "string")
      ) {
        element.setAttribute("data-awc-initial-values", JSON.stringify(value));
        element.removeAttribute("value");
        return;
      }
      element.removeAttribute("data-awc-initial-values");
    }
    if (value == null || value === false) element.removeAttribute(property);
    else if (value === true) element.setAttribute(property, "");
    else if (typeof value === "string" || typeof value === "number")
      element.setAttribute(property, String(value));
  }

  override writeValue(value: any) {
    this.writeHostProperty(
      "value",
      (this.lastValue = value == null ? "" : value),
    );
  }

  override setDisabledState(disabled: boolean) {
    this.writeHostProperty("disabled", disabled);
  }
}
