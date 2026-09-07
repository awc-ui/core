import { createSvelteHydration } from '@awc-ui/core/ssr/sveltekit';

// Shared by client init (before hydration) and the root layout (after hydration).
export const awcHydration = createSvelteHydration();
