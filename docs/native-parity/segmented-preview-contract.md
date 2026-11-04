# Segmented preview integration contract

Status: shared JavaScript implementation and regression checks are complete. Dedicated native implementation and available-runtime evidence are recorded separately in the [migration audit](md-segmented-button.md). Integrated Laboratory verification, iOS execution and final cross-platform acceptance remain pending. This contract alone does not declare native support.

The Laboratory entry is `md-segmented-button`. Its default composition contains a real `md-segmented-button-set` with Day/day, Week/week and Month/month children. Day is the editable target. Child identity comes from authored order, never from possibly duplicated or empty values.

The optional request context has exactly these fields:

```json
{
  "mode": "set",
  "multiselect": false,
  "density": 0,
  "selection": [true, false, false]
}
```

`mode` is `set` or `standalone`. Density is 0 through −4. Set selection contains exactly three Boolean values. Standalone selection is an empty array. In standalone mode there is no invented set wrapper; all thirteen source properties are editable.

In set mode the parent owns `segmentIndex`, `segmentTotal`, `segmentDensity` and `segmentMultiselect`. The Properties panel displays their derived values and directs editing to the composition controls. Selected, label, value and other child properties still apply to Day. Changing platform or other properties preserves actual child selection.

Native frames optionally carry `segmentedSelection`, an ordered Boolean vector from the rendered set state. The bridge checks its length against that session’s configured composition. The field is separate from event detail. A standalone `mdSegmentClick` is only a proposal; the Laboratory does not silently commit it. The source set commits by child identity and emits its own `mdChange` array.

Appearance uses `segmentedButtonAppearanceDefaults` and `segmentedButtonAppearance`, with seven validated fields in this order:

1. `containerColor`
2. `selectedContainerColor`
3. `labelColor`
4. `selectedLabelColor`
5. `outlineColor`
6. `cornerRadius`
7. `iconSize`

Defaults inherit through the set. Local appearance targets Day only. Compose examples scope that child directly. Swift examples assign Day the stable authored ID `segment-day` and use the implemented `.awcSegmentedButtonAppearance(..., nodeID: "segment-day")` public modifier. Both platforms' generated examples have separate compilation evidence in the migration audit.

The `icon` slot accepts literal text or `{ "kind": "symbol", "value": "favorite" }`. It is additional to the source property icon/checkmark reservation. Progress content is rejected. The default slot is literal label content and clears the masking `label` property when explicitly edited.

Shared verification: 207 focused tests passed at the initial checkpoint, including configuration, serialization across seven languages, source hook enumeration, same-component style scope, live transport correlation, existing documentation and server asset delivery. The saved log is `outputs/native-parity/md-segmented-button/shared-integration-tests.log` in the workspace output directory. Native runtime and final acceptance evidence remain separate from this shared checkpoint.
