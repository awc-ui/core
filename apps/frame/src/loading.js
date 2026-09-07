// AWC draws the placeholders. Only real content readiness removes them.
export const imageSkeleton = () => '<md-skeleton class="image-skeleton" variant="rectangular" animation="wave" full-width full-height announce="false"></md-skeleton>';

export function startupMarkup() {
  const row = '<md-skeleton variant="circular" width="40px" height="40px" announce="false"></md-skeleton><md-skeleton variant="text" lines="2" full-width announce="false"></md-skeleton>';
  return `<div id="startup-loading" class="startup-loading" role="status" aria-label="Loading Frame" aria-busy="true">
    <div class="startup-header"><md-skeleton variant="rounded" width="150px" height="32px" announce="false"></md-skeleton><md-skeleton variant="rounded" width="44rem" height="44px" announce="false"></md-skeleton></div>
    <div class="startup-content"><md-skeleton variant="text" width="min(26rem, 80%)" height="2.2rem" announce="false"></md-skeleton><md-skeleton variant="text" width="min(20rem, 65%)" announce="false"></md-skeleton>
    <div class="video-grid startup-grid">${Array.from({ length: 6 }, () => `<div><div class="startup-thumbnail">${imageSkeleton()}</div><div class="startup-row">${row}</div></div>`).join('')}</div></div>
    <span class="sr-only">Loading videos and controls…</span>
  </div>`;
}

export function trackImage(image, { onError = () => {} } = {}) {
  const surface = image.parentElement;
  const skeleton = surface.querySelector('.image-skeleton');
  let settled = false;
  surface.setAttribute('aria-busy', 'true');
  const settle = success => {
    if (settled) return;
    settled = true;
    skeleton?.remove();
    surface.setAttribute('aria-busy', 'false');
    image.hidden = !success;
    if (!success) onError();
  };
  const loaded = () => settle(image.naturalWidth > 0);
  const failed = () => settle(false);
  image.addEventListener('load', loaded, { once: true });
  image.addEventListener('error', failed, { once: true });
  if (image.complete) loaded();
  return () => {
    image.removeEventListener('load', loaded);
    image.removeEventListener('error', failed);
  };
}

// Keep shared feedback visible until every overlapping operation completes.
export function createActions(indicator) {
  const pending = new Map();
  const active = new Map();
  const regions = new Map();
  let disposed = false;
  const refresh = () => {
    indicator.hidden = !active.size || disposed;
    indicator.label = [...active.values()].at(-1) || 'Action complete';
  };
  return {
    run(button, label, operation, region) {
      if (disposed) return Promise.resolve();
      if (pending.has(button)) return pending.get(button);
      const token = {};
      active.set(token, label);
      button.loading = true;
      button.setAttribute('aria-busy', 'true');
      region?.setAttribute('aria-busy', 'true');
      if (region) regions.set(button, region);
      refresh();
      const promise = Promise.resolve().then(() => disposed ? undefined : operation()).finally(() => {
        pending.delete(button);
        active.delete(token);
        regions.delete(button);
        button.loading = false;
        button.setAttribute('aria-busy', 'false');
        region?.setAttribute('aria-busy', 'false');
        refresh();
      });
      pending.set(button, promise);
      return promise;
    },
    dispose() {
      disposed = true;
      for (const button of pending.keys()) { button.loading = false; button.setAttribute('aria-busy', 'false'); }
      for (const region of regions.values()) region.setAttribute('aria-busy', 'false');
      refresh();
    },
  };
}
