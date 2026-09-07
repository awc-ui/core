/**
 * The one snackbar, raised from anywhere.
 *
 * A MODULE STORE, because the transport bar lives in `AppFrame` above the
 * router and raises messages of its own — a snackbar owned by the current
 * screen could not be reached from it, and one mounted in both places would be
 * two overlays fighting for the same corner.
 *
 * THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string.
 */
import { writable } from 'svelte/store';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

export const snackbar = writable<SnackbarMessage | null>(null);

/* `null` is a legal argument and means "nothing worth announcing happened". */
export const say = (key: string | null, params?: Record<string, string | number>) =>
  snackbar.set(key === null ? null : { key, params });

export const closeSnackbar = () => snackbar.set(null);
