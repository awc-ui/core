import test from "node:test";
import assert from "node:assert/strict";
import { bridgeFormatterProps } from "./awc-formatter-bridge.mjs";

for (const direct of [true, false]) {
  test(`AWC formatter bridge: ${direct ? "direct custom element" : "separate lazy host"}`, () => {
    const component = {
      value: "1234",
      formatter: (v) => `$${v}`,
      parser: undefined,
      focused: false,
      formatterEpoch: 0,
      syncDisplayValue() {
        this.displayValue = this.formatter
          ? this.formatter(this.value)
          : this.value;
      },
    };
    component.el = direct ? component : {};
    bridgeFormatterProps.call(component);
    component.syncDisplayValue();
    assert.equal(component.displayValue, "$1234");
    component.el.formatter = (v) => `#${v}`;
    assert.equal(component.displayValue, "#1234");
    assert.equal(component.formatterEpoch, 1);
    component.el.parser = (v) => v.replace("#", "");
    assert.equal(component.parser("#42"), "42");
    component.focused = true;
    component.el.formatter = (v) => `${v}!`;
    assert.equal(
      component.displayValue,
      "#1234",
      "editing must not replace the focused display",
    );
    component.focused = false;
    component.el.formatter = undefined;
    assert.equal(component.displayValue, "1234");
  });
}
