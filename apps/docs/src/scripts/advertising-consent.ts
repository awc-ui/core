const VERSION = "advertising-2026-10-07-v2";
const CHOICE_KEY = "awc:advertising:choice";
const REVOKE_PREFIX = "awc:advertising:revoke:";
const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const GOOGLE_ID = "AW-18474243980";
const validClick = (value: string) => value.length > 0 && value.length <= 500 && !/[^A-Za-z0-9_-]/.test(value);
const GOOGLE_CLICKS = ["gclid", "gbraid", "wbraid"] as const;
const CLICK_COOKIES = ["_awc_rdt_cid", ...GOOGLE_CLICKS.map((key) => `_awc_${key}`)];

type Choice = {
  version: string;
  decision: "accepted" | "rejected";
  at: number;
  token?: string;
};
type Measurement = {
  consent: true;
  version: string;
  token: string;
  fbp?: string;
  fbc?: string;
  rdt_cid?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
};
type AdvertisingWindow = Window & {
  awcAdvertising?: { signupMeasurement(): Measurement | undefined };
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

let initialized = false;

export function initializeAdvertisingConsent(): void {
  if (initialized) return;
  const config = document.querySelector<HTMLElement>("[data-advertising-config]");
  if (!config) return;
  initialized = true;
  const production = config.dataset.production === "true" && location.protocol === "https:" && location.hostname === "awc-ui.dev";
  const metaEnabled = production && config.dataset.meta === "true";
  const googleEnabled = production && config.dataset.google === "true";
  const redditEnabled = production && config.dataset.reddit === "true";
  const googleMeasurementEnabled = production && config.dataset.googleMeasurement === "true";
  let forcedOff = new URLSearchParams(location.search).get("awc_advertising") === "off";
  const win = window as AdvertisingWindow;
  let choice: Choice | undefined;
  let googleLoaded = false;
  let expiryTimer: number | undefined;
  const inFlight = new Set<string>();
  const memoryRevocations = new Set<string>();
  const read = (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const write = (key: string, value: string): boolean => {
    try { localStorage.setItem(key, value); return read(key) === value; } catch { return false; }
  };
  const remove = (key: string) => {
    try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
  };
  const sessionRead = (key: string): string | null => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  };
  const sessionWrite = (key: string, value: string): boolean => {
    try { sessionStorage.setItem(key, value); return sessionRead(key) === value; } catch { return false; }
  };
  const sessionRemove = (key: string) => {
    try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
  };
  const rawChoice = (): Choice | undefined => {
    try {
      // This tab may have withdrawn after localStorage became unavailable.
      const value: unknown = JSON.parse(sessionRead(CHOICE_KEY) ?? read(CHOICE_KEY) ?? "null");
      if (!value || typeof value !== "object") return;
      const record = value as Choice;
      if ((record.decision !== "accepted" && record.decision !== "rejected") ||
          !Number.isSafeInteger(record.at) || typeof record.version !== "string") return;
      return record;
    } catch { return; }
  };
  const valid = (record: Choice | undefined): record is Choice => Boolean(record &&
    record.version === VERSION && record.at <= Date.now() && record.at > Date.now() - MAX_AGE &&
    (record.decision === "rejected" || (typeof record.token === "string" && TOKEN.test(record.token))));
  const newToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const queueRevocation = (token: string | undefined) => {
    if (!token || !TOKEN.test(token)) return true;
    memoryRevocations.add(token);
    return write(`${REVOKE_PREFIX}${token}`, "pending") || sessionWrite(`${REVOKE_PREFIX}${token}`, "pending");
  };
  const retryRevocations = async () => {
    if (!production) return;
    for (const storageName of ["localStorage", "sessionStorage"] as const) {
      try {
        const storage = window[storageName];
        for (let index = 0; index < storage.length; index++) {
          const key = storage.key(index);
          if (key?.startsWith(REVOKE_PREFIX) && TOKEN.test(key.slice(REVOKE_PREFIX.length))) {
            memoryRevocations.add(key.slice(REVOKE_PREFIX.length));
          }
        }
      } catch { /* In-memory revocation still works when storage is unavailable. */ }
    }
    await Promise.all([...memoryRevocations].map(async (token) => {
      if (inFlight.has(token)) return;
      inFlight.add(token);
      const abort = new AbortController();
      const timeout = window.setTimeout(() => abort.abort(), 10_000);
      try {
        const response = await fetch("/api/advertising/withdraw", {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ token }), credentials: "omit", mode: "same-origin",
          redirect: "error", cache: "no-store", referrerPolicy: "no-referrer", keepalive: true,
          signal: abort.signal,
        });
        if (response.ok && (await response.json())?.ok === true) {
          memoryRevocations.delete(token);
          remove(`${REVOKE_PREFIX}${token}`);
          sessionRemove(`${REVOKE_PREFIX}${token}`);
          // With both stores full, keep the original capability until ACK.
          if (choice?.decision !== "accepted" && rawChoice()?.token === token) remove(CHOICE_KEY);
          if (choice?.decision !== "accepted" && memoryRevocations.size === 0) {
            status.textContent = "Advertising is off. Your withdrawal request was received.";
          }
        }
      } catch { /* Retry on the next page load or online event. */ }
      finally { window.clearTimeout(timeout); inFlight.delete(token); }
    }));
  };
  const expireCookie = (name: string) => {
    for (const domain of ["", location.hostname, `.${location.hostname}`]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain ? `; Domain=${domain}` : ""}`;
    }
  };
  const clearCookies = () => {
    // Expire host-only and historical parent-domain cookies, including linker IDs.
    for (const entry of document.cookie.split(";")) {
      const name = entry.trim().split("=")[0];
      if (name !== "_fbp" && name !== "_fbc" && !name.startsWith("_gcl_") && !CLICK_COOKIES.includes(name)) continue;
      expireCookie(name);
    }
  };
  const cookie = (name: string) => document.cookie.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  const identifier = (value: string | undefined, kind: "fbp" | "fbc") => {
    if (!value) return;
    const match = /^fb\.1\.(\d{13})\.([A-Za-z0-9_-]{1,500})$/.exec(value);
    if (!match || (kind === "fbp" && !/^\d{1,20}$/.test(match[2]))) return;
    const at = Number(match[1]);
    if (at > Date.now() || at <= Date.now() - MAX_AGE) return;
    return value;
  };
  const saveCookie = (name: string, value: string) => {
    const remaining = Math.max(0, Math.floor(((choice?.at ?? 0) + MAX_AGE - Date.now()) / 1000));
    document.cookie = `${name}=${value}; Max-Age=${remaining}; Path=/; SameSite=Lax; Secure`;
  };
  const captureMeta = () => {
    if (!metaEnabled || !valid(choice) || choice.decision !== "accepted") return;
    if (!identifier(cookie("_fbp"), "fbp")) {
      const random = crypto.getRandomValues(new Uint32Array(2));
      saveCookie("_fbp", `fb.1.${Date.now()}.${random[0]}${random[1]}`);
    }
    const clicks = new URLSearchParams(location.search).getAll("fbclid");
    if (clicks.length === 1 && /^[A-Za-z0-9_-]{1,500}$/.test(clicks[0])) {
      const current = identifier(cookie("_fbc"), "fbc");
      if (current?.split(".").slice(3).join(".") !== clicks[0]) {
        saveCookie("_fbc", `fb.1.${Date.now()}.${clicks[0]}`);
      }
    }
  };
  const captureClicks = () => {
    if (!valid(choice) || choice.decision !== "accepted") return;
    const params = new URLSearchParams(location.search);
    if (redditEnabled && params.has("rdt_cid")) {
      const clicks = params.getAll("rdt_cid");
      expireCookie("_awc_rdt_cid");
      if (clicks.length === 1 && validClick(clicks[0])) saveCookie("_awc_rdt_cid", clicks[0]);
    }
    if (googleMeasurementEnabled) {
      const clicks = GOOGLE_CLICKS.flatMap((key) => params.getAll(key).map((value) => ({ key, value })));
      if (clicks.length > 0) {
        // A new landing replaces previous Google attribution. Never select an
        // arbitrary winner from duplicate or conflicting identifiers.
        for (const key of GOOGLE_CLICKS) expireCookie(`_awc_${key}`);
        if (clicks.length === 1 && validClick(clicks[0].value)) saveCookie(`_awc_${clicks[0].key}`, clicks[0].value);
      }
    }
  };
  const capturedClick = (key: string) => {
    const value = cookie(`_awc_${key}`);
    return value && validClick(value) ? value : undefined;
  };
  const denied = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" };
  const loadGoogle = () => {
    // Avoid loading third-party code on links that might contain private tokens.
    // Meta click attribution remains available independently after consent.
    if (!googleEnabled || googleLoaded || location.search || location.hash) return;
    googleLoaded = true;
    win.dataLayer = win.dataLayer || [];
    win.gtag = function () {
      // Preserve the documented Google tag command queue representation.
      // eslint-disable-next-line prefer-rest-params
      win.dataLayer!.push(arguments);
    };
    win.gtag("consent", "default", denied);
    win.gtag("set", "url_passthrough", false);
    win.gtag("set", "ads_data_redaction", true);
    win.gtag("consent", "update", { ...denied, ad_storage: "granted", ad_user_data: "granted" });
    win.gtag("js", new Date());
    win.gtag("config", GOOGLE_ID, {
      page_location: "https://awc-ui.dev/", page_referrer: "", page_title: "AWC UI",
      allow_google_signals: false, allow_ad_personalization_signals: false,
      allow_enhanced_conversions: false,
      cookie_expires: Math.max(0, Math.floor(((choice?.at ?? 0) + MAX_AGE - Date.now()) / 1000)), cookie_update: false,
      cookie_domain: "none", cookie_flags: "SameSite=Lax;Secure",
    });
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ID}`;
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.dataset.awcGoogle = "";
    document.head.append(script);
  };

  const root = document.createElement("div");
  root.className = "awc-advertising";
  root.innerHTML = `<section class="awc-advertising-panel" aria-labelledby="awc-advertising-title" aria-describedby="awc-advertising-description" hidden>
    <div class="awc-advertising-copy">
      <h2 id="awc-advertising-title" tabindex="-1">Advertising preferences</h2>
      <p id="awc-advertising-description">Allow Google Ads, Meta and Reddit to use advertising identifiers to measure ads and waitlist signups. Joining works either way.</p>
      <p class="awc-advertising-details">Your choice lasts up to 90 days. <a href="/privacy/#advertising-measurement" aria-label="Read about advertising and your data">Details</a></p>
    </div>
    <div class="awc-advertising-actions"><button type="button" aria-label="Reject advertising" data-advertising-reject>Reject</button><button type="button" aria-label="Accept advertising" data-advertising-accept>Accept</button></div>
    <button class="awc-advertising-close" type="button" data-advertising-close aria-label="Close advertising preferences">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
    </button>
    <p data-advertising-status role="status" aria-live="polite"></p>
  </section><button class="awc-advertising-preferences" type="button" data-advertising-preferences>Advertising preferences</button>`;
  document.body.append(root);
  const panel = root.querySelector<HTMLElement>("section")!;
  const status = root.querySelector<HTMLElement>("[data-advertising-status]")!;
  const close = root.querySelector<HTMLButtonElement>("[data-advertising-close]")!;
  const preferences = root.querySelector<HTMLButtonElement>("[data-advertising-preferences]")!;
  const show = (focus = false) => {
    panel.hidden = false;
    preferences.hidden = true;
    status.textContent = choice?.decision === "accepted" ? "Currently on. Choose Reject to withdraw permission." : "";
    if (focus) root.querySelector<HTMLElement>("h2")!.focus();
  };
  const hide = () => { panel.hidden = true; preferences.hidden = false; };
  const stop = (reload = true) => {
    window.clearTimeout(expiryTimer);
    clearCookies();
    if (googleLoaded) {
      win.gtag?.("consent", "update", denied);
      document.querySelector("[data-awc-google]")?.remove();
    }
    if (!reload) {
      // With both stores unavailable, the old stored capability must survive.
      // This non-identifying marker also protects Meta-only campaign pages on
      // reload while withdrawal is pending. Never put the capability in a URL.
      forcedOff = true;
      const url = new URL(location.href);
      url.searchParams.set("awc_advertising", "off");
      if (googleLoaded) location.replace(url);
      else history.replaceState(history.state, "", url);
    } else if (googleLoaded) {
      // Removing a script cannot unload its code. Persist denial before reloading.
      location.reload();
    }
  };
  const reject = () => {
    const durable = queueRevocation(choice?.token);
    choice = { version: VERSION, decision: "rejected", at: Date.now() };
    const record = JSON.stringify(choice);
    const saved = durable && (write(CHOICE_KEY, record) || sessionWrite(CHOICE_KEY, record));
    // If only sessionStorage works, removing the old grant also informs tabs.
    if (saved && sessionRead(CHOICE_KEY) === record) remove(CHOICE_KEY);
    stop(saved);
    void retryRevocations();
    if (saved) { hide(); preferences.focus(); }
    else { show(); status.textContent = "Advertising is off. Your browser could not save this preference. Keep this page open while the withdrawal request is sent, or contact waitlist@awc-ui.dev for help."; }
  };
  const apply = () => {
    window.clearTimeout(expiryTimer);
    const previousToken = choice?.token;
    if (!valid(choice)) {
      const durable = queueRevocation(previousToken);
      choice = undefined;
      if (durable) { remove(CHOICE_KEY); sessionRemove(CHOICE_KEY); }
      stop(durable);
      show();
      void retryRevocations();
      return;
    }
    hide();
    expiryTimer = window.setTimeout(() => { choice = rawChoice(); apply(); }, Math.min(choice.at + MAX_AGE - Date.now(), 2_147_483_647));
    if (choice.decision === "accepted") { captureMeta(); captureClicks(); loadGoogle(); }
    else stop();
  };
  root.querySelector("[data-advertising-accept]")!.addEventListener("click", () => {
    if (valid(choice) && choice.decision === "accepted") { hide(); return; }
    if ([...memoryRevocations].some((token) => !queueRevocation(token))) {
      status.textContent = "Advertising stays off until your pending withdrawal can be saved or sent. You can still join the waitlist.";
      void retryRevocations();
      return;
    }
    const next: Choice = { version: VERSION, decision: "accepted", at: Date.now(), token: newToken() };
    if (!write(CHOICE_KEY, JSON.stringify(next))) {
      status.textContent = "Advertising stays off because your browser cannot save your choice. You can still join the waitlist.";
      return;
    }
    clearCookies();
    sessionRemove(CHOICE_KEY);
    if (forcedOff) {
      const url = new URL(location.href);
      url.searchParams.delete("awc_advertising");
      history.replaceState(history.state, "", url);
      forcedOff = false;
    }
    choice = next;
    apply();
    preferences.focus();
  });
  root.querySelector("[data-advertising-reject]")!.addEventListener("click", reject);
  preferences.addEventListener("click", () => show(true));
  close.addEventListener("click", () => { hide(); preferences.focus(); });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { hide(); preferences.focus(); }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === CHOICE_KEY || event.key === null) {
      const previous = choice;
      choice = rawChoice();
      if (forcedOff) { reject(); return; }
      if (previous?.decision === "accepted" && previous.token !== choice?.token) queueRevocation(previous.token);
      if (googleLoaded && (choice?.decision !== "accepted" || !valid(choice))) stop();
      apply();
      void retryRevocations();
    }
    if (event.key === null || event.key?.startsWith(REVOKE_PREFIX)) void retryRevocations();
  });
  window.addEventListener("online", () => { void retryRevocations(); });
  const preservePendingRefusal = (event: MouseEvent) => {
    if (!forcedOff || memoryRevocations.size === 0) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    url.searchParams.set("awc_advertising", "off");
    anchor.href = url.href;
  };
  document.addEventListener("click", preservePendingRefusal, true);
  document.addEventListener("auxclick", preservePendingRefusal, true);
  window.addEventListener("pageshow", () => { choice = rawChoice(); if (forcedOff) reject(); else apply(); void retryRevocations(); });
  win.awcAdvertising = {
    signupMeasurement() {
      const stored = rawChoice();
      if (forcedOff || !valid(stored) || stored.decision !== "accepted" || stored.token !== choice?.token) return;
      const identifiers: Partial<Pick<Measurement, "fbp" | "fbc" | "rdt_cid" | "gclid" | "gbraid" | "wbraid">> = {};
      if (metaEnabled) {
        const fbp = identifier(cookie("_fbp"), "fbp");
        const fbc = identifier(cookie("_fbc"), "fbc");
        if (fbp) identifiers.fbp = fbp;
        if (fbc) identifiers.fbc = fbc;
      }
      if (redditEnabled) {
        const click = capturedClick("rdt_cid");
        if (click) identifiers.rdt_cid = click;
      }
      if (googleMeasurementEnabled) {
        const clicks = GOOGLE_CLICKS.filter((key) => cookie(`_awc_${key}`) !== undefined);
        if (clicks.length === 1) {
          const value = capturedClick(clicks[0]);
          if (value) identifiers[clicks[0]] = value;
        }
      }
      if (Object.keys(identifiers).length === 0) return;
      return { consent: true, version: VERSION, token: stored.token!, ...identifiers };
    },
  };
  choice = rawChoice();
  if (forcedOff) reject();
  else apply();
  void retryRevocations();
}
