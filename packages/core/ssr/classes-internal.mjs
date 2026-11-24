export function reserved(token, tag) {
  return token === 'hydrated' || token === tag || token.startsWith(`${tag}--`) || token.startsWith('sc-md-');
}

/** Merge only library-owned classes; framework-owned classes stay authoritative. */
export function mergeSsrClasses(element, capturedClass) {
  const current = new Set(element.classList);
  for (const token of capturedClass.split(/\s+/)) {
    if (reserved(token, element.localName)) current.add(token);
  }
  const next = [...current].join(' ');
  if (next !== element.className) element.className = next;
}
