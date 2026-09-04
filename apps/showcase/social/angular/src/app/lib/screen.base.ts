import { Directive, inject } from '@angular/core';
import { ShowcaseService, type T } from './showcase.service';
import { appPath, route, withBase } from './routes';

/**
 * What every component in this app needs: the translator, and the route table.
 *
 * A `@Directive()` with no selector is Angular's supported way to share
 * injected members with component subclasses — an abstract class alone would
 * not get its `inject()` calls resolved. Nothing here renders; it exists so a
 * template can say `t('kpi.ead')` and `appPath(route.sector(id))` without every
 * one of the twenty-odd components repeating the same four lines.
 */
@Directive()
export abstract class ShowcaseComponent {
  protected readonly showcase = inject(ShowcaseService);

  /** `t('table.ead')` and `t.formatCurrency(x)`, exactly as in the other builds. */
  protected get t(): T {
    return this.showcase.t;
  }

  protected readonly route = route;
  protected readonly withBase = withBase;
  protected readonly appPath = appPath;

  private readonly memos = new Map<string, { locale: string; value: unknown }>();

  /**
   * Cache a value that is expensive to rebuild and only changes with the locale.
   *
   * This exists for the CHARTS, and the reason is specific. `series`, `xAxis`
   * and `valueFormatter` have no attribute form, so they are property bindings —
   * and Angular dirty-checks a property binding by REFERENCE. An object literal
   * written inline in a template is a fresh object on every change-detection
   * pass, so the chart's `series` would be re-assigned on every mouse move and
   * Stencil would redraw the plot each time. Building them here instead means
   * the same array object is handed back until the language actually changes,
   * which is the only thing they depend on.
   *
   * Not needed for the tables: those bind attributes and iterate with a `track`
   * key, so a fresh array costs a diff rather than a redraw.
   */
  protected memo<V>(key: string, build: () => V): V {
    const locale = this.showcase.t.locale;
    const hit = this.memos.get(key);
    if (hit && hit.locale === locale) return hit.value as V;
    const value = build();
    this.memos.set(key, { locale, value });
    return value;
  }
}
