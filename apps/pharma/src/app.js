import { createAuth, readSession, clearSession } from "./auth.js";
import * as model from "./model.js";
import {
  defaults,
  readPreferences,
  applyPreferences,
  savePreferences,
} from "./preferences.js";

const app = document.getElementById("app");
const overlays = document.getElementById("overlays");
const prefs = readPreferences();
applyPreferences(prefs);
let state;
try {
  state = model.parseStoredState(sessionStorage.getItem("vela.lab.state.v1"));
} catch {}
state ||= model.createInitialState();
let session = readSession();
let views;
let overlayViews;
let auth;
let route = "overview";
let navigationVersion = 0;
let overlayVersion = 0;
let busy = false;
let filters = {};
let reviewDecision = "approve";
const destinations = [
  ["overview", "Overview", "space_dashboard"],
  ["runs", "Test runs", "science"],
  ["compounds", "Compounds", "hub"],
  ["samples", "Samples", "inventory_2"],
  ["reviews", "Review queue", "fact_check"],
  ["team", "Research team", "groups"],
];
const mobileDestinations = destinations.slice(0, 5);
const escape = model.escapeHtml;
const ready = async (element) => {
  if (!element) return;
  await customElements.whenDefined(element.localName);
  await element.componentOnReady?.();
};
async function readyTree(root) {
  await Promise.all(
    [...root.querySelectorAll("*")]
      .filter((el) => el.localName.startsWith("md-"))
      .map(ready),
  );
}
async function toast(message) {
  const bar = document.getElementById("toast");
  await ready(bar);
  await bar.hide();
  bar.message = message;
  await bar.show();
}
const loadingView = () =>
  `<div aria-busy="true"><p class="eyebrow">Preparing your research workspace</p><md-skeleton width="280px" height="44px" aria-label="Loading laboratory records"></md-skeleton><div class="loading-grid">${Array.from({ length: 4 }, () => '<md-skeleton variant="rounded" height="150px" announce="false"></md-skeleton>').join("")}</div><md-skeleton variant="rounded" full-width height="350px" announce="false"></md-skeleton></div>`;
function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
}
function requestedRoute() {
  return location.hash.replace(/^#\/?/, "").split("?")[0];
}
function updateNavigation() {
  const index = destinations.findIndex(([key]) => key === route);
  const rail = document.getElementById("rail");
  if (rail) rail.activeIndex = index;
  const mobile = document.getElementById("mobile-nav");
  if (mobile) {
    mobile.hidden = index >= 5;
    if (index < 5) mobile.activeIndex = index;
  }
  const badge = rail?.querySelector('[value="reviews"]');
  if (badge) {
    const count = model.getMetrics(state).reviewRuns;
    badge.badgeValue = count ? String(count) : "";
  }
  document.title = `${destinations[index]?.[1] || "Workspace"} · Vela`;
}
async function renderRoute({ focus = false } = {}) {
  if (!session) return;
  const version = ++navigationVersion;
  const wanted = requestedRoute();
  route = destinations.some(([key]) => key === wanted) ? wanted : "overview";
  if (wanted !== route) history.replaceState(null, "", `#/${route}`);
  updateNavigation();
  const main = document.getElementById("main");
  if (!main) return;
  if (!views) {
    main.innerHTML = loadingView();
    views = await import("./views.js");
  }
  if (version !== navigationVersion || !session) return;
  const renderers = {
    overview: views.renderOverview,
    runs: views.renderRuns,
    compounds: views.renderCompounds,
    samples: views.renderSamples,
    reviews: views.renderReviews,
    team: views.renderTeam,
  };
  main.innerHTML = renderers[route](state, filters);
  await readyTree(main);
  if (version !== navigationVersion) return;
  await views.hydrateView(main, state);
  wireView(main);
  if (focus) {
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}
async function navigate(next, nextFilters) {
  if (nextFilters) filters = nextFilters;
  if (requestedRoute() === next) await renderRoute({ focus: true });
  else location.hash = `/${next}`;
}
function wireView(main) {
  const search = main.querySelector("#run-search");
  search?.addEventListener("mdInput", (event) => {
    filters = { ...filters, query: event.detail, page: 0 };
    // Preserve the search field, its focus, and its caret while replacing only results.
    updateRunResults(main);
  });
  for (const [id, key] of [
    ["run-status", "status"],
    ["run-assay", "assayType"],
  ]) {
    main.querySelector(`#${id}`)?.addEventListener("mdChange", (event) => {
      filters = { ...filters, [key]: event.detail, page: 0 };
      updateRunResults(main);
    });
  }
  main
    .querySelector("md-table-pagination")
    ?.addEventListener("mdPageChange", (event) => {
      filters = { ...filters, page: event.detail.page };
      updateRunResults(main);
    });
}
async function updateRunResults(main) {
  if (views.updateRunResults) {
    await views.updateRunResults(main, state, filters);
    return;
  }
  // The view module supplies a stable results region; fields never remount while typing.
  const template = document.createElement("template");
  template.innerHTML = views.renderRuns(state, filters);
  const current = main.querySelector("[data-run-results]");
  const next = template.content.querySelector("[data-run-results]");
  if (current && next) {
    current.replaceWith(next);
    await readyTree(next);
  }
}
function syncRail() {
  const rail = document.getElementById("rail");
  if (!rail) return;
  const variant = prefs.expanded ? "expanded" : "standard";
  const labels = prefs.expanded ? "all" : "none";
  if (rail.variant !== variant) rail.variant = variant;
  if (rail.labelVisibility !== labels) rail.labelVisibility = labels;
}
async function mountWorkspace(profile) {
  session = profile;
  auth?.dispose();
  app.innerHTML = `<div class="app-shell"><md-navigation-rail id="rail" variant="${prefs.expanded ? "expanded" : "standard"}" expandable full-height label-visibility="${prefs.expanded ? "all" : "none"}" toggle-label="Expand or collapse navigation" label="Vela workspace navigation" active-index="0">
    <span slot="logo" class="brand-mark" aria-label="Vela">v</span>
    <div slot="logo-expanded" class="brand-full"><span class="brand-word">vela</span><span class="brand-caption">Research operations</span></div>
    ${destinations.map(([key, label, icon]) => `<md-navigation-rail-tab value="${key}" href="#/${key}" label="${label}" icon="${icon}"></md-navigation-rail-tab>`).join("")}
    <md-icon-button slot="footer-leading" size="xs" aria-label="Your account" data-action="account"><md-avatar initials="${escape(initials(session.name))}" size="32"></md-avatar></md-icon-button>
    <div slot="footer-content" class="rail-account"><div class="rail-account-copy"><strong>${escape(session.name)}</strong><span>${escape(session.role)}</span></div><md-tooltip text="Sign out"><md-icon-button size="xs" icon="logout" aria-label="Sign out" data-action="sign-out"></md-icon-button></md-tooltip></div>
  </md-navigation-rail><div class="workspace"><md-app-bar id="appbar"><div slot="headline" class="bar-headline"><span class="icon" aria-hidden="true">biotech</span> Vela laboratories <small>Research workspace</small></div><md-tooltip slot="trailing" text="Make it yours"><md-icon-button icon="tune" aria-label="Make it yours" data-action="settings"></md-icon-button></md-tooltip><md-tooltip slot="trailing" text="Your account"><md-icon-button class="account-button" aria-label="Your account" data-action="account"><md-avatar initials="${escape(initials(session.name))}" size="36"></md-avatar></md-icon-button></md-tooltip></md-app-bar><main id="main" tabindex="-1">${loadingView()}</main><footer class="workspace-footer"><span>Vela · Pharmaceutical research &nbsp; / &nbsp; Fictional demonstration data</span><span><a href="#/overview">Overview</a> &nbsp; · &nbsp; <a href="#/team">Research team</a> &nbsp; · &nbsp; Built with awc-ui</span></footer></div>
  <md-navigation-bar class="mobile-navigation" id="mobile-nav" aria-label="Vela mobile navigation" active-index="0">${mobileDestinations.map(([, label, icon]) => `<md-navigation-tab label="${label === "Review queue" ? "Reviews" : label}" icon="${icon}" active-icon="${icon}"></md-navigation-tab>`).join("")}</md-navigation-bar></div>`;
  await readyTree(app);
  const rail = document.getElementById("rail");
  rail.addEventListener("mdTabChange", (event) => navigate(event.detail.value));
  const rememberRail = (expanded) => {
    prefs.expanded = expanded;
    syncRail();
    savePreferences(prefs);
  };
  rail.addEventListener("mdExpand", () => rememberRail(true));
  rail.addEventListener("mdCollapse", () => rememberRail(false));
  document
    .getElementById("mobile-nav")
    .addEventListener("mdChange", (event) => {
      if (event.target.id === "mobile-nav") {
        const next = mobileDestinations[event.detail.index]?.[0];
        if (next && next !== route) navigate(next);
      }
    });
  await renderRoute({ focus: true });
}
async function closeOverlay() {
  overlayVersion++;
  const overlay = overlays.querySelector("#workspace-overlay");
  if (overlay) {
    await ready(overlay);
    await overlay.close();
  }
  overlays.replaceChildren();
}
async function openOverlay(kind, id) {
  await closeOverlay();
  const version = ++overlayVersion;
  overlayViews ||= await import("./overlays.js");
  if (version !== overlayVersion) return;
  const renderers = {
    new: () => overlayViews.newRunView(state),
    run: () => overlayViews.runDetailView(state, id),
    compound: () => overlayViews.compoundDetailView(state, id),
    settings: () => overlayViews.settingsView(prefs),
    account: () => overlayViews.accountView(session),
  };
  overlays.innerHTML = renderers[kind]();
  await readyTree(overlays);
  if (version !== overlayVersion) return;
  const element = overlays.querySelector("#workspace-overlay");
  element.addEventListener("mdClose", (event) => {
    if (event.target === element) {
      overlayVersion++;
      overlays.replaceChildren();
    }
  });
  wireOverlay(kind);
  await element.show();
}
function errorInForm(form, message) {
  const box =
    form.querySelector(".form-error") || overlays.querySelector(".form-error");
  if (box) {
    box.textContent = message;
    box.setAttribute("role", "alert");
  } else void toast(message);
}
async function mutate(button, work, { form, close = false, id, message } = {}) {
  if (busy) return;
  busy = true;
  if (button) button.loading = true;
  form?.setAttribute("aria-busy", "true");
  try {
    // Give the library's action indicator a paint before updating the local dataset.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    state = work();
    try {
      sessionStorage.setItem("vela.lab.state.v1", JSON.stringify(state));
    } catch {}
    if (close || id) await closeOverlay();
    await renderRoute({ focus: close || Boolean(id) });
    if (id) await openOverlay("run", id);
    await toast(message || "Saved to this demo workspace.");
  } catch (error) {
    if (form) errorInForm(form, error.message);
    else await toast(error.message);
  } finally {
    busy = false;
    if (button?.isConnected) button.loading = false;
    form?.removeAttribute("aria-busy");
  }
}
function wireOverlay(kind) {
  const create = overlays.querySelector("#new-run-form");
  create?.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(create));
    fields.sampleCount = Number(fields.sampleCount);
    fields.analystId ||= null;
    mutate(
      create.querySelector('[type="submit"]'),
      () => model.createTestRun(state, fields),
      {
        form: create,
        close: true,
        message: "Test run created. Your new draft is ready.",
      },
    );
  });
  for (const [id, work, message] of [
    [
      "assign-form",
      (data, id) => model.assignAnalyst(state, id, data.analystId || null),
      "Analyst assignment updated.",
    ],
    [
      "note-form",
      (data, id) => model.addRunNote(state, id, data.note, session.name),
      "Research note added.",
    ],
    [
      "review-form",
      (data, id) =>
        model.reviewResult(state, id, {
          decision: data.decision,
          note: data.note,
          reviewer: session.name,
        }),
      "Result review recorded.",
    ],
  ]) {
    const form = overlays.querySelector(`#${id}`);
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = {
        ...Object.fromEntries(new FormData(form)),
        decision: reviewDecision,
      };
      const runId = form.dataset.id;
      const button = form.querySelector(
        reviewDecision === "retest" && id === "review-form"
          ? '[data-action="retest-run"]'
          : '[type="submit"]',
      );
      mutate(button, () => work(data, runId), { form, id: runId, message });
    });
  }
  reviewDecision = "approve";
  if (kind === "settings") {
    for (const [id, key, read] of [
      ["primary-color", "primary", (event) => event.detail.value],
      ["density", "density", (event) => Number(event.detail)],
      [
        "dark-mode",
        "theme",
        (event) => (event.detail.selected ? "dark" : "light"),
      ],
      ["rtl-mode", "rtl", (event) => event.detail.selected],
    ])
      overlays
        .querySelector(`#${id}`)
        ?.addEventListener("mdChange", (event) => {
          if (event.target.id !== id) return;
          const value = read(event);
          if (key === "primary" && !/^#[a-f0-9]{6}$/i.test(value)) return;
          prefs[key] = value;
          applyPreferences(prefs);
        });
  }
}
async function handleAction(event) {
  const target = event.composedPath().find((el) => el?.dataset?.action);
  if (!target || !session) return;
  const { action, id } = target.dataset;
  if (busy) return;
  if (action === "approve-run" || action === "retest-run") {
    reviewDecision = action === "approve-run" ? "approve" : "retest";
    return;
  }
  if (action === "new-run") return openOverlay("new");
  if (action === "open-run") return openOverlay("run", id);
  if (action === "open-compound") return openOverlay("compound", id);
  if (action === "settings") return openOverlay("settings");
  if (action === "close-overlay") return closeOverlay();
  if (action === "sign-out") {
    await closeOverlay();
    session = null;
    navigationVersion++;
    clearSession();
    await auth.signOut();
    document.title = "Sign in · Vela";
    return;
  }
  if (action === "account") return openOverlay("account");
  if (action === "reset-preferences") {
    Object.assign(prefs, defaults);
    syncRail();
    applyPreferences(prefs);
    return openOverlay("settings");
  }
  if (action === "show-analyst-runs")
    return navigate("runs", { analystId: id });
  if (action === "show-compound-runs")
    return navigate("runs", { compoundId: id });
  if (action === "filter-status")
    return navigate("runs", { status: target.dataset.status || id || "all" });
  if (action === "reset-filters") {
    filters = {};
    return renderRoute();
  }
  if (action === "advance-run")
    return mutate(target, () => model.advanceRun(state, id), {
      id,
      message: "Test run advanced to the next stage.",
    });
  if (action === "export") {
    const blob = new Blob(
      [model.toCsv(model.filterRuns(state.runs, filters))],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vela-test-runs.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return toast("Test runs exported as CSV.");
  }
}
app.addEventListener("mdClick", (event) => {
  void handleAction(event).catch((error) => toast(error.message));
});
overlays.addEventListener("mdClick", (event) => {
  void handleAction(event).catch((error) => toast(error.message));
});
window.addEventListener("hashchange", () => {
  if (session)
    void renderRoute({ focus: true }).catch((error) => toast(error.message));
});
auth = createAuth({ root: app, onAuthenticated: mountWorkspace });
if (session) await mountWorkspace(session);
else {
  await auth.render("login");
  document.title = "Sign in · Vela";
}
