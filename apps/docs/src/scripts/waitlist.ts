interface TurnstileOptions {
  sitekey: string;
  action: string;
  size: "compact";
  language: "en";
  "response-field": false;
  retry: "never";
  "refresh-expired": "manual";
  "refresh-timeout": "manual";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
}

interface Turnstile {
  render(container: HTMLElement, options: TurnstileOptions): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

const TIMEOUT_MS = 15_000;
const mounted = new Map<HTMLFormElement, () => void>();
let turnstilePromise: Promise<Turnstile> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  if (turnstilePromise) return turnstilePromise;
  turnstilePromise = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    const getApi = () =>
      (window as Window & { turnstile?: Turnstile }).turnstile;
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Security check unavailable"));
    };
    const timer = window.setTimeout(fail, TIMEOUT_MS);
    const loaded = () => {
      const api = getApi();
      if (!api) return fail();
      // The load event already means the API is available. Turnstile rejects
      // ready() when its script was loaded with async/defer.
      window.clearTimeout(timer);
      resolve(api);
    };
    if (getApi()) {
      loaded();
      return;
    }
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.referrerPolicy = "no-referrer";
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  }).catch((error: unknown) => {
    turnstilePromise = undefined;
    throw error;
  });
  return turnstilePromise;
}

function mountWaitlist(form: HTMLFormElement): () => void {
  const section = form.closest<HTMLElement>(".awc-waitlist")!;
  const email = form.querySelector<HTMLInputElement>('input[name="email"]')!;
  const website = form.querySelector<HTMLInputElement>(
    'input[name="website"]',
  )!;
  const submit = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;
  const retry = form.querySelector<HTMLButtonElement>("[data-waitlist-retry]")!;
  const challenge = form.querySelector<HTMLElement>(
    "[data-waitlist-challenge]",
  )!;
  const status = section.querySelector<HTMLElement>("[data-waitlist-status]")!;
  let api: Turnstile | undefined;
  let widgetId: string | undefined;
  let token = "";
  let pending = false;
  let loadingChallenge = false;
  let complete = false;
  let disposed = false;
  let request: AbortController | undefined;

  const announce = (message: string, state = "info") => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const updateControls = () => {
    submit.disabled = pending || !token || complete;
    submit.textContent = pending ? "Joining…" : "Join the waitlist";
    retry.disabled = pending;
    email.readOnly = pending;
    website.readOnly = pending;
    form.setAttribute("aria-busy", String(pending));
  };
  const verificationFailed = (message: string) => {
    if (disposed || pending || complete) return;
    token = "";
    retry.hidden = false;
    announce(message, "error");
    updateControls();
  };
  const removeWidget = () => {
    if (widgetId !== undefined) {
      try {
        api?.remove(widgetId);
      } catch {
        /* The external widget may already be gone. */
      }
      widgetId = undefined;
    }
  };
  const startChallenge = async () => {
    if (disposed || pending || complete || loadingChallenge) return;
    loadingChallenge = true;
    token = "";
    retry.hidden = true;
    announce("Loading security check…");
    updateControls();
    try {
      api = await loadTurnstile();
      if (disposed || complete) return;
      if (widgetId !== undefined) {
        api.reset(widgetId);
      } else {
        widgetId = api.render(challenge, {
          sitekey: form.dataset.sitekey!,
          action: "waitlist_join",
          size: "compact",
          language: "en",
          "response-field": false,
          retry: "never",
          "refresh-expired": "manual",
          "refresh-timeout": "manual",
          callback: (value) => {
            if (disposed || pending || complete) return;
            token = value;
            retry.hidden = true;
            if (status.dataset.state !== "error") {
              announce("Security check complete. You can join the waitlist.");
            }
            updateControls();
          },
          "error-callback": () =>
            verificationFailed(
              "The security check could not load. Please retry it.",
            ),
          "expired-callback": () =>
            verificationFailed(
              "The security check expired. Please retry it before joining.",
            ),
          "timeout-callback": () =>
            verificationFailed(
              "The security check timed out. Please retry it.",
            ),
        });
        if (widgetId === undefined)
          throw new Error("Security check unavailable");
      }
    } catch {
      removeWidget();
      verificationFailed(
        "The security check is unavailable. Check your connection and retry it.",
      );
    } finally {
      loadingChallenge = false;
    }
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (disposed || pending || complete || !form.reportValidity()) return;
    if (!token) {
      verificationFailed("Please complete the security check before joining.");
      return;
    }
    const submittedToken = token;
    token = "";
    pending = true;
    retry.hidden = true;
    announce("Joining the waitlist…");
    updateControls();
    request = new AbortController();
    const timer = window.setTimeout(() => request?.abort(), TIMEOUT_MS);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.value.trim(),
          token: submittedToken,
          website: website.value,
        }),
        signal: request.signal,
        credentials: "omit",
        mode: "same-origin",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (disposed) return;
      if (!response.ok) {
        announce(
          response.status === 429
            ? "Too many attempts. Please try again later."
            : response.status === 400 || response.status === 403
              ? "Please check your email address, complete a new security check, and try again."
              : "We could not save your signup. Please try again in a moment.",
          "error",
        );
        return;
      }
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("ok" in result) ||
        result.ok !== true
      ) {
        throw new Error("Unexpected response");
      }
      if (disposed) return;
      complete = true;
      form.reset();
      form.hidden = true;
      announce(
        "Thank you! Your waitlist request has been received. If this address is already on the list, you’re all set.",
        "success",
      );
      status.focus({ preventScroll: true });
    } catch {
      if (!disposed) {
        announce(
          request.signal.aborted
            ? "The request timed out. Please complete a new security check and try again."
            : "We could not confirm your signup. Check your connection and try again.",
          "error",
        );
      }
    } finally {
      window.clearTimeout(timer);
      request = undefined;
      pending = false;
      token = "";
      if (!disposed) {
        // A token is single-use, including when the request outcome is unknown.
        try {
          if (widgetId !== undefined) api?.reset(widgetId);
        } catch {
          removeWidget();
          retry.hidden = false;
        }
        if (complete) removeWidget();
        updateControls();
      }
    }
  };

  const handleRetry = () => {
    void startChallenge();
  };
  form.addEventListener("submit", handleSubmit);
  retry.addEventListener("click", handleRetry);
  form.hidden = false;
  section.querySelector<HTMLElement>("[data-waitlist-fallback]")!.hidden = true;
  void startChallenge();

  return () => {
    disposed = true;
    request?.abort();
    form.removeEventListener("submit", handleSubmit);
    retry.removeEventListener("click", handleRetry);
    removeWidget();
  };
}

export function initializeWaitlists(): void {
  document
    .querySelectorAll<HTMLFormElement>("[data-waitlist-form]")
    .forEach((form) => {
      if (mounted.has(form) || !form.dataset.sitekey?.trim()) return;
      mounted.set(form, mountWaitlist(form));
    });
}

export function disposeWaitlists(): void {
  mounted.forEach((dispose) => dispose());
  mounted.clear();
}
