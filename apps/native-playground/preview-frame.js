/**
 * Keep a newly navigated document out of the compositor until its current
 * theme and component are installed. Visibility preserves viewport geometry.
 */
export function initializePreviewFrame(frame, { tag, isCurrent, onDocument, onReady, onError }) {
  frame.style.visibility = 'hidden';
  frame.inert = true;
  frame.setAttribute('aria-busy', 'true');
  frame.addEventListener('load', async () => {
    const doc = frame.contentDocument;
    const current = () => isCurrent() && frame.isConnected && frame.contentDocument === doc;
    if (!current()) return;
    try {
      // Apply the current theme before waiting for the lazy component runtime.
      // Theme changes during that wait can now update this document as usual.
      onDocument(doc);
      await frame.contentWindow.customElements.whenDefined(tag);
      if (!current()) return;
      onReady(doc);
      await Promise.all([...doc.querySelectorAll('#preview-content *')].map(element => element.componentOnReady?.()));
      if (!current()) return;
      frame.style.visibility = '';
      frame.inert = false;
      frame.removeAttribute('aria-busy');
    } catch (error) {
      if (current()) onError(error);
    }
  }, { once: true });
}
