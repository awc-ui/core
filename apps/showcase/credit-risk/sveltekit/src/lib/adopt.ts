import { base } from '$app/paths';
import { createSvelteHydration } from '@awc-ui/core/ssr/sveltekit';

const hydration = createSvelteHydration();
const RUNTIME_URL = `${base}/awc-runtime/md3/md3.esm.js`;

export function captureServerRender(): void {
  hydration.capture();
}

let started = false;
export function startComponentRuntime(): void {
  if (started) return;
  started = true;
  hydration.restore();
  void import(/* @vite-ignore */ RUNTIME_URL).catch((error) =>
    console.error('[awc-ui] component registration failed', error),
  );
}
