/**
 * The state behind `SnackbarHost`, so a screen can raise a message in one call.
 *
 * `null` is a legal argument and means "nothing worth announcing happened" —
 * see the like/unlike asymmetry in `PostCard`. Accepting it here keeps that
 * decision at the call site rather than making every caller guard.
 */
import { writable } from 'svelte/store';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

export function createSnackbar() {
  const message = writable<SnackbarMessage | null>(null);
  const say = (key: string | null, params?: Record<string, string | number>) =>
    message.set(key === null ? null : { key, params });
  const close = () => message.set(null);
  return { message, say, close };
}
