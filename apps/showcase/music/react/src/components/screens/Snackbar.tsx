/**
 * The one snackbar, raised from anywhere.
 *
 * A PROVIDER HERE, WHERE CORVUS USES ONE PER SCREEN — and the difference is
 * forced by this vertical's shape rather than being a preference. The transport
 * bar lives in `AppFrame`, ABOVE the router, and it raises messages of its own;
 * a snackbar owned by the current screen could not be reached from it, and one
 * mounted in both places would be two overlays fighting for the same corner.
 *
 * THE MESSAGE IS A KEY PLUS PARAMS, never a formatted string. A caller that
 * built "Muted Drums 1" itself would have composed a sentence in English word
 * order and handed it to the Arabic build intact.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '@/components/elements';
import './snackbar.css';

export interface SnackbarMessage {
  key: string;
  params?: Record<string, string | number>;
}

type Say = (key: string | null, params?: Record<string, string | number>) => void;

const SnackbarContext = createContext<Say>(() => {});

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [message, setMessage] = useState<SnackbarMessage | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  useCustomEvent<CustomEvent>(ref, 'mdClose', () => setMessage(null));

  /* `null` is a legal argument and means "nothing worth announcing happened" —
     taking an answer back is its own confirmation. Accepting it here keeps that
     decision at the call site rather than making every caller guard. */
  const say = useCallback<Say>((key, params) => {
    setMessage(key === null ? null : { key, params });
  }, []);

  const value = useMemo(() => say, [say]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <md-snackbar
        ref={ref}
        class="app-snackbar"
        open={message !== null || undefined}
        message={message ? t(message.key, message.params) : ''}
        duration={4000}
      />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): Say {
  return useContext(SnackbarContext);
}
