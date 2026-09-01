/**
 * The trade screen's translator.
 *
 * IN THE REACT BUILD THIS FILE USED TO BE A SHIM: it carried 25 sentences the
 * trade flow needs — the split button's second action, the reasons a submit is
 * unavailable, the confirmation headline, the snackbar — while the kit's
 * dictionaries were still being written. The keys are in the dictionary now, in
 * all three locales, so `tx` is exactly `t`. What is left is a name.
 *
 * The name is kept here too, so the trade screens' call sites stay line-for-line
 * comparable with the React source: `$tx(…)` marks a string that lived in the
 * shim once, `$t(…)` one that never did. Both resolve through the same
 * translator store.
 */

import type { TranslateParams } from '@awc-ui/showcase-kit/i18n';

/** A translate function. Kept as its own name because the screen passes it around. */
export type Tx = (key: string, params?: TranslateParams) => string;

/** `t`. Nothing more, now that the dictionary carries every key it asks for. */
export { t as tx } from '$lib/showcase';
