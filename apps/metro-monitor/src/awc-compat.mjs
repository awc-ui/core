import { MdTextField } from "@awc-ui/core/dist/components/md-text-field.js";
import { bridgeFormatterProps } from "./awc-formatter-bridge.mjs";

// Apply before mounting any React wrappers. Remove when the local AWC build
// includes a host-equals-instance-safe bridgeFormatterProps implementation.
MdTextField.prototype.bridgeFormatterProps = bridgeFormatterProps;
