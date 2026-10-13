import { renderCode } from './syntax-highlighting.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createAIInstructionsUI({ getState, notify }) {
  const cache = new Map();
  let generation = 0, rendered;
  async function load(refresh = false) {
    const tag = getState().selected?.tag;
    const panel = document.querySelector('#ai-instructions-panel');
    if (!tag || !panel) return;
    const request = ++generation;
    const existing = refresh && rendered?.tag === tag && panel.contains(rendered.card) ? rendered : null;
    panel.setAttribute('aria-busy', 'true');
    if (!existing) {
      rendered = undefined;
      panel.innerHTML = '<div class="coverage-loading" role="status"><md-progress-indicator variant="circular" indeterminate size="24" label="Loading AI instructions"></md-progress-indicator><span>Reading component instructions…</span></div>';
    }
    try {
      let guide = refresh ? null : cache.get(tag);
      if (!guide) {
        const response = await fetch(`/api/ai-instructions/${encodeURIComponent(tag)}`);
        if (!response.ok) throw new Error('The component instructions could not be loaded.');
        guide = await response.json();
      }
      if (request !== generation || getState().selected?.tag !== tag) return;
      cache.set(tag, guide);
      if (existing) {
        existing.guide = guide;
        existing.filename.textContent = guide.filename;
        void renderCode(existing.code, guide.markdown, 'markdown');
        return;
      }
      panel.innerHTML = `<div class="ai-instructions-heading"><div><h2>AI instructions</h2><p>The component guide for Web, iOS with SwiftUI, and Android with Jetpack Compose. Includes integration examples, supported APIs and platform limitations. Copy it into your coding assistant or save the Markdown file.</p></div></div>
        <md-card class="ai-instructions-card" variant="outlined" full-width>
          <div class="ai-instructions-toolbar"><strong>${escape(guide.filename)}</strong><div><md-button id="ai-copy" variant="text" size="xs" icon="content_copy">Copy</md-button><md-button id="ai-download" variant="text" size="xs" icon="download">Download .md</md-button><md-icon-button id="ai-refresh" icon="refresh" aria-label="Refresh AI instructions"></md-icon-button></div></div>
          <pre class="ai-instructions-code" tabindex="0" aria-label="${escape(tag)} Markdown instructions"></pre>
        </md-card>`;
      const view = rendered = { tag, guide, card: panel.querySelector('.ai-instructions-card'), filename: panel.querySelector('.ai-instructions-toolbar strong'), code: panel.querySelector('.ai-instructions-code') };
      void renderCode(view.code, guide.markdown, 'markdown');
      panel.querySelector('#ai-copy').addEventListener('mdClick', async () => {
        try { await navigator.clipboard.writeText(view.guide.markdown); notify('AI instructions copied'); }
        catch { notify('Clipboard unavailable'); }
      });
      panel.querySelector('#ai-download').addEventListener('mdClick', () => {
        const url = URL.createObjectURL(new Blob([view.guide.markdown], { type: 'text/markdown;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = view.guide.filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      panel.querySelector('#ai-refresh').addEventListener('mdClick', () => load(true));
    } catch (error) {
      if (request === generation && getState().selected?.tag === tag) {
        if (existing) notify(error.message);
        else panel.innerHTML = `<p class="load-error">${escape(error.message)}</p>`;
      }
    } finally {
      if (request === generation) panel.removeAttribute('aria-busy');
    }
  }
  return { load };
}
