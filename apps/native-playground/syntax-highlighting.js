const escape = value => value.replace(/[&<>"'\r]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;' })[char]);
const aliases = { web: 'html', react: 'tsx', angular: 'typescript', ios: 'swift', android: 'kotlin', js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash' };
const languages = new Set(['html', 'tsx', 'typescript', 'vue', 'svelte', 'swift', 'kotlin', 'javascript', 'json', 'css', 'bash']);
const normalize = language => aliases[language] || language;
const colors = color => /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(color || '') ? color : 'inherit';
const cache = new Map(), rendered = new WeakMap();
let vendor;

/** Escaped HTML token spans only. Never interpret the source as HTML or code. */
export async function highlightCode(code, language) {
  const source = String(code ?? ''), lang = normalize(language);
  if (!languages.has(lang) || source.length > 100000 || source.split(/\r?\n/).some(line => line.length > 10000)) return escape(source);
  const key = `${lang}\0${source}`;
  if (cache.has(key)) return cache.get(key);
  const result = (async () => {
    try {
      vendor ||= import('./syntax-vendor/highlighter.js');
      const lines = await (await vendor).tokens(source, lang);
      let html = '', cursor = 0;
      for (const token of lines.flat()) {
        // Use source offsets so CRLFs, tabs, Unicode and trailing newlines survive
        // exactly; do not trust a token renderer to reconstruct source text.
        if (token.offset < cursor || source.slice(token.offset, token.offset + token.content.length) !== token.content) return escape(source);
        html += escape(source.slice(cursor, token.offset));
        html += `<span class="syntax-token" style="--syntax-light:${colors(token.variants.light?.color)};--syntax-dark:${colors(token.variants.dark?.color)}">${escape(token.content)}</span>`;
        cursor = token.offset + token.content.length;
      }
      return html + escape(source.slice(cursor));
    } catch { return escape(source); } // Code remains readable if highlighting fails.
  })();
  cache.set(key, result);
  while (cache.size > 48) cache.delete(cache.keys().next().value);
  return result;
}

/** Paint plain text immediately, then highlight only the newest mounted request. */
export function renderCode(element, code, language) {
  if (!element) return Promise.resolve(false);
  const source = String(code ?? ''), lang = normalize(language);
  const previous = rendered.get(element);
  if (previous?.source === source && previous.lang === lang) return previous.promise;
  element.textContent = source;
  element.dataset.language = lang || 'text';
  element.dataset.codeHighlighted = 'pending';
  const request = { source, lang };
  rendered.set(element, request);
  request.promise = highlightCode(source, lang).then(html => {
    if (rendered.get(element) !== request || element.isConnected === false) return false;
    element.innerHTML = html;
    if (element.textContent !== source) {
      element.textContent = source; // HTML parsers cannot represent every control character.
      element.dataset.codeHighlighted = 'false';
      return false;
    }
    element.dataset.codeHighlighted = html.includes('class="syntax-token"') ? 'true' : 'false';
    return element.dataset.codeHighlighted === 'true';
  });
  return request.promise;
}
