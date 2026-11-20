// R5-12 (story 9-11): rowSpan reaches the cell semantics. Web: aria-rowspan of a cell in the Chrome AX tree's DOM node; macOS: AXRowIndexRange
// (length); iOS: UIAccessibilityContainerDataTableCell.accessibilityRowRange (length); Android: CollectionItemInfo.rowSpan.
// A Web cell that spans N > 1 rows must have a native cell that reports N; a native platform that reports a range of 1 (or none) fails.
function collect(platform, value, out) {
  if (Array.isArray(value)) { for (const v of value) collect(platform, v, out); return out; }
  if (!value || typeof value !== 'object') return out;
  if (platform === 'web' && Number(value.rowSpan) > 1) out.push({ span: Number(value.rowSpan), name: value.name });
  if (platform === 'macos' && Array.isArray(value.rowIndexRange) && value.rowIndexRange[1] > 1) out.push({ span: value.rowIndexRange[1], name: value.title || value.description || value.value });
  if (platform === 'ios' && Array.isArray(value.rowRange) && value.rowRange[1] > 1) out.push({ span: value.rowRange[1], name: value.label });
  if (platform === 'android' && value.collectionItem?.rowSpan > 1) out.push({ span: value.collectionItem.rowSpan, name: value.text || value.contentDescription });
  for (const k of Object.keys(value)) if (typeof value[k] === 'object') collect(platform, value[k], out);
  return out;
}
export const rowSpans = (platform, raw) => collect(platform, platform === 'macos' ? raw.tree : platform === 'ios' ? raw.elements : platform === 'android' ? raw.windows : raw.tree, []);
export function spanFindings(platform, raw, webRaw, fixture = false) {
  const web = rowSpans('web', webRaw).map(s => s.span).sort(), native = rowSpans(platform, raw).map(s => s.span).sort();
  if (!web.length) return fixture ? [{ kind: 'span', detail: 'rowSpan: the Web capture of the rowspan fixture has no cell with aria-rowspan > 1 (fixture not applied)' }] : [];
  if (JSON.stringify(web) === JSON.stringify(native)) return [];
  return [{ kind: 'span', detail: `rowSpan: Web cells span rows [${web}] (${rowSpans('web', webRaw).map(s => `"${s.name}"`)}); ${platform} cells report row ranges [${native}]` }];
}
