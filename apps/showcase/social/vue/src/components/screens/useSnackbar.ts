/**
 * The state behind `SnackbarHost`, so a screen can raise a message in one call.
 *
 * `null` is a legal argument and means "nothing worth announcing happened" —
 * see the like/unlike asymmetry in `PostCard`. Accepting it here keeps that
 * decision at the call site rather than making every caller guard.
 */
import { ref } from 'vue';
import type { SnackbarMessage } from './SnackbarHost.vue';

export function useSnackbar() {
  const message = ref<SnackbarMessage | null>(null);
  const say = (key: string | null, params?: Record<string, string | number>) => {
    message.value = key === null ? null : { key, params };
  };
  const close = () => { message.value = null; };
  return { message, say, close };
}
