// Prefix an in-app, root-relative path with the deployed base URL.
//
// Nuxt's own router primitives (<NuxtLink>, navigateTo, useRouter) already apply
// `app.baseURL`. Raw `href` attributes handed to web components do NOT — they end
// up verbatim on the <a> inside the component's shadow root — so every hardcoded
// "/..." destination has to go through this helper for the app to survive being
// mounted at a subpath.
export function appHref(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = useRuntimeConfig().app.baseURL || '/';
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
}
