import { t } from "./i18n.js";
import { escapeHtml as esc } from "./model.js";

const pendingActions = new WeakMap();

// One action per host. Validation should happen before this boundary; work may
// finish synchronously, in which case no artificial loading duration is added.
export async function runAction(host, label, work) {
  if (host && pendingActions.has(host)) return { started: false };
  const button = host?.matches?.("md-button,md-icon-button")
    ? host
    : host?.querySelector?.('md-button[type="submit"]');
  const iconButton = button?.localName === "md-icon-button";
  const priorBusy = host?.getAttribute?.("aria-busy");
  const priorLoading = button?.loading;
  const priorSoftDisabled = button?.softDisabled;
  const priorLabel = button?.getAttribute?.("aria-label");
  const textNodes = button
    ? [...button.childNodes].filter(
        (node) => node.nodeType === 3 && node.textContent.trim(),
      )
    : [];
  const priorText = textNodes.map((node) => node.textContent);
  let indicator;
  const token = {};
  if (host) {
    pendingActions.set(host, token);
    host.setAttribute("aria-busy", "true");
  }
  if (button) {
    // The library's loader slot owns the spinner's layout and hides its artwork
    // from assistive tech. The button's translated name describes the action.
    indicator = document.createElement("md-progress-indicator");
    if (!iconButton) indicator.setAttribute("slot", "loader");
    indicator.setAttribute("variant", "circular");
    indicator.setAttribute("indeterminate", "");
    indicator.setAttribute("size", "24");
    indicator.setAttribute("label", t(label));
    indicator.setAttribute("aria-hidden", "true");
    button.append(indicator);
    if (iconButton) button.softDisabled = true;
    else button.loading = true;
    button.setAttribute("aria-label", t(label));
    if (textNodes[0]) textNodes[0].textContent = t(label);
  }
  try {
    return { started: true, value: await work() };
  } finally {
    indicator?.remove();
    if (button) {
      if (iconButton) button.softDisabled = priorSoftDisabled;
      else button.loading = priorLoading;
      if (priorLabel === null) button.removeAttribute("aria-label");
      else if (priorLabel !== undefined)
        button.setAttribute("aria-label", priorLabel);
      textNodes.forEach((node, index) => {
        node.textContent = priorText[index];
      });
    }
    if (host) {
      if (priorBusy === null) host.removeAttribute("aria-busy");
      else if (priorBusy !== undefined)
        host.setAttribute("aria-busy", priorBusy);
      if (pendingActions.get(host) === token) pendingActions.delete(host);
    }
  }
}

export async function waitForComponents(
  root,
  { timeoutMs = 15000, registry = customElements } = {},
) {
  const elements = [...root.querySelectorAll("*")].filter((el) =>
    el.localName.startsWith("md-"),
  );
  if (root.localName?.startsWith("md-")) elements.unshift(root);
  let timeout;
  try {
    await Promise.race([
      Promise.all(
        elements.map(async (el) => {
          await registry.whenDefined(el.localName);
          if (el.componentOnReady) await el.componentOnReady();
        }),
      ),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "The workspace could not finish loading. Please try again.",
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function skeletonMarkup(route = "overview") {
  const auth = ["login", "signup", "mfa", "recovery"].includes(route);
  const heading = `<md-skeleton variant="text" width="45%" height="2rem" aria-label="${esc(t("Loading workspace content…"))}"></md-skeleton><md-skeleton variant="text" width="65%" announce="false"></md-skeleton>`;
  if (auth)
    return `<div class="loading-auth">${heading}${Array.from({ length: route === "signup" ? 4 : 2 }, () => '<md-skeleton variant="rounded" full-width height="3.5rem" announce="false"></md-skeleton>').join("")}<md-skeleton variant="rounded" full-width height="3rem" announce="false"></md-skeleton></div>`;
  const rows = Array.from(
    { length: 5 },
    () =>
      '<div class="loading-row"><md-skeleton variant="circular" width="2.5rem" height="2.5rem" announce="false"></md-skeleton><md-skeleton variant="text" lines="2" full-width announce="false"></md-skeleton></div>',
  ).join("");
  if (route === "overview")
    return `${heading}<div class="loading-metrics">${Array.from({ length: 4 }, () => '<md-card variant="outlined"><md-skeleton variant="text" width="60%" announce="false"></md-skeleton><md-skeleton variant="text" width="40%" height="2rem" announce="false"></md-skeleton><md-skeleton variant="text" full-width announce="false"></md-skeleton></md-card>').join("")}</div><div class="loading-panels"><md-card variant="outlined"><md-skeleton variant="text" width="45%" announce="false"></md-skeleton><md-skeleton variant="rounded" full-width height="12rem" announce="false"></md-skeleton></md-card><md-card variant="outlined">${rows.slice(0, rows.indexOf("</div>") + 6).repeat(4)}</md-card></div>`;
  return `${heading}<md-card variant="outlined">${rows}</md-card>`;
}

const activeHydrations = new WeakMap();

// Keep connected components in place: moving a chart after initialization
// triggers its disconnectedCallback and destroys its rendering engine.
// The timeout controls when feedback appears, never when work may finish.
export async function hydrateRegion(
  region,
  route,
  { immediate = false, readyRoot = region } = {},
) {
  activeHydrations.get(region)?.();
  const children = [...region.children].map((element) => ({
    element,
    inert: element.inert,
  }));
  const previousBusy = region.getAttribute("aria-busy");
  const previousHydrating = region.getAttribute("data-hydrating");
  const placeholder = document.createElement("div");
  placeholder.className = "page-loading";
  let threshold;
  let cleaned = false;
  const restoreAttribute = (name, value) => {
    if (value === null) region.removeAttribute(name);
    else region.setAttribute(name, value);
  };
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(threshold);
    placeholder.remove();
    for (const { element, inert } of children) element.inert = inert;
    if (activeHydrations.get(region) === cleanup) {
      restoreAttribute("aria-busy", previousBusy);
      restoreAttribute("data-hydrating", previousHydrating);
      activeHydrations.delete(region);
    }
  };
  activeHydrations.set(region, cleanup);
  const current = () =>
    region.isConnected && activeHydrations.get(region) === cleanup;
  region.setAttribute("aria-busy", "true");
  region.setAttribute("data-hydrating", "");
  for (const { element } of children) element.inert = true;
  const show = () => {
    if (!current()) return;
    placeholder.innerHTML = skeletonMarkup(route);
    region.append(placeholder);
  };
  if (immediate) show();
  else threshold = setTimeout(show, 300);
  try {
    await waitForComponents(readyRoot);
    return current();
  } finally {
    cleanup();
  }
}
