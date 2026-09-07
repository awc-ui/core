// The demo has no backend latency. A short asynchronous phase lets the native
// loading states be experienced without pretending to report network progress.
export const demoWait = (milliseconds = 450) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createActionRunner({
  wait = demoWait,
  onError = () => {},
  onStatus = () => {},
} = {}) {
  const pending = new Set();
  return async function runAction(
    key,
    button,
    label,
    work,
    { scope = button, isCurrent = () => true } = {},
  ) {
    if (pending.has(key)) return false;
    pending.add(key);
    const changed = [];
    const busyBefore = scope?.getAttribute("aria-busy");
    const labelBefore = button?.getAttribute("aria-label");
    const loadingBefore = button?.loading;
    try {
      onStatus(label);
      if (button?.localName === "md-button") {
        button.loading = true;
        button.setAttribute("aria-label", label);
      }
      scope?.setAttribute("aria-busy", "true");
      for (const control of scope?.querySelectorAll(
        "md-button,md-icon-button,md-text-field,md-otp-field,md-checkbox,md-select",
      ) || []) {
        if (control === button) continue;
        changed.push([control, control.disabled]);
        control.disabled = true;
      }
      await wait();
      if (scope?.isConnected === false || !isCurrent()) return false;
      await work();
      return true;
    } catch (error) {
      if (scope?.isConnected !== false && isCurrent()) onError(error);
      return false;
    } finally {
      for (const [control, disabled] of changed) control.disabled = disabled;
      if (scope) {
        if (busyBefore === null) scope.removeAttribute("aria-busy");
        else scope.setAttribute("aria-busy", busyBefore);
      }
      if (button?.localName === "md-button") {
        button.loading = loadingBefore || false;
        if (labelBefore === null) button.removeAttribute("aria-label");
        else button.setAttribute("aria-label", labelBefore);
      }
      pending.delete(key);
      if (!pending.size) onStatus("");
    }
  };
}

const block = (height, width = "100%") =>
  `<md-skeleton variant="rounded" animation="wave" width="${width}" height="${height}" announce="false"></md-skeleton>`;
const lines = (count = 2) =>
  `<md-skeleton variant="text" animation="wave" lines="${count}" full-width announce="false"></md-skeleton>`;
const cards = (count) =>
  Array.from(
    { length: count },
    () =>
      `<md-card class="loading-card" variant="outlined">${block("1rem", "60%")}${block("2.5rem", "45%")}${lines(1)}</md-card>`,
  ).join("");
export function skeletonView(route = "overview") {
  if (route === "equipment")
    return `<div class="loading-stack" role="status" aria-label="Loading equipment details">${block("1rem", "45%")}${block("3rem", "65%")}${block("110px")}${lines(3)}${block("8rem")}</div>`;
  const heading = `<div class="loading-heading">${block("2.5rem", "min(20rem, 80%)")}${block("1rem", "min(30rem, 95%)")}</div>`;
  let content;
  if (route === "assets")
    content = `<md-table-container variant="outlined"><md-table loading loading-mode="skeleton" loading-rows="5" min-width="760px" label="Loading equipment" column-template="minmax(195px,1.6fr) minmax(115px,1fr) minmax(115px,1fr) minmax(110px,1fr) minmax(120px,1fr) 85px"><md-table-head><md-table-row rowgroup="head">${["Equipment", "Area", "Status", "Reading", "Health", "Details"].map((label) => `<md-table-cell head scope="col">${label}</md-table-cell>`).join("")}</md-table-row></md-table-head></md-table></md-table-container>`;
  else if (route === "trends")
    content = `<md-card variant="outlined" class="loading-card">${lines(2)}${block("390px")}</md-card>`;
  else if (route === "settings")
    content = `<div class="settings-grid">${cards(4)}</div>`;
  else if (route === "alarms")
    content = `<div class="alarm-stats">${cards(3)}</div><div class="loading-stack">${cards(3)}</div>`;
  else
    content = `<div class="metrics">${cards(4)}</div><div class="dashboard-grid"><md-card variant="outlined" class="loading-card">${lines(2)}${block("235px")}</md-card><md-card variant="outlined" class="loading-card">${lines(3)}${lines(3)}${lines(3)}</md-card></div><div class="process-flow">${cards(4)}</div>`;
  return `<section class="loading-view" role="status" aria-label="Loading workspace">${heading}${content}</section>`;
}
