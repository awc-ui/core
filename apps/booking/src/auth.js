// An intentionally local authentication demo. No identity service is connected.
// Only the final MFA-verified sample profile is retained in this tab's session.
export const DEMO_CREDENTIALS = Object.freeze({
  name: "Alex Morgan",
  email: "alex@roam.demo",
  password: "RoamDemo!2026",
  code: "246810",
});
export const AUTH_SESSION_KEY = "roam.auth.session.v1";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 30 * 1000;
export const MAX_ATTEMPTS = 5;

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
let memorySession = null;

function sessionStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export function validateLogin(data) {
  return (
    normalizeEmail(data.email) === DEMO_CREDENTIALS.email &&
    data.password === DEMO_CREDENTIALS.password
  );
}

export function validateSignup(data) {
  const name = String(data.name || "").trim();
  if (name.length < 2)
    return { field: "name", message: "Enter your full name." };
  if (name.length > 80)
    return {
      field: "name",
      message: "Use 80 characters or fewer for your name.",
    };
  if (normalizeEmail(data.email).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(data.email)))
    return { field: "email", message: "Enter a valid email address." };
  if (String(data.password || "").length < 12 || String(data.password || "").length > 128)
    return {
      field: "password",
      message: "Use 12–128 characters for your sample password.",
    };
  if (data.password !== data.confirm)
    return { field: "confirm", message: "The passwords do not match." };
  return null;
}

export function createChallenge(profile, now = Date.now()) {
  return {
    name: String(profile.name).trim(),
    email: normalizeEmail(profile.email),
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
    resendAt: now + RESEND_COOLDOWN_MS,
    attempts: 0,
  };
}

export function challengeStatus(challenge, now = Date.now()) {
  if (
    !Number.isFinite(now) ||
    !challenge ||
    !challenge.name ||
    !challenge.email ||
    !Number.isFinite(challenge.issuedAt) ||
    !Number.isFinite(challenge.expiresAt) ||
    !Number.isInteger(challenge.attempts) ||
    challenge.attempts < 0
  )
    return {
      ok: false,
      reason: "missing",
      message: "Sign in to begin verification.",
    };
  if (
    now < challenge.issuedAt ||
    now >= challenge.expiresAt ||
    challenge.expiresAt - challenge.issuedAt > CHALLENGE_TTL_MS
  )
    return {
      ok: false,
      reason: "expired",
      message: "Your code has expired. Sign in again to continue.",
    };
  if (challenge.attempts >= MAX_ATTEMPTS)
    return {
      ok: false,
      reason: "locked",
      message: "Five attempts used. Sign in again to start a new verification.",
    };
  return { ok: true };
}

export function checkCode(challenge, code, now = Date.now()) {
  const status = challengeStatus(challenge, now);
  if (!status.ok) return status;
  if (String(code || "").replace(/\s/g, "") === DEMO_CREDENTIALS.code)
    return { ok: true, nextAttempts: challenge.attempts };
  const nextAttempts = challenge.attempts + 1;
  const left = MAX_ATTEMPTS - nextAttempts;
  return {
    ok: false,
    nextAttempts,
    reason: left > 0 ? "incorrect" : "locked",
    message:
      left > 0
        ? `That code does not match. ${left} ${left === 1 ? "attempt" : "attempts"} remaining.`
        : "Five attempts used. Sign in again to start a new verification.",
  };
}

export function renewChallenge(challenge, now = Date.now()) {
  const status = challengeStatus(challenge, now);
  if (!status.ok) return status;
  if (!Number.isFinite(challenge.resendAt) || now < challenge.resendAt)
    return {
      ok: false,
      reason: "cooldown",
      message: "Wait before requesting another sample code.",
    };
  // A resend never resets the attempt budget.
  return {
    ok: true,
    challenge: {
      ...challenge,
      issuedAt: now,
      expiresAt: now + CHALLENGE_TTL_MS,
      resendAt: now + RESEND_COOLDOWN_MS,
    },
  };
}

export function createSession(profile, now = Date.now()) {
  return {
    name: String(profile.name).trim(),
    email: normalizeEmail(profile.email),
    role: "Traveler",
    demo: true,
    mfaVerified: true,
    verifiedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
}

export function readSession(storage = sessionStorage(), now = Date.now()) {
  let stored = memorySession;
  try {
    stored =
      JSON.parse(storage?.getItem(AUTH_SESSION_KEY) || "null") || memorySession;
  } catch {
    /* Unavailable storage keeps the in-memory session usable. */
  }
  if (
    !Number.isFinite(now) ||
    !stored ||
    stored.demo !== true ||
    stored.mfaVerified !== true ||
    typeof stored.name !== "string" ||
    !stored.name.trim() ||
    stored.name.length > 80 ||
    typeof stored.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stored.email) ||
    !Number.isFinite(stored.verifiedAt) ||
    !Number.isFinite(stored.expiresAt) ||
    now < stored.verifiedAt ||
    now >= stored.expiresAt ||
    stored.expiresAt - stored.verifiedAt > SESSION_TTL_MS
  )
    return null;
  // Whitelist stored fields; a tampered record cannot introduce markup or state.
  return {
    ...createSession(stored, stored.verifiedAt),
    expiresAt: stored.expiresAt,
  };
}

function writeSession(profile) {
  memorySession = profile;
  try {
    sessionStorage()?.setItem(AUTH_SESSION_KEY, JSON.stringify(profile));
  } catch {
    /* Private browsing can refuse storage. */
  }
}

export function clearSession() {
  memorySession = null;
  try {
    sessionStorage()?.removeItem(AUTH_SESSION_KEY);
  } catch {
    /* Nothing persisted. */
  }
}

function field(name, label, type = "text", extra = "") {
  return `<md-text-field name="${name}" label="${label}" type="${type}" variant="outlined" required reserve-supporting-space ${type === "password" ? 'password-toggle="internal" dir="ltr"' : ""} ${type === "email" ? 'dir="ltr" inputmode="email" autocapitalize="none" spellcheck="false"' : ""} ${extra}></md-text-field>`;
}

async function ready(root) {
  await Promise.all([...root.querySelectorAll("*")]
    .filter((element) => element.localName.startsWith("md-"))
    .map(async (element) => {
      await customElements.whenDefined(element.localName);
      await element.componentOnReady?.();
    }));
}

/** Local demo identity only. A real reservation service must verify identity server-side. */
export function initIdentity({ onChange = () => {}, notify = () => {} } = {}) {
  let host = document.getElementById("identity-overlays");
  if (!host) {
    host = document.createElement("div");
    host.id = "identity-overlays";
    document.body.append(host);
  }
  host.innerHTML = `<md-dialog id="roam-identity" class="roam-identity" headline="Welcome to Roam" icon="travel_explore"><div class="roam-identity-body"></div><md-button slot="actions" variant="text" data-identity-action="close">Close</md-button></md-dialog>`;
  const dialog = host.querySelector("md-dialog");
  const body = host.querySelector(".roam-identity-body");
  let mode = "login";
  let challenge = null;
  let timer;
  let generation = 0;
  let busy = false;
  let disposed = false;

  const stopTimer = () => { clearInterval(timer); timer = undefined; };
  const resetPending = () => {
    generation += 1;
    stopTimer();
    challenge = null;
    busy = false;
    body.querySelector("form")?.reset();
  };
  dialog.addEventListener("mdClose", (event) => {
    if (event.target === dialog) resetPending();
  });

  function showError(message, name) {
    const control = name && body.querySelector(`[name="${name}"]`);
    const alert = body.querySelector(".roam-auth-error");
    if (control) {
      control.error = true;
      control.errorText = message;
      if (alert) alert.textContent = "";
      void control.setFocus?.();
    } else if (alert) alert.textContent = message;
  }

  function updateChallenge() {
    if (mode !== "mfa" || !challenge) return;
    const status = challengeStatus(challenge);
    const resend = body.querySelector('[data-identity-action="resend"]');
    const remaining = Math.max(0, Math.ceil((challenge.resendAt - Date.now()) / 1000));
    if (resend) {
      resend.softDisabled = busy || !status.ok || remaining > 0;
      resend.textContent = remaining > 0 ? `Resend in ${remaining}s` : "Resend demo code";
    }
    const submit = body.querySelector('[type="submit"]');
    if (submit) submit.softDisabled = !status.ok;
    if (!status.ok) {
      stopTimer();
      showError(status.message);
      const otp = body.querySelector("md-otp-field");
      if (otp) otp.readOnly = true;
    }
  }

  function markup() {
    const disclosure = '<p class="roam-auth-disclosure">Demo authentication. No email is sent; passwords are never saved.</p>';
    if (mode === "mfa") return `<p class="roam-auth-intro">A little peace of mind before your next adventure. Verify the demo profile for <strong>${escape(challenge.name)}</strong>.</p>
      <div class="roam-auth-code-note"><span>Demo verification code</span><strong dir="ltr">${DEMO_CREDENTIALS.code}</strong></div>
      <form class="roam-auth-form roam-auth-verification">
        <md-otp-field name="code" label="Six-digit verification code" length="6" group-size="3" validation-type="numeric" inputmode="numeric" required incomplete-label="Enter all six digits." value-missing-label="Enter your verification code." reserve-supporting-space supporting-text="Verification expires five minutes after sign-in." cell-label-template="Digit {index} of {length}"></md-otp-field>
        <p class="roam-auth-error" role="alert"></p>
        <md-button variant="filled" size="md" full-width type="submit">Verify and continue</md-button>
      </form>
      <div class="roam-auth-links"><md-button variant="text" data-identity-action="login" icon="arrow_back" mirror-icon>Back to sign in</md-button><md-button variant="text" data-identity-action="resend" soft-disabled>Resend in 30s</md-button></div>${disclosure}`;
    const signup = mode === "signup";
    return `<p class="roam-auth-intro">${signup ? "A place for your saved stays and your next great escape. Create a profile with fictional details." : "Sign in to keep your favorite places and upcoming trips together."}</p>
      <form class="roam-auth-form">
        ${signup ? field("name", "Full name", "text", 'autocomplete="name" max-length="80"') : ""}
        ${field("email", "Email address", "email", 'autocomplete="username"')}
        ${field("password", "Password", "password", signup ? 'autocomplete="new-password" min-length="12" supporting-text="12–128 characters. Use a sample password."' : 'autocomplete="current-password"')}
        ${signup ? field("confirm", "Confirm password", "password", 'autocomplete="new-password"') : ""}
        <p class="roam-auth-error" role="alert"></p>
        <md-button variant="filled" full-width size="md" type="submit">${signup ? "Create demo account" : "Sign in"}</md-button>
      </form>
      <div class="roam-auth-links"><span>${signup ? "Already have an account?" : "New to Roam?"}</span><md-button variant="text" data-identity-action="${signup ? "login" : "signup"}">${signup ? "Sign in" : "Create an account"}</md-button></div>
      ${signup ? "" : '<md-button variant="tonal" full-width icon="explore" data-identity-action="demo">Use demo account</md-button><div class="roam-demo-credentials" hidden></div>'}${disclosure}`;
  }

  async function render(nextMode) {
    stopTimer();
    mode = nextMode === "signup" ? "signup" : nextMode === "mfa" && challenge ? "mfa" : "login";
    if (mode !== "mfa") challenge = null;
    const thisGeneration = ++generation;
    dialog.headline = mode === "mfa" ? "Verify your account" : mode === "signup" ? "Your next chapter starts here" : "Welcome to Roam";
    dialog.icon = mode === "mfa" ? "verified_user" : "travel_explore";
    body.innerHTML = markup();
    if (mode === "mfa") {
      updateChallenge();
      timer = setInterval(updateChallenge, 1000);
    }
    await ready(host);
    if (disposed || thisGeneration !== generation) return false;
    if (dialog.open) void body.querySelector("md-text-field, md-otp-field")?.setFocus();
    return true;
  }

  async function runAction(button, label, work) {
    if (busy || disposed) return;
    busy = true;
    const thisGeneration = generation;
    const text = button.textContent;
    button.loading = true;
    button.textContent = label;
    body.setAttribute("aria-busy", "true");
    try {
      // Give the native progress state a paint before the local verification work.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (disposed || thisGeneration !== generation || !dialog.open) return;
      await work();
    } catch {
      if (!disposed && dialog.open) showError("This step could not finish. Please try again.");
    } finally {
      busy = false;
      if (button.isConnected) { button.loading = false; button.textContent = text; }
      body.removeAttribute("aria-busy");
      updateChallenge();
    }
  }

  body.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || disposed) return;
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('[type="submit"]');
    if (mode !== "mfa") {
      if (mode === "login" && !validateLogin(data)) {
        showError("Use the demo account below, or create a sample account.", "password");
        return;
      }
      const issue = mode === "signup" && validateSignup(data);
      if (issue) return showError(issue.message, issue.field);
      // Only whitelisted profile fields survive the credentials step.
      const profile = mode === "signup"
        ? { name: String(data.name).trim(), email: normalizeEmail(data.email) }
        : { name: DEMO_CREDENTIALS.name, email: DEMO_CREDENTIALS.email };
      data.password = data.confirm = "";
      await runAction(submit, "Preparing verification…", async () => {
        form.reset();
        challenge = createChallenge(profile);
        await render("mfa");
      });
      return;
    }
    const result = checkCode(challenge, data.code);
    if (challenge && result.nextAttempts !== undefined) challenge.attempts = result.nextAttempts;
    if (!result.ok) {
      showError(result.message, result.reason === "incorrect" ? "code" : undefined);
      updateChallenge();
      return;
    }
    await runAction(submit, "Verifying…", async () => {
      const status = challengeStatus(challenge);
      if (!status.ok) return showError(status.message);
      const profile = createSession(challenge);
      writeSession(profile);
      form.reset();
      await dialog.close();
      onChange(profile);
      notify(`Welcome, ${profile.name.split(" ")[0]}. Your demo account is ready.`);
    });
  });

  for (const name of ["mdInput", "mdChange"]) body.addEventListener(name, (event) => {
    const control = event.target;
    if (!["md-text-field", "md-otp-field"].includes(control.localName)) return;
    control.error = false;
    control.errorText = "";
    void control.setCustomValidity?.("");
    const alert = body.querySelector(".roam-auth-error");
    if (alert) alert.textContent = "";
  });
  body.addEventListener("invalid", (event) => {
    event.preventDefault();
    const control = event.target;
    if (!control.name) return;
    const message = control.name === "email" ? "Enter a valid email address."
      : control.name === "code" ? "Enter all six digits."
        : control.name === "password" && mode === "signup" ? "Use 12–128 characters for your sample password."
          : `Enter ${String(control.label || "this field").toLowerCase()}.`;
    showError(message, control.name);
  }, true);

  host.addEventListener("mdClick", async (event) => {
    const button = event.target.closest?.("[data-identity-action]");
    if (!button || disposed) return;
    const action = button.dataset.identityAction;
    if (action === "close") { await dialog.close(); return; }
    if (busy) return;
    if (action === "login" || action === "signup") await render(action);
    else if (action === "demo") {
      for (const name of ["email", "password"]) {
        const control = body.querySelector(`[name="${name}"]`);
        control.value = DEMO_CREDENTIALS[name];
        control.error = false;
        control.errorText = "";
        void control.setCustomValidity?.("");
      }
      const details = body.querySelector(".roam-demo-credentials");
      details.hidden = false;
      details.innerHTML = `<p><strong>Demo email</strong> <span dir="ltr">${DEMO_CREDENTIALS.email}</span></p><p><strong>Demo password</strong> <span dir="ltr">${DEMO_CREDENTIALS.password}</span></p><p>MFA code: <strong dir="ltr">${DEMO_CREDENTIALS.code}</strong></p>`;
      body.querySelector(".roam-auth-error").textContent = "";
      notify("Demo details filled. Select Sign in to try verification.");
    } else if (action === "resend") {
      const result = renewChallenge(challenge);
      if (!result.ok) return showError(result.message);
      await runAction(button, "Preparing code…", async () => {
        const fresh = renewChallenge(challenge);
        if (!fresh.ok) return showError(fresh.message);
        challenge = fresh.challenge;
        const otp = body.querySelector("md-otp-field");
        await otp.clear();
        otp.error = false;
        otp.errorText = "";
        showError("");
        notify("Demo code renewed: 246810. No email was sent.");
        await otp.setFocus();
      });
    }
  });

  return {
    get profile() { return readSession(); },
    async open(nextMode = "login") {
      disposed = false;
      resetPending();
      if (await render(nextMode)) await dialog.show();
    },
    async signOut() {
      resetPending();
      clearSession();
      await dialog.close();
      onChange(null);
      notify("Signed out. You can keep exploring.");
    },
    dispose() { disposed = true; resetPending(); void dialog.close(); },
  };
}
