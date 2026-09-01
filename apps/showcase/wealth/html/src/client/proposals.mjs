/**
 * The proposal builder's instruments step.
 *
 * WHY THIS FILE EXISTS. `md-transfer-list` takes its universe as `items`, a JS
 * PROPERTY holding an array of objects — and `value`, which has no attribute
 * form at all. A build that emits a string of HTML and stops cannot set either,
 * so the server render leaves the control empty and the step arrives with no
 * instruments in it. `screens/proposals.mjs` therefore ships the whole universe
 * (already translated, with the three fields eligibility reads) in `data-config`
 * on the stepper, and this module hands it to the element.
 *
 * WHAT ELIGIBILITY IS, AND WHY IT IS RECOMPUTED HERE RATHER THAN BAKED IN. The
 * React build disables an instrument when any of three controls on the SAME
 * screen rules it out — its type is excluded, ESG screening is on and it is an
 * energy-sector holding, or its asset class carries no weight. All three are
 * live form state, so a `disabled` flag written at build time would be right
 * only until the reader touched a checkbox. The seeded state (nothing excluded,
 * ESG off, weights = the mandate's targets) is what the server rendered, and
 * this recomputes from the controls' CURRENT state on every change.
 *
 * PRUNING IS PART OF THE CONTRACT, not a nicety: `md-transfer-list` never moves
 * a `disabled` item in either direction, so an instrument that becomes
 * ineligible while it is already chosen would be stranded on the target side
 * with no way to take it out. Anything that stops being eligible is dropped from
 * the value in the same pass that disables it — the same rule the React build's
 * comment states where it derives the proposed set.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. The rest of the builder's behaviour — the
 * linear stepper's veto, the validation ladder, the submit sequence and its undo
 * — is React state with no counterpart here, and the static page is complete and
 * readable without it, which is this build's standing contract. The universe is
 * different in kind: without it the step renders an empty control rather than a
 * simpler one.
 */

/** Asset classes carrying weight, read from the weights grid's number fields. */
function weightedClasses(root) {
  const carried = new Set();
  for (const field of root.querySelectorAll('[name^="weight-"]')) {
    const cls = field.getAttribute('name').slice('weight-'.length);
    // The field's `value` is a string on the attribute and a number once the
    // component upgrades; Number() covers both, and NaN fails the > 0 test.
    const n = Number(field.value ?? field.getAttribute('value'));
    if (n > 0) carried.add(cls);
  }
  return carried;
}

/** Instrument types the reader has excluded, from the type checkboxes. */
function excludedTypes(root) {
  const out = new Set();
  for (const box of root.querySelectorAll('md-checkbox[name="excludedTypes"]')) {
    if (box.checked) out.add(box.getAttribute('value'));
  }
  return out;
}

export function enhanceProposals(root = document) {
  const stepper = root.querySelector('md-stepper[data-builder]');
  if (!stepper || stepper.hasAttribute('data-bound')) return;

  const list = root.querySelector('md-transfer-list[data-field="transfer"]');
  if (!list) return;

  let config;
  try {
    config = JSON.parse(stepper.dataset.config || '');
  } catch {
    // A malformed payload is a build-time mistake, not a runtime condition. The
    // page keeps every figure it already rendered; only this control stays empty.
    console.error('[wealth] unreadable data-config on the proposal builder');
    return;
  }
  if (!Array.isArray(config.items)) return;
  stepper.setAttribute('data-bound', '');

  const esg = root.querySelector('md-switch[data-field="esg"]');

  /**
   * The chosen set — the instruments already held, which belong on the target
   * side from the first frame. It arrives in the config because `value` has no
   * attribute form for the server to write it into, and it is owned here
   * afterwards for the same reason: there is nothing to read it back from.
   */
  let chosen = Array.isArray(config.proposed) ? [...config.proposed] : [];

  const apply = () => {
    const excluded = excludedTypes(root);
    const weighted = weightedClasses(root);
    const screening = esg?.checked === true;

    const isEligible = (item) =>
      !excluded.has(item.type) &&
      !(screening && item.sector === 'energy') &&
      weighted.has(item.assetClass);

    // `disabled` is the only field the component reads beyond value/label/
    // description; type/sector/assetClass ride along for this function alone.
    list.items = config.items.map((item) => ({
      value: item.value,
      label: item.label,
      description: item.description,
      disabled: !isEligible(item),
    }));

    const eligibleIds = new Set(config.items.filter(isEligible).map((i) => i.value));
    const pruned = chosen.filter((id) => eligibleIds.has(id));
    if (pruned.length !== chosen.length) chosen = pruned;
    list.value = chosen;
  };

  list.addEventListener('mdChange', (event) => {
    chosen = Array.isArray(event.detail) ? [...event.detail] : [];
  });

  // Every control eligibility reads. `mdChange` covers the checkboxes and the
  // switch; the weight fields also emit `mdInput` while the reader types, and
  // an instrument should not stay enabled through a half-typed zero.
  for (const control of root.querySelectorAll(
    'md-checkbox[name="excludedTypes"], md-switch[data-field="esg"], [name^="weight-"]',
  )) {
    control.addEventListener('mdChange', apply);
    control.addEventListener('mdInput', apply);
  }

  apply();
}
