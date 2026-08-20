export { AwcUiModule, provideAwcUi } from './awc-ui.module';
export * from './directives/index';
export * from './directives/proxies';

// Value accessors must be exported from the top-level entrypoint: they are
// visible to consumers through AwcUiModule, and Angular's partial compiler
// rejects a declared-but-unexported directive (NG3001).
export { VALUE_ACCESSORS } from './awc-ui.module';
export { ValueAccessor } from './directives/value-accessor';
export { TextValueAccessor } from './directives/text-value-accessor';
export { SelectValueAccessor } from './directives/select-value-accessor';
export { BooleanValueAccessor } from './directives/boolean-value-accessor';
export { RadioValueAccessor } from './directives/radio-value-accessor';
export { NumericValueAccessor } from './directives/number-value-accessor';
export { SwitchValueAccessor } from './directives/switch-value-accessor';
