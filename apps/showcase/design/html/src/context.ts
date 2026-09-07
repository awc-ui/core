import { createDocumentStore, pictorText } from '@awc-ui/pictor-model';
import { createRoutes } from '@awc-ui/showcase-kit/design';
import { createTranslator } from '@awc-ui/showcase-kit/i18n';
import { getShowcaseState } from '@awc-ui/showcase-kit/dock';
export const store = createDocumentStore();
export const routeBinding = createRoutes('html');
export const { route, withBase } = routeBinding;
export const ui = new Map<string, any>();
let redraw = () => {};
let navigate = (_path: string) => {};
export const connect = (render: () => void, push: (path: string) => void) => { redraw = render; navigate = push; };
export const requestRender = () => redraw();
export const getDocument = () => store.getSnapshot();
export const getRouter = () => ({ push: navigate, pathname: window.location.pathname.slice(routeBinding.basePath.length) || '/' });
export function getTranslator(): any {
  const translator = createTranslator(getShowcaseState().locale);
  return Object.assign((message: string, params?: Record<string, string | number>) => translator.has(message) ? translator.t(message, params) : pictorText(translator.locale, message, params), {
    locale: translator.locale, dir: translator.dir, has: translator.has.bind(translator),
    formatNumber: translator.formatNumber.bind(translator),
    formatRelativeTime: translator.formatRelativeTime.bind(translator),
    formatDate: translator.formatDate.bind(translator),
  });
}
/** Explicitly named page fields; setters request a native DOM refresh. */
export function field<T>(key: string, initial: T | (() => T)): [T, (value: T | ((current: T) => T)) => void] {
  if (!ui.has(key)) ui.set(key, typeof initial === 'function' ? (initial as () => T)() : initial);
  return [ui.get(key), value => {
    ui.set(key, typeof value === 'function' ? (value as (current: T) => T)(ui.get(key)) : value);
    redraw();
  }];
}
export const calculate = <T>(fn: () => T, _dependencies?: unknown[]): T => fn();

/** Native render/event translation; never modifies authored document text. */
export const translateUi = (message: string, params?: Record<string, string | number>) => pictorText(getShowcaseState().locale, message, params);
