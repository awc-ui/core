import { writable } from 'svelte/store';

/** Latest toast request: { message: string, seq: number } | null */
export const toast = writable(null);

let seq = 0;

/** Ask the layout's snackbar to show a confirmation message. */
export function notify(message) {
  seq += 1;
  toast.set({ message, seq });
}
