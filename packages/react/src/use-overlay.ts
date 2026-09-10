'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface AwcOverlayElement extends HTMLElement {
  show(): Promise<void>;
  close(): Promise<void>;
  whenClosed(): Promise<void>;
}

export interface UseOverlayOptions {
  /** Called at the native close event, before the shell exit completes. */
  onClosing?: () => void;
  /** Called after Core's exit completes. Safe to remove the React component. */
  onClosed?: () => void;
}

/**
 * Open a conditionally mounted Core overlay and retain it through its exit.
 * Spread the returned event handler onto MdDialog, MdSideSheet, or MdMenu.
 * Persistent anchor-managed FAB menus should manage their own open lifecycle.
 */
export function useOverlay<T extends AwcOverlayElement>(ref: RefObject<T | null>, options: UseOverlayOptions = {}) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const active = useRef<T | null>(null);
  const closing = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let disposed = false;
    active.current = element;
    closing.current = false;
    // A close before the first paint cancels show() without emitting mdClose.
    // Observe the native cycle independently so that case also releases the
    // React host. Each effect instance owns one completion (StrictMode-safe).
    void (async () => {
      await element.show();
      if (disposed) return;
      await element.whenClosed();
      if (!disposed && active.current === element) callbacks.current.onClosed?.();
    })();
    return () => {
      disposed = true;
      active.current = null;
      void element.close();
    };
  }, [ref]);

  const onMdClose = useCallback((event: CustomEvent<void>) => {
    const element = ref.current;
    if (!element || active.current !== element || closing.current || event.target !== element || event.currentTarget !== element) return;
    closing.current = true;
    callbacks.current.onClosing?.();
  }, [ref]);

  return { onMdClose };
}
