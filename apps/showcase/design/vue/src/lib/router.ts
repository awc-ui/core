import { computed, ref, type ComputedRef, type Ref } from "vue";
import { BASE_PATH, withBase } from "~/lib/routes";

export function toAppPath(pathname: string): string {
  let path = pathname;
  if (path === BASE_PATH) path = "/";
  else if (path.startsWith(`${BASE_PATH}/`))
    path = path.slice(BASE_PATH.length);
  if (!path.startsWith("/")) path = `/${path}`;
  if (!path.endsWith("/")) path = `${path}/`;
  return path;
}

const currentPath = (): string =>
  toAppPath(typeof location === "undefined" ? "/" : location.pathname);

const pathname: Ref<string> = ref(currentPath());

export interface Router {
  pathname: string;
  push(href: string): void;
  replace(href: string): void;
}

function navigate(href: string, replace: boolean): void {
  const next = toAppPath(href);
  const url = `${withBase(next)}${location.search}${location.hash}`;
  if (replace) history.replaceState(history.state, "", url);
  else if (url !== location.pathname + location.search + location.hash) {
    history.pushState(null, "", url);
  }
  pathname.value = next;
  // A drill into a household from row 6 of a table otherwise opens halfway
  // down the new screen.
  window.scrollTo(0, 0);
}

export function startRouter(): void {
  pathname.value = currentPath();
  window.addEventListener("popstate", () => {
    pathname.value = currentPath();
  });
}

const router: Router = {
  get pathname() {
    return pathname.value;
  },
  push: (href: string) => navigate(href, false),
  replace: (href: string) => navigate(href, true),
};

export function useRouter(): Router {
  return router;
}

export function usePathname(): ComputedRef<string> {
  return computed(() => pathname.value);
}

export function isPlainActivation(
  event:
    | Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button">
    | undefined,
): boolean {
  if (!event) return true;
  if (event.button !== undefined && event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
