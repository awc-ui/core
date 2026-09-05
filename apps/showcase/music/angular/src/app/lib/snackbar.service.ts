/**
 * The one snackbar, raised from anywhere.
 *
 * ROOT-PROVIDED, because the transport bar lives in the app shell above the
 * router and raises messages of its own — a snackbar owned by the routed
 * component could not be reached from it, and one mounted in both places would
 * be two overlays fighting for the same corner.
 *
 * THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string.
 */
import { Injectable, signal } from '@angular/core';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  readonly message = signal<SnackbarMessage | null>(null);

  /* `null` is a legal argument and means "nothing worth announcing happened". */
  say(key: string | null, params?: Record<string, string | number>) {
    this.message.set(key === null ? null : { key, params });
  }

  close() {
    this.message.set(null);
  }
}
