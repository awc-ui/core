/**
 * The one snackbar, and the hook that raises it.
 *
 * SEVEN SCREENS RAISE ONE, so the wiring is written once. Each holds its own
 * instance — a snackbar is `position: fixed` and paints over the viewport, so
 * two mounted at once are two overlays fighting for the same corner, and a
 * shared one hoisted above the router would outlive the screen whose action it
 * is reporting.
 *
 * THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string. A screen that
 * built "You joined Nordic Film Club" itself would have composed a sentence in
 * English word order and handed it to the Arabic build intact.
 */

import { useCallback, useRef, useState } from 'react';
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '@/components/elements';
import './snackbar.css';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

export function useSnackbar() {
  const [message, setMessage] = useState<SnackbarMessage | null>(null);

  /* `null` is a legal argument and means "nothing worth announcing happened" —
     see the react/un-react asymmetry in PostCard. Accepting it here keeps that
     decision at the call site rather than making every caller guard. */
  const say = useCallback((key: string | null, params?: Record<string, string | number>) => {
    setMessage(key === null ? null : { key, params });
  }, []);

  const close = useCallback(() => setMessage(null), []);

  return { message, say, close };
}

export function Snackbar({
  message,
  onClose,
}: {
  message: SnackbarMessage | null;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLElement | null>(null);

  /* The component closes itself on the timeout and on the dismiss button; this
     listens so the screen's own state follows, or the next identical message
     would set `open` to a value it already has and never re-open. */
  useCustomEvent<CustomEvent<{ reason: string }>>(ref, 'mdClose', onClose);

  return (
    <md-snackbar
      ref={ref}
      class="app-snackbar"
      position="bottom"
      closeable
      auto-hide
      open={message !== null || undefined}
      message={message ? t(message.key, message.params) : ''}
      dismiss-label={t('community.action.close')}
    />
  );
}
