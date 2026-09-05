/**
 * The one snackbar, raised from anywhere.
 *
 * A MODULE STORE, WHERE CORVUS USES A PER-SCREEN COMPOSABLE — forced by this
 * vertical's shape. The transport bar lives in `AppFrame`, above the router,
 * and raises messages of its own; a snackbar owned by the current screen could
 * not be reached from it, and one mounted in both places would be two overlays
 * fighting for the same corner.
 *
 * THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string. A caller that
 * built "Muted Drums 1" itself would have composed a sentence in English word
 * order and handed it to the Arabic build intact.
 */

import { ref } from 'vue';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

const message = ref<SnackbarMessage | null>(null);

export function useSnackbar() {
  return {
    message,
    /* `null` is a legal argument and means "nothing worth announcing happened",
       which keeps that decision at the call site rather than in every caller. */
    say(key: string | null, params?: Record<string, string | number>) {
      message.value = key === null ? null : { key, params };
    },
    close() {
      message.value = null;
    },
  };
}
