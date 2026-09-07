// An intentionally local authentication demo. No identity service is connected.
// Only the final MFA-verified sample profile is retained in this tab's session.
export const DEMO_CREDENTIALS = Object.freeze({
  name: "Alex Morgan",
  email: "alex.morgan@vela.demo",
  password: "VelaDemo!2026",
  code: "246810",
});
export const AUTH_SESSION_KEY = "vela.auth.session.v1";
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
const icon = (name) =>
  `<span class="icon" aria-hidden="true">${escape(name)}</span>`;
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(data.email)))
    return { field: "email", message: "Enter a valid work email address." };
  if (String(data.password || "").length < 12)
    return {
      field: "password",
      message: "Use at least 12 characters for your sample password.",
    };
  if (data.password !== data.confirm)
    return { field: "confirm", message: "The passwords do not match." };
  if (data.consent !== "yes" && data.consent !== true)
    return {
      field: "consent",
      message: "Confirm that you will use fictional details.",
    };
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
    role: "Research scientist",
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

function storyMarkup() {
  return `<section class="auth-story" aria-label="About Vela">
    <div class="auth-brand"><span class="auth-mark">${icon("science")}</span><span><strong>vela</strong><span class="auth-brand-caption">Research, in focus.</span></span></div>
    <div class="auth-story-content">
      <p class="auth-eyebrow">The pharmaceutical testing workspace</p>
      <h2>Good science.<br>Clear evidence.<br><em>Shared progress.</em></h2>
      <p class="auth-story-intro">A considered space for your studies, samples, and the people behind every result.</p>
      <md-card class="auth-workflow" variant="outlined">
        <div><span class="auth-workflow-icon">${icon("biotech")}</span><div><strong>From sample to insight</strong><p>Track each test, review the evidence, and keep your research moving.</p></div></div>
        <ol><li>Register a sample</li><li>Run and track tests</li><li>Review the results</li></ol>
      </md-card>
    </div>
    <div class="auth-story-footer"><span>Vela / Research operations</span><span>Built with AWC UI</span></div>
  </section>`;
}

function field(name, label, type = "text", extra = "") {
  return `<md-text-field name="${escape(name)}" label="${escape(label)}" type="${escape(type)}" variant="outlined" required reserve-supporting-space ${type === "password" ? 'password-toggle="internal" dir="ltr"' : ""} ${type === "email" ? 'dir="ltr" inputmode="email" autocapitalize="none" spellcheck="false"' : ""} ${extra}></md-text-field>`;
}

function formMarkup(mode, challenge) {
  if (mode === "mfa")
    return `<form id="auth-form" class="auth-fields auth-verification">
    <md-card variant="filled" class="auth-code-card"><span>Sample verification code</span><strong class="auth-code" dir="ltr">${DEMO_CREDENTIALS.code}</strong><p>No message was sent. Use this code to try MFA.</p></md-card>
    <md-otp-field name="code" label="Six-digit verification code" length="6" group-size="3" validation-type="numeric" inputmode="numeric" required incomplete-label="Enter all six digits." value-missing-label="Enter your verification code." reserve-supporting-space supporting-text="Your code expires five minutes after sign-in." cell-label-template="Digit {index} of {length}"></md-otp-field>
    <p id="auth-error" class="auth-error" role="alert"></p>
    <md-button variant="filled" full-width size="md" type="submit">Verify and continue</md-button>
    <div class="auth-mfa-controls"><span id="auth-mfa-note">Verifying ${escape(challenge.email)}</span><md-button variant="text" data-auth-action="resend" soft-disabled>Resend in 30s</md-button></div>
  </form>`;
  const signup = mode === "signup";
  return `<form id="auth-form" class="auth-fields">
    ${signup ? field("name", "Full name", "text", 'autocomplete="name" max-length="80"') : ""}
    ${field("email", "Work email", "email", 'autocomplete="username"')}
    ${field("password", "Password", "password", signup ? 'autocomplete="new-password" min-length="12" supporting-text="At least 12 characters. Use a sample password."' : 'autocomplete="current-password"')}
    ${signup ? field("confirm", "Confirm password", "password", 'autocomplete="new-password"') + '<label class="auth-consent"><md-checkbox name="consent" value="yes" required value-missing-label="Confirm that you will use fictional details." aria-label="I will use fictional details in this demo"></md-checkbox><span>I will use fictional details in this demo.</span></label>' : ""}
    <p id="auth-error" class="auth-error" role="alert"></p>
    <md-button variant="filled" full-width size="md" type="submit">${signup ? "Create demo account" : "Sign in"}</md-button>
  </form>`;
}

function pageMarkup(mode, challenge, notice = "", canExplore = false) {
  const signup = mode === "signup";
  const mfa = mode === "mfa";
  return `<div class="auth-page">${storyMarkup()}<main id="main" class="auth-form-area" tabindex="-1">
    <div class="auth-topline">${mode === "login" ? "<span>Vela research workspace</span>" : '<md-button variant="text" icon="arrow_back" mirror-icon data-auth-action="login">Back to sign in</md-button>'}<span>Interactive demo</span></div>
    <div class="auth-form-content${signup ? " auth-signup" : ""}">
      <span class="auth-form-symbol">${icon(mfa ? "phonelink_lock" : signup ? "person_add" : "fingerprint")}</span>
      <p class="auth-eyebrow">${mfa ? "Step 2 of 2 · Verification" : signup ? "Your next discovery starts here" : "Welcome to your workspace"}</p>
      <h1>${mfa ? "One more step." : signup ? "Make room for discovery." : "Welcome back."}</h1>
      <p class="auth-intro">${mfa ? `Verify the demo profile for ${escape(challenge.name)} to open your workspace.` : signup ? "Create a sample profile for your pharmaceutical testing workspace." : "Sign in to bring your research into focus."}</p>
      ${notice ? `<p class="auth-error" role="alert">${escape(notice)}</p>` : ""}
      ${formMarkup(mode, challenge)}
      ${mfa ? "" : `<div class="auth-links"><span>${signup ? "Already have an account?" : "New to Vela?"}</span><md-button variant="text" data-auth-action="${signup ? "login" : "signup"}">${signup ? "Sign in" : "Create an account"}</md-button></div>`}
      ${mode === "login" ? `<md-card class="auth-demo-card" variant="filled"><strong>Take a look around</strong><p>A sample account, ready for your next discovery.</p><dl class="auth-credentials"><div><dt>Email</dt><dd dir="ltr">${DEMO_CREDENTIALS.email}</dd></div><div><dt>Password</dt><dd dir="ltr">${DEMO_CREDENTIALS.password}</dd></div></dl><md-button variant="outlined" full-width icon="science" data-auth-action="fill">Use demo credentials</md-button></md-card>` : ""}
      ${canExplore ? '<md-button variant="text" data-auth-action="explore">Explore the sample workspace</md-button>' : ""}
      <p class="auth-disclosure">${icon("info")}<span>Fictional data · simulated authentication. No identity service is connected. Passwords are discarded.</span></p>
    </div>
    <footer class="auth-form-footer"><span>Built for the work of discovery.</span><span>AWC UI component showcase</span></footer>
  </main></div>`;
}

async function ready(root) {
  const elements = [...root.querySelectorAll("*")].filter((element) =>
    element.localName.startsWith("md-"),
  );
  await Promise.all(
    elements.map(async (element) => {
      await globalThis.customElements.whenDefined(element.localName);
      await element.componentOnReady?.();
    }),
  );
}

/** Mounts the complete login → sign up → MFA flow into an existing app root. */
export function createAuth({ root, onAuthenticated, onExplore } = {}) {
  if (!root || typeof onAuthenticated !== "function")
    throw new TypeError(
      "createAuth needs a root element and an onAuthenticated callback.",
    );
  let challenge = null;
  let generation = 0;
  let timer;
  let currentMode = "login";
  let busy = false;
  let disposed = false;

  const clearTimer = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const showError = (message, name) => {
    const control = name && root.querySelector(`[name="${name}"]`);
    const alert = root.querySelector("#auth-error");
    if (control && control.localName !== "md-checkbox") {
      control.error = true;
      control.errorText = message;
      if (alert) alert.textContent = "";
      void control.setFocus?.();
    } else {
      if (alert) alert.textContent = message;
      control?.focus();
    }
  };

  function updateChallenge() {
    if (currentMode !== "mfa" || !challenge) return;
    const status = challengeStatus(challenge);
    const resend = root.querySelector('[data-auth-action="resend"]');
    const remaining = Math.max(
      0,
      Math.ceil((challenge.resendAt - Date.now()) / 1000),
    );
    if (resend) {
      resend.softDisabled = busy || !status.ok || remaining > 0;
      resend.textContent =
        remaining > 0 ? `Resend in ${remaining}s` : "Resend sample code";
    }
    if (!status.ok) {
      clearTimer();
      showError(status.message);
      const field = root.querySelector("md-otp-field");
      const submit = root.querySelector('md-button[type="submit"]');
      if (field) field.readOnly = true;
      if (submit) submit.softDisabled = true;
    }
  }

  async function runAction(button, label, work) {
    if (busy || disposed) return;
    busy = true;
    const form = root.querySelector("#auth-form");
    const controls = [...root.querySelectorAll("md-button")];
    const oldText = button.textContent;
    const priorStates = controls.map((control) => [
      control,
      control.softDisabled,
    ]);
    button.loading = true;
    button.textContent = label;
    form?.setAttribute("aria-busy", "true");
    for (const control of controls)
      if (control !== button) control.softDisabled = true;
    try {
      await work();
    } catch {
      if (!disposed && form?.isConnected)
        showError("This step could not finish. Please try again.");
    } finally {
      busy = false;
      if (button.isConnected) {
        button.loading = false;
        button.textContent = oldText;
      }
      for (const [control, value] of priorStates)
        if (control.isConnected) control.softDisabled = value;
      if (form?.isConnected) form.removeAttribute("aria-busy");
      updateChallenge();
    }
  }

  async function render(mode = "login", notice = "") {
    disposed = false;
    clearTimer();
    const thisGeneration = ++generation;
    if (!["login", "signup", "mfa"].includes(mode)) mode = "login";
    if (mode === "mfa") {
      const status = challengeStatus(challenge);
      if (!status.ok) {
        mode = "login";
        notice = status.message;
        challenge = null;
      }
    } else challenge = null;
    currentMode = mode;
    root.innerHTML = pageMarkup(
      mode,
      challenge,
      notice,
      typeof onExplore === "function",
    );
    bind(mode);
    if (mode === "mfa") {
      updateChallenge();
      timer = setInterval(updateChallenge, 1000);
    }
    await ready(root);
    if (disposed || generation !== thisGeneration) return;
    root.querySelector("#main")?.focus({ preventScroll: true });
  }

  function bind(mode) {
    const form = root.querySelector("#auth-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || disposed) return;
      const data = Object.fromEntries(new FormData(form));
      const button = form.querySelector('md-button[type="submit"]');
      if (mode === "login" || mode === "signup") {
        if (mode === "login" && !validateLogin(data))
          return showError(
            "Use the sample credentials below, or create a demo account.",
            "password",
          );
        const issue = mode === "signup" && validateSignup(data);
        if (issue) return showError(issue.message, issue.field);
        const profile =
          mode === "signup"
            ? { name: data.name, email: data.email }
            : DEMO_CREDENTIALS;
        await runAction(button, "Opening verification…", async () => {
          clearSession();
          challenge = createChallenge(profile);
          form.reset();
          await render("mfa");
        });
        return;
      }
      const result = checkCode(challenge, data.code);
      if (challenge && result.nextAttempts !== undefined)
        challenge.attempts = result.nextAttempts;
      if (!result.ok) {
        showError(
          result.message,
          result.reason === "incorrect" ? "code" : undefined,
        );
        updateChallenge();
        return;
      }
      await runAction(button, "Opening workspace…", async () => {
        const profile = createSession(challenge);
        const thisGeneration = generation;
        writeSession(profile);
        try {
          await onAuthenticated(profile);
          if (disposed || thisGeneration !== generation) return;
          challenge = null;
          clearTimer();
          form.reset();
        } catch (error) {
          clearSession();
          throw error;
        }
      });
    });
    form
      .querySelectorAll("md-text-field, md-otp-field, md-checkbox")
      .forEach((control) => {
        const clearError = () => {
          control.error = false;
          control.errorText = "";
          void control.setCustomValidity?.("");
          const alert = form.querySelector("#auth-error");
          if (alert) alert.textContent = "";
        };
        control.addEventListener("mdInput", clearError);
        control.addEventListener("mdChange", clearError);
        control.addEventListener("invalid", (event) => {
          event.preventDefault();
          const message =
            control.name === "consent"
              ? "Confirm that you will use fictional details."
              : control.name === "email"
                ? "Enter a valid work email address."
                : control.name === "code"
                  ? "Enter all six digits."
                  : control.name === "password" && mode === "signup"
                    ? "Use at least 12 characters for your sample password."
                    : `Enter ${control.label.toLowerCase()}.`;
          showError(message, control.name);
        });
      });
    root.querySelectorAll("[data-auth-action]").forEach((button) => {
      button.addEventListener("mdClick", async () => {
        if (busy || disposed) return;
        const action = button.dataset.authAction;
        if (action === "login" || action === "signup") await render(action);
        else if (action === "fill") {
          for (const name of ["email", "password"]) {
            const control = form.querySelector(`[name="${name}"]`);
            control.value = DEMO_CREDENTIALS[name];
            control.error = false;
            control.errorText = "";
            await control.setCustomValidity?.("");
          }
          form.querySelector("#auth-error").textContent = "";
          form.querySelector('md-button[type="submit"]')?.focus();
        } else if (action === "resend") {
          const result = renewChallenge(challenge);
          if (!result.ok) {
            showError(result.message);
            return;
          }
          await runAction(button, "Preparing code…", async () => {
            challenge = result.challenge;
            const otp = form.querySelector("md-otp-field");
            await otp.clear();
            otp.error = false;
            otp.errorText = "";
            form.querySelector("#auth-error").textContent = "";
            root.querySelector("#auth-mfa-note").textContent =
              "Sample code renewed. No message was sent.";
            await otp.setFocus();
          });
        } else if (action === "explore")
          await runAction(button, "Opening workspace…", onExplore);
      });
    });
  }

  return {
    render,
    signOut() {
      clearSession();
      challenge = null;
      busy = false;
      return render("login");
    },
    dispose() {
      disposed = true;
      generation += 1;
      challenge = null;
      clearTimer();
    },
  };
}
