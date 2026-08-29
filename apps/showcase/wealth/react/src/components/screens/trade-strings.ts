/**
 * The trade screen's translator.
 *
 * THIS FILE USED TO BE A SHIM. It carried 25 sentences the trade flow needs —
 * the split button's second action, the reasons a submit is unavailable, the
 * confirmation headline, the snackbar — in a `TRADE_PENDING_STRINGS` map,
 * because `packages/showcase-kit/src/i18n/en.ts` did not define them and five
 * other screens were being written against that file at the same time. `tx()`
 * asked the real translator first and only fell through to the map when `t()`
 * handed the key straight back, which is exactly what `createTranslator` does
 * for a key no locale knows.
 *
 * The keys are in the dictionary now, in all three locales, so the fallback can
 * never fire again — and the map could never have served `ro` or `ar` anyway,
 * which was the whole reason to move it. What is left is a name.
 *
 * `useTx` stays so the screen's call sites did not have to change, and the
 * `Tx` type stays because the screen threads it through a dozen components.
 */

import { useT } from '@/lib/showcase';
import type { TranslateParams } from '@awc-ui/showcase-kit/i18n';

/** A translate function. Kept as its own name because the screen passes it around. */
export type Tx = (key: string, params?: TranslateParams) => string;

/** `t()`. Nothing more, now that the dictionary carries every key it asks for. */
export function useTx(): Tx {
  return useT();
}
