import { Injectable, NgZone, computed, inject, signal, type Signal } from '@angular/core';
import { DEFAULT_STATE, subscribeShowcaseState, type ShowcaseState } from '@awc-ui/showcase-kit/dock';
import {
  createTranslator,
  type TranslateParams,
  type Translator,
} from '@awc-ui/showcase-kit/i18n';

/**
 * The kit's `Translator` is an object with a `t` METHOD, which reads as
 * `t.t('table.ead')` at every call site. Screens call it hundreds of times, so
 * it is flattened into a callable that still carries the locale-bound `format*`
 * methods: `t('table.ead')` and `t.formatCurrency(x)` on one value — the same
 * shape the React, Svelte and Vue ports use, so a template can be read beside
 * its twin and differ only where the framework does.
 */
export type T = ((key: string, params?: TranslateParams) => string) &
  Pick<Translator, 'has' | 'formatCurrency' | 'formatNumber' | 'formatPercent' | 'formatDate'> & {
    readonly locale: Translator['locale'];
    readonly dir: Translator['dir'];
  };

function callable(translator: Translator): T {
  const fn = ((key: string, params?: TranslateParams) => translator.t(key, params)) as T;
  return Object.assign(fn, {
    has: (key: string) => translator.has(key),
    formatCurrency: translator.formatCurrency.bind(translator),
    formatNumber: translator.formatNumber.bind(translator),
    formatPercent: translator.formatPercent.bind(translator),
    formatDate: translator.formatDate.bind(translator),
    locale: translator.locale,
    dir: translator.dir,
  });
}

/**
 * The bridge between `<awc-showcase-dock>` and Angular.
 *
 * `subscribeShowcaseState` fires immediately with the current state and returns
 * an unsubscribe, which is exactly what a root-provided service wants. We
 * deliberately do NOT also listen for the `awc-showcase-change` event — the dock
 * dispatches it on `window` AND on the element, and listening to both would
 * update twice per change.
 *
 * ONE SUBSCRIPTION FOR THE WHOLE APP, because the service is a root singleton:
 * twenty components reading `t` on one screen share one listener.
 *
 * THE STARTING POINT IS `DEFAULT_STATE` (en / ltr), the same one every other
 * build begins from, and in this build it is briefly visible: the dock is a
 * DYNAMIC import in the `APP_INITIALIZER`, so the first render happens in
 * English and the real locale arrives a tick later, when the module has loaded
 * and `subscribeShowcaseState` fires. What the reader does not see is the wrong
 * THEME or the wrong DIRECTION — those are stamped onto `<html>` by the preboot
 * script in `<head>`, before any of this runs.
 *
 * The `document` guard below is what makes this file safe to share verbatim with
 * the server-rendered twin next door, where the same constructor runs in a
 * DOM-less Node context. Here there is always a document, and the guard costs a
 * branch.
 */
@Injectable({ providedIn: 'root' })
export class ShowcaseService {
  private readonly current = signal<ShowcaseState>(DEFAULT_STATE);

  /** The raw dock state, as a signal. */
  readonly state: Signal<ShowcaseState> = this.current.asReadonly();

  private readonly translator = computed(() => callable(createTranslator(this.current().locale)));

  private readonly zone = inject(NgZone);

  constructor() {
    // `document` rather than `window`: the twin's server render runs in a
    // DOM-less Node context, and this is the check that keeps the subscription
    // out of it. In this build it is always true.
    if (typeof document === 'undefined') return;

    /*
     * `zone.run` is not optional here, and the failure it prevents is silent.
     *
     * The dock is a plain custom element that registers its own listeners when
     * the browser upgrades it — outside Angular's zone. So a language change
     * updated the signal correctly and NOTHING re-rendered: `t.locale` read
     * `ro` while every string on screen stayed English, with no error anywhere.
     * Running the update inside the zone is what tells Angular a change
     * happened; it is the documented remedy for a third-party callback that
     * Angular did not register.
     */
    subscribeShowcaseState((detail) => this.zone.run(() => this.current.set(detail.state)));
  }

  /**
   * The locale-bound translator. A getter rather than a signal read at the call
   * site so templates say `t('kpi.ead')` and `t.formatCurrency(x)`, matching the
   * other five builds exactly. Zone-based change detection re-evaluates it when
   * the dock publishes, because the dock's own listener runs inside the zone.
   */
  get t(): T {
    return this.translator();
  }
}
