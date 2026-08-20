/// <reference lib="webworker" />
/**
 * Theme Generator Web Worker
 *
 * Off-main-thread HCT computation for responsive color-picker drag.
 * Messages in:  { type: 'compute', primaryHex, secondaryHex?, tertiaryHex? }
 * Messages out: { type: 'palette', tones, roles, sources, durationMs }
 *               { type: 'error', message }
 */
import { computeTheme } from './compute-theme';
import type { ThemeWorkerRequest, ThemeWorkerResponse } from './types';

self.addEventListener('message', (e: MessageEvent<ThemeWorkerRequest>) => {
  try {
    if (!e.data || e.data.type !== 'compute') {
      const response: ThemeWorkerResponse = {
        type: 'error',
        message: `Unexpected message type: ${(e.data as { type?: string })?.type ?? 'undefined'}`,
      };
      (self as unknown as Worker).postMessage(response);
      return;
    }

    const { type: _type, ...request } = e.data;
    const result = computeTheme(request);
    const response: ThemeWorkerResponse = {
      type: 'palette',
      ...result,
    };
    (self as unknown as Worker).postMessage(response);
  } catch (err) {
    const response: ThemeWorkerResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
    (self as unknown as Worker).postMessage(response);
  }
});
