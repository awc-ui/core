import { inject, PLATFORM_ID, type NgZone } from "@angular/core";
import { isPlatformServer } from "@angular/common";
import { ProxyCmp as upstreamProxyCmp } from "./angular-component-lib/utils";
export { proxyOutputs } from "./angular-component-lib/utils";

type AttributeMetadata = string | [string | null, "json" | "values"];
type SsrAttributes = Record<string, AttributeMetadata | false>;
interface ProxyInstance {
  el: HTMLElement & Record<string, unknown>;
  z: NgZone;
}
interface ProxyOptions {
  defineCustomElementFn?: () => void;
  inputs?: string[];
  methods?: string[];
  ssrAttributes?: SsrAttributes;
}

// Capture the platform while Angular constructs each proxy. Setters also run
// later, outside an injection context; they must never infer SSR from globals.
const serverInstances = new WeakSet<object>();
export function initializeSsrInputs(instance: object): void {
  if (isPlatformServer(inject(PLATFORM_ID))) serverInstances.add(instance);
}

function serializeInput(
  element: HTMLElement,
  metadata: AttributeMetadata,
  value: unknown,
): void {
  const [attribute, encoding] =
    typeof metadata === "string" ? [metadata] : metadata;
  if (encoding === "values") {
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      element.setAttribute("data-awc-initial-values", JSON.stringify(value));
      if (attribute) element.removeAttribute(attribute);
      return;
    }
    element.removeAttribute("data-awc-initial-values");
  }
  if (!attribute) return;
  if (
    value == null ||
    (attribute === "disabled" && (value === false || value === "false"))
  )
    element.removeAttribute(attribute);
  else if (encoding === "json" && Array.isArray(value))
    element.setAttribute(attribute, JSON.stringify(value));
  else if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    // Explicit false must survive even when the component's default is true.
    element.setAttribute(attribute, value === true ? "" : String(value));
  }
}

/** Preserve upstream registration, methods and zone behavior; add only SSR attributes. */
export function ProxyCmp(options: ProxyOptions) {
  // Reuse upstream registration and methods, with one input setter per prop.
  const decorate = upstreamProxyCmp({ ...options, inputs: undefined });
  return (component: any) => {
    decorate(component);
    for (const input of options.inputs ?? []) {
      const metadata =
        options.ssrAttributes?.[input] ??
        input.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      Object.defineProperty(component.prototype, input, {
        configurable: true,
        get(this: ProxyInstance) {
          return this.el[input];
        },
        set(this: ProxyInstance, value: unknown) {
          this.z.runOutsideAngular(() => {
            this.el[input] = value;
            if (metadata !== false && serverInstances.has(this))
              serializeInput(this.el, metadata, value);
          });
        },
      });
    }
    return component;
  };
}
