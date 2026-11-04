import { nativeToolbarMethod } from './toolbar-appearance.js';
import { nativeStepperMethod, stepperMethodArguments } from './stepper-appearance.js';
import { nativeSrMethod, srMethodArguments } from './sr-appearance.js';
import { nativeTableMethod, tableMethodArguments, tableMethodValue } from './table-appearance.js';
import { nativeChartMethod, chartMethodArguments, validChartMethodValue } from './chart-appearance.js';
/** Explicit wire contracts; capabilities still come from native adapter metadata. */
export const nativeLifecycleMethod = (tag, method) => tag === 'md-menu' && ['show', 'close', 'whenClosed'].includes(method)
  || ['md-fab-menu', 'md-dialog', 'md-side-sheet'].includes(tag) && ['show', 'close', 'whenClosed'].includes(method)
  || tag === 'md-bottom-sheet' && ['show', 'close'].includes(method)
  || ['md-snackbar', 'md-tooltip'].includes(tag) && ['show', 'hide'].includes(method);
/** Synchronous item methods: the retained native item is toggled or focused in place. */
export const nativeItemMethod = (tag, method) => tag === 'md-menu' && method === 'reposition' || tag === 'md-sub-menu-item' && method === 'collapse'
  || tag === 'md-accordion-item' && ['toggle', 'focusHeader'].includes(method)
  || tag === 'md-list' && ['activateNext', 'activatePrevious', 'selectItem', 'getSelectedIndices'].includes(method)
  || tag === 'md-list-item' && ['setFocus', 'focusItem', 'toggle', 'expand', 'collapse'].includes(method)
  || tag === 'md-ripple' && ['trigger', 'whenSettled'].includes(method)
  || tag === 'md-breadcrumbs' && ['expand', 'collapse'].includes(method)
  || tag === 'md-tabs' && method === 'selectTab'
  || tag === 'md-navigation-bar' && ['select', 'focusTab'].includes(method)
  || tag === 'md-navigation-tab' && method === 'focusEl';
/** Synchronous selection-control methods (validation and focus) through the native controller. */
export const nativeSelectionMethod = (tag, method) => tag === 'md-otp-field' && ['setFocus', 'clear', 'getValidity', 'setCustomValidity', 'checkValidity', 'reportValidity'].includes(method)
  || tag === 'md-number-field' && ['setFocus', 'select', 'stepUp', 'stepDown', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity'].includes(method)
  || tag === 'md-text-field' && ['setFocus', 'select', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity'].includes(method)
  || tag === 'md-switch' && ['setFocus', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity'].includes(method)
  || tag === 'md-checkbox' && ['getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity'].includes(method)
  || tag === 'md-radio' && ['syncValidityFromGroup', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity', 'setFocus', 'setBlur', 'select'].includes(method);
export const nativeMethodSupported = (tag, method, policy) => tag === 'md-fab' && method === 'setMenuIcon'
  || Boolean(nativeStepperMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method))
  || Boolean(nativeSrMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method))
  || Boolean(nativeTableMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method))
  || Boolean(nativeChartMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method))
  || Boolean(nativeToolbarMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method))
  || Boolean(nativeSelectionMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method))
  || Boolean(nativeItemMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method))
  || Boolean(nativeLifecycleMethod(tag, method) && policy?.methods?.includes(method) && !policy?.unsupportedMethods?.includes(method));
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_METHOD' });
const callID = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const dataArray = value => Array.isArray(value) && Reflect.ownKeys(value).length === value.length + 1
  && Array.from({ length: value.length }, (_, index) => Object.getOwnPropertyDescriptor(value, String(index)))
    .every(descriptor => descriptor && Object.hasOwn(descriptor, 'value'));

export function nativeMethodCommand(tag, method, args, invocation) {
  // md-stepper's next() / prev() / goTo(index) / reset() through AWCStepperController.
  if (nativeStepperMethod(tag, method)) {
    if (invocation !== undefined || !dataArray(args)) throw invalid(`${method} requires an argument array.`);
    return { command: 'method', method, arguments: stepperMethodArguments(tag, method, args) };
  }
  // md-rating's focusRating() through AWCRatingController.
  if (nativeSrMethod(tag, method)) {
    if (invocation !== undefined || !dataArray(args)) throw invalid(`${method} requires an argument array.`);
    return { command: 'method', method, arguments: srMethodArguments(tag, method, args) };
  }
  // md-table / md-table-row / md-table-pagination methods (AWCTableController / AWCTablePaginationController), some with results.
  if (nativeTableMethod(tag, method)) {
    if (invocation !== undefined || !dataArray(args)) throw invalid(`${method} requires an argument array.`);
    return { command: 'method', method, arguments: tableMethodArguments(tag, method, args) };
  }
  // md-toolbar setFocus() (AWCToolbarController): no arguments, no result.
  if (nativeToolbarMethod(tag, method)) {
    if (invocation !== undefined || !dataArray(args) || args.length !== 0) throw invalid(`${method} requires no arguments.`);
    return { command: 'method', method, arguments: [] };
  }
  // Chart methods with results (AWCChartController).
  if (nativeChartMethod(tag, method)) {
    if (invocation !== undefined || !dataArray(args)) throw invalid(`${method} requires an argument array.`);
    return { command: 'method', method, arguments: chartMethodArguments(tag, method, args) };
  }
  if (nativeLifecycleMethod(tag, method)) {
    if (!dataArray(args) || !callID(invocation?.callId) || invocation.target !== 'component') throw invalid('Native lifecycle methods require an argument array, a call ID and the selected component target.');
    if (tag === 'md-menu' && method === 'show' && args.length) {
      const options = args[0];
      if (args.length !== 1 || !options || typeof options !== 'object' || Array.isArray(options) || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
        || Reflect.ownKeys(options).some(key => key !== 'autoFocus') || Object.hasOwn(options, 'autoFocus') && typeof options.autoFocus !== 'boolean') throw invalid('Menu show accepts no arguments or { autoFocus: boolean }.');
      return { command: 'method', target: 'component', callId: invocation.callId, method, arguments: [Object.hasOwn(options, 'autoFocus') ? { autoFocus: options.autoFocus } : {}] };
    }
    if (tag === 'md-snackbar' && method === 'hide') {
      if (args.length > 1 || args.length === 1 && !['auto', 'action', 'close'].includes(args[0])) throw invalid('Snackbar hide accepts no arguments or one reason: auto, action or close.');
    } else if (args.length) throw invalid('This lifecycle method requires no arguments.');
    return { command: 'method', target: 'component', callId: invocation.callId, method, arguments: [...args] };
  }
  if (nativeItemMethod(tag, method)) {
    if (tag === 'md-navigation-bar' && ['select', 'focusTab'].includes(method)) {
      if (invocation !== undefined || !dataArray(args) || args.length !== 1 || !Number.isInteger(args[0])) throw invalid(`${method} requires one destination index (an integer).`);
      return { command: 'method', method, arguments: [args[0]] };
    }
    if (tag === 'md-tabs' && method === 'selectTab') {
      if (invocation !== undefined || !dataArray(args) || args.length !== 1 || !Number.isInteger(args[0])) throw invalid('selectTab requires one tab index (an integer; an index outside the tabs is ignored).');
      return { command: 'method', method, arguments: [args[0]] };
    }
    if (tag === 'md-list' && method === 'selectItem') {
      if (invocation !== undefined || !dataArray(args) || args.length !== 1 || !Number.isInteger(args[0]) || args[0] < 0) throw invalid('selectItem requires one row index (an integer from 0).');
      return { command: 'method', method, arguments: [args[0]] };
    }
    if (tag === 'md-list-item' && method === 'setFocus') {
      const options = args?.[0];
      if (invocation !== undefined || !dataArray(args) || args.length > 1 || args.length === 1 && (!options || typeof options !== 'object' || Array.isArray(options)
        || Reflect.ownKeys(options).some(key => key !== 'focusVisible') || Object.hasOwn(options, 'focusVisible') && typeof options.focusVisible !== 'boolean')) throw invalid('setFocus accepts no arguments or { focusVisible: boolean }.');
      return { command: 'method', method, arguments: args.length ? [{ ...(Object.hasOwn(options, 'focusVisible') ? { focusVisible: options.focusVisible } : {}) }] : [] };
    }
    if (invocation !== undefined || !dataArray(args) || args.length) throw invalid(`${method} requires no arguments.`);
    return { command: 'method', method, arguments: [] };
  }
  if (nativeSelectionMethod(tag, method)) {
    if (invocation !== undefined || !dataArray(args)) throw invalid(`${method} requires an argument array.`);
    if (tag === 'md-number-field' && ['stepUp', 'stepDown'].includes(method)) {
      if (args.length > 1 || args.length === 1 && (typeof args[0] !== 'number' || !Number.isFinite(args[0]))) throw invalid(`${method} accepts no arguments or one finite repeat count.`);
      return { command: 'method', method, arguments: [...args] };
    }
    if (method === 'setCustomValidity') {
      if (args.length !== 1 || typeof args[0] !== 'string' || new TextEncoder().encode(args[0]).byteLength > 4096) throw invalid('setCustomValidity requires one string up to 4096 UTF-8 bytes.');
      return { command: 'method', method, arguments: [args[0]] };
    }
    if (args.length) throw invalid(`${method} requires no arguments.`);
    return { command: 'method', method, arguments: [] };
  }
  if (!nativeMethodSupported(tag, method) || invocation !== undefined) throw invalid('This method is unavailable in the native preview.');
  if (!dataArray(args) || args.length !== 1) throw invalid('setMenuIcon requires one string or null argument.');
  const value = args[0];
  if (value !== null && (typeof value !== 'string' || new TextEncoder().encode(value).byteLength > 4096)) throw invalid('setMenuIcon requires a string up to 4096 UTF-8 bytes, or null.');
  return { command: 'method', method, arguments: [value] };
}

/** Result queries never wait for the native lifecycle promise they inspect. */
export function nativeMethodResultsCommand(tag, callIds, acknowledged = []) {
  if (!['md-fab-menu', 'md-snackbar', 'md-tooltip', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet'].includes(tag) && tag !== 'md-menu') throw invalid('This component has no deferred native methods.');
  for (const ids of [callIds, acknowledged]) {
    if (!dataArray(ids) || ids.length > 32 || ids.some(id => !callID(id)) || new Set(ids).size !== ids.length) throw invalid('Use at most 32 distinct method call IDs.');
  }
  if (callIds.some(id => acknowledged.includes(id))) throw invalid('A pending call cannot also be acknowledged.');
  return { command: 'method-results', callIds: [...callIds], acknowledged: [...acknowledged] };
}

/** Validate correlation before any acknowledgement can settle a browser promise. */
export function nativeMethodReply(value, request) {
  const malformed = () => { throw Object.assign(new Error('The native host returned an invalid method result.'), { code: 'INVALID_METHOD_RESULT' }); };
  const errorDetail = error => {
    if (!error || typeof error.code !== 'string' || !/^[A-Z0-9_]{1,80}$/.test(error.code)
        || typeof error.message !== 'string' || !error.message.length || error.message.length > 512) malformed();
    return { code: error.code, message: error.message };
  };
  if (request.command === 'method' && request.callId) {
    const accepted = value?.methodCall;
    if (!accepted || accepted.callId !== request.callId || !['accepted', 'rejected'].includes(accepted.status)) malformed();
    if (accepted.status === 'accepted' && accepted.error !== undefined) malformed();
    return { methodCall: { callId: accepted.callId, status: accepted.status, ...(accepted.status === 'rejected' ? { error: errorDetail(accepted.error) } : {}) } };
  }
  if (request.command !== 'method-results') return {};
  if (!Array.isArray(value?.methodResults) || value.methodResults.length !== request.callIds.length) malformed();
  const remaining = new Set(request.callIds);
  const methodResults = value.methodResults.map(result => {
    if (!result || !remaining.delete(result.callId) || !['pending', 'fulfilled', 'rejected'].includes(result.status)) malformed();
    const normalized = { callId: result.callId, status: result.status };
    if (result.status === 'rejected') {
      normalized.error = errorDetail(result.error);
    } else if (result.error !== undefined) malformed();
    return normalized;
  });
  return { methodResults };
}

/** The resolved value of a synchronous native method: a boolean, row indices or a validity record. */
export function nativeMethodValue(value) {
  const malformed = () => { throw Object.assign(new Error('The native host returned an invalid method result.'), { code: 'INVALID_METHOD_RESULT' }); };
  // Table results: getSelection() → { count, total, values, all, indeterminate }; pinColumn() → start, end or null.
  const table = tableMethodValue(value); if (table) return table.value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') { if (!validChartMethodValue(value)) malformed(); return value; }
  if (Array.isArray(value)) { if (value.length > 1024 || !value.every(item => Number.isSafeInteger(item) && item >= 0)) malformed(); return [...value]; }
  if (!value || typeof value !== 'object' || Reflect.ownKeys(value).some(key => !['valid', 'validationMessage', 'flags'].includes(key))) malformed();
  if (typeof value.valid !== 'boolean' || typeof value.validationMessage !== 'string' || value.validationMessage.length > 4096 || !value.flags || typeof value.flags !== 'object' || Array.isArray(value.flags)) malformed();
  const flags = Object.entries(value.flags);
  if (flags.length > 16 || flags.some(([key, flag]) => !/^[a-zA-Z]{1,40}$/.test(key) || typeof flag !== 'boolean')) malformed();
  return { valid: value.valid, validationMessage: value.validationMessage, flags: Object.fromEntries(flags) };
}
