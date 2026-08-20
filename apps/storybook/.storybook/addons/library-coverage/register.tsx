/**
 * Removes the Vitest addon's own "Coverage" row from its panel.
 *
 * That row reports on apps/storybook — the stories, helpers and i18n files,
 * i.e. the TEST HARNESS — and links to /coverage/, which the addon owns and
 * regenerates. It reads exactly like library coverage and is not, so it is
 * removed rather than left to be believed.
 *
 * The real library report (packages/core, V8 remapped onto src via monocart) is
 * produced by `pnpm test:coverage` and served at /library-coverage/index.html.
 * It has no toolbar button by choice — open the URL directly.
 *
 * Done from the DOM because the addon exposes no option to disable the feature
 * (checked), its report cannot be intercepted server-side (its route sits above
 * the Vite middleware chain) and `coverage.enabled: false` in vitest.config is
 * overridden by the addon's own settings. All three were tried.
 *
 * Matched by LABEL TEXT, not class: the panel's class names are emotion-
 * generated hashes that change between builds. The row is required to contain a
 * checkbox so this cannot match unrelated list items.
 */
const removeAddonCoverageRow = () => {
  const scan = () => {
    for (const li of Array.from(document.querySelectorAll('li'))) {
      if ((li as HTMLElement).dataset.awcCoverageRemoved) continue;
      const label = li.querySelector('label');
      const box = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (!label || !box) continue;
      if ((label.textContent || '').trim() !== 'Coverage') continue;
      // Untick first: hiding a TICKED box would leave coverage running on every
      // test run with no way left to turn it off.
      if (box.checked) box.click();
      (li as HTMLElement).style.display = 'none';
      (li as HTMLElement).dataset.awcCoverageRemoved = '1';
    }
  };
  scan();
  // The panel mounts and re-renders long after the manager boots.
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeAddonCoverageRow, { once: true });
  } else {
    removeAddonCoverageRow();
  }
}
