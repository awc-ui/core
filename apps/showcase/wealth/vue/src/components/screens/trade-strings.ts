/**
 * The trade screen's translator.
 *
 * THIS FILE USED TO BE A SHIM in the React source. It carried 25 sentences the
 * trade flow needs — the split button's second action, the reasons a submit is
 * unavailable, the confirmation headline, the snackbar — in a
 * `TRADE_PENDING_STRINGS` map, because `packages/showcase-kit/src/i18n/en.ts`
 * did not define them and five other screens were being written against that
 * file at the same time. `tx()` asked the real translator first and only fell
 * through to the map when `t()` handed the key straight back.
 *
 * The keys are in the dictionary now, in all three locales, so the fallback can
 * never fire again — and the map could never have served `ro` or `ar` anyway,
 * which was the whole reason to move it. What is left is a name.
 *
 * `useTx` stays so the trade files read like their React twins, and the `Tx`
 * type stays because the React screen threads it through a dozen components —
 * here it only documents the call shape.
 */

import type { ComputedRef } from 'vue';
import type { TranslateParams } from '@awc-ui/showcase-kit/i18n';
import { useT, type T } from '~/composables/useShowcase';

/** A translate function. Kept as its own name because the screen passes it around. */
export type Tx = (key: string, params?: TranslateParams) => string;

/** `t()`. Nothing more, now that the dictionary carries every key it asks for. */
export function useTx(): ComputedRef<T> {
  return useT();
}
