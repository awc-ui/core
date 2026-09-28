// These events measure outbound intent, not an npm installation or a GitHub star.
const PACKAGES = new Set(['core', 'react', 'angular', 'vue', 'svelte', 'tokens', 'theme', 'mcp']);

export function getOutboundIntent(href, baseUrl) {
  let url;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;

  if (url.hostname === 'github.com' && /^\/awc-ui\/core\/?$/.test(url.pathname)) {
    return 'github';
  }
  if (url.hostname === 'www.npmjs.com' || url.hostname === 'npmjs.com') {
    const packagePath = /^\/package\/@awc-ui\/([^/]+)(?:\/v\/[^/]+)?\/?$/.exec(url.pathname);
    if (packagePath && PACKAGES.has(packagePath[1])) return 'npm';
  }
  return null;
}

const trackers = new WeakMap();
const NAVIGATION_TIMEOUT_MS = 600;

/** Wire delegated tracking once; labels must come from the real Ads actions. */
export function setupOutboundConversions({ document, window, sendTo, enabled }) {
  if (!enabled) return () => {};
  if (trackers.has(document)) return trackers.get(document);

  // Repeated clicks on the same goal in this document do not inflate intent.
  // Google Ads must also use "One" to deduplicate across pages/ad interactions.
  const sent = new Set();
  const handleClick = (event) => {
    if (!event.isTrusted || event.defaultPrevented) return;
    if (event.type === 'click' ? event.button !== 0 : event.button !== 1) return;
    const anchor = event.composedPath().find((node) => node?.localName === 'a' && node.hasAttribute('href'));
    if (!anchor || anchor.hasAttribute('download') || anchor.getAttribute('aria-disabled') === 'true') return;

    const intent = getOutboundIntent(anchor.href, document.baseURI);
    const destination = intent && sendTo[intent];
    if (!intent || sent.has(intent) || !/^AW-\d+\/[\w-]+$/.test(destination ?? '') || typeof window.gtag !== 'function') return;

    const target = anchor.getAttribute('target') || document.querySelector('base[target]')?.getAttribute('target') || '_self';
    const delayNavigation = event.type === 'click' && !event.ctrlKey && !event.metaKey &&
      !event.shiftKey && !event.altKey && target.toLowerCase() === '_self';
    let navigate;
    let timer;
    if (delayNavigation) {
      event.preventDefault();
      let navigated = false;
      const href = anchor.href;
      navigate = () => {
        if (navigated) return;
        navigated = true;
        window.clearTimeout(timer);
        window.location.assign(href);
      };
      // A blocked tag must never prevent the visitor from leaving the site.
      timer = window.setTimeout(navigate, NAVIGATION_TIMEOUT_MS);
    }

    sent.add(intent);
    try {
      window.gtag('event', 'conversion', {
        send_to: destination,
        ...(navigate && { event_callback: navigate, event_timeout: NAVIGATION_TIMEOUT_MS }),
      });
    } catch {
      sent.delete(intent);
      navigate?.();
    }
  };

  document.addEventListener('click', handleClick);
  document.addEventListener('auxclick', handleClick);
  const cleanup = () => {
    document.removeEventListener('click', handleClick);
    document.removeEventListener('auxclick', handleClick);
    trackers.delete(document);
  };
  trackers.set(document, cleanup);
  return cleanup;
}
