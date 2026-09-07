import { escapeHtml as esc } from "./model.js";
import { t, getLanguage, number, normalizeDigits } from "./i18n.js";
import { runAction } from "./feedback.js";

// This is a deliberately local interaction demo, not an identity service.
// Credentials are public sample values; entered passwords never enter app state.
export const DEMO_EMAIL = "sarah.chen@medflow.demo";
export const DEMO_PASSWORD = "MedflowDemo!2026";
export const DEMO_CODE = "246810";
export const RECOVERY_CODE = "MEDF2026";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_CHALLENGE_ATTEMPTS = 5;

const icon = (name) =>
  `<span class="icon" aria-hidden="true">${esc(name)}</span>`;
const authState = (state) =>
  (state.auth ||= { pending: null, profile: null, recoveryUsed: false });
const txt = (source, params) => esc(t(source, params));
const field = (name, label, type = "text", extra = "") =>
  `<md-text-field variant="outlined" name="${esc(name)}" label="${txt(label)}" type="${esc(type)}" ${type === "email" || type === "password" ? 'dir="ltr"' : ""} required reserve-supporting-space ${extra}>${type === "password" ? `<md-icon-button slot="trailing-icon" variant="standard" icon="visibility" data-auth-password="${esc(name)}" aria-label="${txt(name === "confirm" ? "Show confirm password" : "Show password")}"></md-icon-button>` : ""}</md-text-field>`;

// Validation functions retain their English contracts; localization happens only
// at the presentation boundary, including English messages with dynamic counts.
function authMessage(message) {
  const attempts =
    /^That code does not match\. ([1-4]) attempts? remaining\.$/.exec(message);
  if (attempts && getLanguage() === "ar") {
    const left = Number(attempts[1]);
    if (left === 1) return t("That code does not match. One attempt remains.");
    if (left === 2) return t("That code does not match. Two attempts remain.");
    return t("That code does not match. {count} attempts remaining.", {
      count: number(left),
    });
  }
  return t(message);
}

export function validateSignup(data) {
  if (!String(data.name || "").trim())
    return { field: "name", message: "Enter your full name." };
  if (String(data.name).trim().length > 80)
    return {
      field: "name",
      message: "Use 80 characters or fewer for your name.",
    };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email || "").trim()))
    return { field: "email", message: "Enter a valid work email address." };
  if (String(data.password || "").length < 12)
    return {
      field: "password",
      message: "Use a password with at least 12 characters.",
    };
  if (data.password !== data.confirm)
    return { field: "confirm", message: "The passwords do not match." };
  if (data.consent !== "yes" && data.consent !== true)
    return {
      field: "consent",
      message: "Confirm that you will use fictional details in this demo.",
    };
  return null;
}

export function validateLogin(data) {
  return (
    String(data.email || "")
      .trim()
      .toLowerCase() === DEMO_EMAIL && data.password === DEMO_PASSWORD
  );
}

export function createChallenge(profile, now = Date.now()) {
  return {
    name: profile.name.trim(),
    email: profile.email.trim().toLowerCase(),
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
    attempts: 0,
  };
}

export function challengeStatus(pending, now = Date.now()) {
  if (
    !pending ||
    !pending.name ||
    !pending.email ||
    !Number.isFinite(pending.issuedAt) ||
    !Number.isFinite(pending.expiresAt) ||
    !Number.isInteger(pending.attempts) ||
    pending.attempts < 0
  ) {
    return {
      ok: false,
      reason: "missing",
      message: "Sign in first to start verification.",
    };
  }
  if (
    now < pending.issuedAt ||
    now >= pending.expiresAt ||
    pending.expiresAt - pending.issuedAt > CHALLENGE_TTL_MS
  )
    return {
      ok: false,
      reason: "expired",
      message: "This verification has expired. Sign in again to continue.",
    };
  if (pending.attempts >= MAX_CHALLENGE_ATTEMPTS)
    return {
      ok: false,
      reason: "locked",
      message: "Five attempts used. Sign in again to start a new verification.",
    };
  return { ok: true };
}

// Pure transition result: the caller commits nextAttempts and consumes recovery.
export function checkChallenge(pending, code, options = {}) {
  const { now = Date.now(), recovery = false, recoveryUsed = false } = options;
  const status = challengeStatus(pending, now);
  if (!status.ok) return status;
  if (recovery && recoveryUsed)
    return {
      ok: false,
      reason: "used",
      nextAttempts: pending.attempts,
      message:
        "This recovery code has already been used. Use the six-digit verification code.",
    };
  const value = String(code || "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (value === (recovery ? RECOVERY_CODE : DEMO_CODE))
    return { ok: true, recovery, nextAttempts: pending.attempts };
  const nextAttempts = pending.attempts + 1;
  const left = MAX_CHALLENGE_ATTEMPTS - nextAttempts;
  return {
    ok: false,
    nextAttempts,
    reason: left ? "incorrect" : "locked",
    message: left
      ? `That code does not match. ${left} ${left === 1 ? "attempt" : "attempts"} remaining.`
      : "Five attempts used. Sign in again to start a new verification.",
  };
}

export function clearAuth(state) {
  const auth = authState(state);
  auth.pending = null;
  auth.profile = null;
  // A consumed recovery code stays consumed until this in-memory demo is reloaded.
}

function authStory() {
  return `<section class="auth-story" aria-label="${txt("About Medflow")}">
    <div class="brand auth-brand"><span class="auth-brand-symbol">${icon("health_and_safety")}</span><span><bdi>Medflow</bdi><span class="auth-brand-caption">${txt("Care, connected.")}</span></span></div>
    <div class="auth-story-content">
      <p class="auth-eyebrow">${txt("The care coordination workspace")}</p>
      <h2>${txt("Every patient.")}<br>${txt("Every team.")}<br><em>${txt("One shared view.")}</em></h2>
      <p class="auth-story-intro">${txt("Bring patient cases, care teams, and the next right step together. More clarity for your team. More time for care.")}</p>
      <md-card variant="outlined" class="auth-care-preview">
        <div class="auth-preview-header"><span>${icon("hub")} ${txt("Connected care")}</span><small>${txt("Illustrative workflow")}</small></div>
        <div class="auth-care-graphic" aria-hidden="true"><svg viewBox="0 0 380 90" fill="none"><path class="auth-flow-line" d="M48 45H330" stroke="currentColor" stroke-width="2" stroke-dasharray="4 6"/><circle cx="48" cy="45" r="29" fill="currentColor"/><circle cx="190" cy="45" r="29" fill="currentColor"/><circle cx="332" cy="45" r="29" fill="currentColor"/><path class="auth-flow-icon" d="M41 33h14v24H41zM44 38h8M44 43h8M44 48h5M184 45a6 6 0 1 0 12 0a6 6 0 1 0-12 0M178 58c2-9 22-9 24 0M185 33h10M327 44l4 4 9-11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="auth-care-labels"><div><strong>${txt("Patient cases")}</strong><span>${txt("All the context")}</span></div><div><strong>${txt("Care teams")}</strong><span>${txt("The right people")}</span></div><div><strong>${txt("Clear next steps")}</strong><span>${txt("Nothing missed")}</span></div></div>
      </md-card>
      <div class="auth-story-caption">${icon("favorite")} ${txt("Designed around the people who care.")}</div>
    </div>
    <div class="auth-story-footer"><span>${txt("Medflow / Enterprise")}</span><span>${txt("Built with AWC UI")}</span></div>
  </section>`;
}

function credentialsCard() {
  return `<md-card variant="filled" class="auth-demo-card"><div class="row between"><strong>${icon("science")} ${txt("Explore the demo")}</strong><span class="auth-demo-tag">${txt("Sample account")}</span></div><dl class="auth-credentials"><div><dt>${txt("Email")}</dt><dd dir="ltr">${esc(DEMO_EMAIL)}</dd></div><div><dt>${txt("Password")}</dt><dd class="mono" dir="ltr">${esc(DEMO_PASSWORD)}</dd></div></dl><md-button variant="outlined" full-width data-action="auth-fill-demo" icon="auto_awesome">${txt("Use demo credentials")}</md-button></md-card>`;
}

function verificationForm(recovery, auth) {
  const code = recovery ? RECOVERY_CODE : DEMO_CODE;
  const used = recovery && auth.recoveryUsed;
  return `<form id="${recovery ? "recovery" : "mfa"}-form" class="auth-fields">
    <md-card variant="filled" class="auth-code-card"><div class="row between"><span>${txt(recovery ? "Sample recovery code" : "Sample verification code")}</span><strong class="mono" dir="ltr">${esc(code)}</strong></div><p>${txt(used ? "Already used in this demo. Return to the six-digit code." : recovery ? "Single use during this demo session." : "No message was sent. Use this code to try MFA.")}</p></md-card>
    <md-otp-field name="code" label="${txt(recovery ? "Eight-character recovery code" : "Six-digit verification code")}" cell-label-template="${txt("Character {index} of {length}", { index: "{index}", length: "{length}" })}" length="${recovery ? 8 : 6}" group-size="${recovery ? 4 : 3}" validation-type="${getLanguage() === "ar" ? "none" : recovery ? "alphanumeric" : "numeric"}" inputmode="${recovery ? "text" : "numeric"}" ${recovery ? 'transform="uppercase"' : ""} required incomplete-label="${txt(recovery ? "Enter all eight characters." : "Enter all six digits.")}" value-missing-label="${txt("Enter the complete code.")}" reserve-supporting-space supporting-text="${txt("Verification expires five minutes after sign-in.")}"></md-otp-field>
    <p class="auth-error" id="auth-error" role="alert"></p>
    <md-button variant="filled" type="submit" full-width size="md">${txt("Verify and continue")}</md-button>
    <div class="auth-links"><md-button variant="text" data-action="${recovery ? "auth-mfa" : "auth-recovery"}">${txt(recovery ? "Use verification code" : "Use a recovery code")}</md-button></div>
  </form>`;
}

function languageSelect() {
  return `<md-select id="auth-language" class="auth-language" name="language" variant="outlined" label="${txt("Language")}" value="${esc(getLanguage())}" clear-label="${txt("Clear selection")}" loading-text="${txt("Loading…")}" search-placeholder="${txt("Search…")}" filter-label="${txt("Filter languages")}" no-results-text="${txt("No results")}" no-options-text="${txt("No options")}" searching-label="${txt("Searching")}" value-missing-label="${txt("Please select an item in the list.")}"><md-select-option value="en" label="English"></md-select-option><md-select-option value="ar" label="العربية"></md-select-option></md-select>`;
}

function verificationSteps() {
  return `<md-stepper class="auth-steps" label="${txt("Sign-in progress")}" active="1" readonly nav="false" auto-complete="false" step-word="${txt("Step")}" of-word="${txt("of")}" completed-word="${txt("completed")}" current-word="${txt("current")}" error-word="${txt("error")}" optional-word="${txt("Optional")}" next-label="${txt("Continue")}" back-label="${txt("Back")}" finish-label="${txt("Finish")}"><md-step label="${txt("Account")}" completed></md-step><md-step label="${txt("Verification")}"></md-step></md-stepper>`;
}

export function authView(route, state) {
  const auth = authState(state);
  const wantsChallenge = route === "mfa" || route === "recovery";
  const status = wantsChallenge ? challengeStatus(auth.pending) : { ok: true };
  // A direct MFA URL renders no challenge form unless sign-in created one.
  const screen = wantsChallenge && !status.ok ? "login" : route;
  const signup = screen === "signup";
  const recovery = screen === "recovery";
  const verification = screen === "mfa" || recovery;
  const title = verification
    ? recovery
      ? "A second way in."
      : "One more step."
    : signup
      ? "Join your care workspace."
      : "Welcome back.";
  // Each translated text segment is escaped; the profile name is never markup.
  const intro = verification
    ? txt("Verify the demo profile for {name} to open your workspace.", {
        name: auth.pending.name,
      })
    : txt(
        signup
          ? "Create a demo profile and experience connected care."
          : "Sign in to keep your care teams moving together.",
      );
  return `<div class="auth-page">${authStory()}<main id="main" tabindex="-1" class="auth-form-area">
    <div class="auth-topline">${verification || signup ? `<md-button variant="text" icon="arrow_back" mirror-icon data-action="auth-back">${txt("Back to sign in")}</md-button>` : `<span class="auth-hospital">${icon("local_hospital")} ${txt("St. Catherine medical center")}</span>`}<div class="auth-locale-controls"><md-chip class="auth-environment" variant="assist" appearance="filled" label="${txt("Demo workspace")}"></md-chip>${languageSelect()}</div></div>
    <div class="auth-form-content ${signup ? "auth-signup" : ""}">
      ${verification ? verificationSteps() : ""}
      <span class="auth-form-symbol">${icon(verification ? "phonelink_lock" : signup ? "person_add" : "stethoscope")}</span>
      <h1>${txt(title)}</h1><p class="auth-intro">${intro}</p>
      ${!status.ok ? `<p class="auth-route-error" role="alert">${esc(authMessage(status.message))}</p>` : ""}
      ${
        verification
          ? verificationForm(recovery, auth)
          : `<form id="${signup ? "signup" : "login"}-form" class="auth-fields">
        ${signup ? field("name", "Full name", "text", 'autocomplete="name" max-length="80"') : ""}
        ${field("email", "Work email", "email", 'autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false"')}
        ${field("password", "Password", "password", `autocomplete="${signup ? "new-password" : "current-password"}" ${signup ? `min-length="12" supporting-text="${txt("Use at least 12 characters. Choose a sample password.")}"` : ""}`)}
        ${signup ? field("confirm", "Confirm password", "password", 'autocomplete="new-password"') + `<label class="auth-consent"><md-checkbox name="consent" value="yes" required aria-label="${txt("I will use fictional details in this demo")}" value-missing-label="${txt("Confirm you will use fictional details.")}"></md-checkbox><span>${txt("I will use fictional details in this demo.")}</span></label>` : ""}
        <p class="auth-error" id="auth-error" role="alert"></p><md-button variant="filled" type="submit" full-width size="md">${txt(signup ? "Create demo profile" : "Sign in")}</md-button>
      </form>
      ${signup ? `<div class="auth-links"><span>${txt("Already have an account?")}</span><md-button variant="text" data-action="auth-login">${txt("Sign in")}</md-button></div>` : `<div class="auth-links"><span>${txt("New to Medflow?")}</span><md-button variant="text" data-action="auth-signup">${txt("Create an account")}</md-button></div>` + credentialsCard()}`
      }
      <p class="auth-disclosure">${icon("info")}<span>${txt("Interactive demo · fictional data · no identity service connected. Passwords are discarded.")} ${txt(verification ? "MFA is simulated." : "Use sample details only.")}</span></p>
    </div><footer class="auth-form-footer"><span>${txt("Care coordination, thoughtfully connected.")}</span><span>${txt("AWC UI component showcase")}</span></footer>
  </main></div>`;
}

function showError(form, message, name) {
  message = authMessage(message);
  const alert = form.querySelector("#auth-error");
  const control = name && form.querySelector(`[name="${name}"]`);
  if (control && control.localName !== "md-checkbox") {
    control.error = true;
    control.errorText = message;
    if (alert) alert.textContent = "";
    if (control.localName === "md-otp-field") control.value = "";
    void control.setFocus?.();
  } else if (alert) alert.textContent = message;
}

export function wireAuth(state, { navigate, toast, complete }) {
  const auth = authState(state);
  const pendingForms = new WeakSet();
  // Validation is synchronous. Busy feedback lasts only as long as the real
  // route transition; the guard also covers keyboard/programmatic resubmits.
  const transition = async (form, label, work) => {
    if (pendingForms.has(form)) return;
    pendingForms.add(form);
    try {
      await runAction(form, label, work);
    } catch {
      const message = "Unable to open this screen. Please try again.";
      if (form.isConnected) showError(form, message);
      else toast(t(message));
    } finally {
      pendingForms.delete(form);
    }
  };
  document
    .querySelectorAll("md-icon-button[data-auth-password]")
    .forEach((button) => {
      button.addEventListener("mdClick", async (event) => {
        event.stopPropagation();
        const control = button.closest("md-text-field");
        if (!control || control.disabled || control.readOnly) return;
        const input = await control.getInputElement();
        const start = input?.selectionStart;
        const end = input?.selectionEnd;
        const direction = input?.selectionDirection || "none";
        const visible = control.type === "password";
        control.type = visible ? "text" : "password";
        button.icon = visible ? "visibility_off" : "visibility";
        button.setAttribute(
          "aria-label",
          t(
            button.dataset.authPassword === "confirm"
              ? visible
                ? "Hide confirm password"
                : "Show confirm password"
              : visible
                ? "Hide password"
                : "Show password",
          ),
        );
        await new Promise(requestAnimationFrame);
        if (!control.isConnected) return;
        await control.setFocus();
        const current = await control.getInputElement();
        if (
          current &&
          start !== null &&
          start !== undefined &&
          end !== null &&
          end !== undefined
        )
          current.setSelectionRange(start, end, direction);
      });
    });
  // AWC's numeric sanitizer accepts ASCII. Let Arabic input reach this boundary
  // first, then normalize Arabic/Persian numerals and enforce the same whitelist.
  document.querySelectorAll(".auth-fields md-otp-field").forEach((otp) => {
    otp.addEventListener("mdInput", (event) => {
      const recovery = otp.closest("form")?.id === "recovery-form";
      const normalized = normalizeDigits(String(event.detail || ""))
        .toUpperCase()
        .replace(recovery ? /[^A-Z0-9]/g : /[^0-9]/g, "");
      if (otp.value !== normalized) otp.value = normalized;
    });
  });
  const begin = (form, profile) =>
    transition(form, "Opening verification…", async () => {
      auth.pending = createChallenge(profile);
      auth.profile = null;
      form.reset();
      await navigate("mfa");
    });
  document
    .querySelector("#login-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (pendingForms.has(form)) return;
      const data = Object.fromEntries(new FormData(form));
      if (!validateLogin(data))
        return showError(
          form,
          "Use the sample credentials below, or create a demo profile.",
          "password",
        );
      await begin(form, { name: "Sarah Chen", email: DEMO_EMAIL });
    });
  document
    .querySelector("#signup-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (pendingForms.has(form)) return;
      const data = Object.fromEntries(new FormData(form));
      const issue = validateSignup(data);
      if (issue) return showError(form, issue.message, issue.field);
      await begin(form, { name: data.name, email: data.email });
    });
  for (const id of ["mfa-form", "recovery-form"]) {
    document
      .querySelector(`#${id}`)
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (pendingForms.has(form)) return;
        const recovery = id === "recovery-form";
        const code = normalizeDigits(
          String(new FormData(form).get("code") || ""),
        );
        const result = checkChallenge(auth.pending, code, {
          recovery,
          recoveryUsed: Boolean(auth.recoveryUsed),
        });
        if (auth.pending && result.nextAttempts !== undefined)
          auth.pending.attempts = result.nextAttempts;
        if (!result.ok) {
          showError(form, result.message, "code");
          if (["missing", "expired", "locked"].includes(result.reason)) {
            await transition(form, "Returning to sign in…", async () => {
              clearAuth(state);
              await navigate("login");
              toast(authMessage(result.message));
            });
          }
          return;
        }
        const profile = {
          name: auth.pending.name,
          email: auth.pending.email,
          role: "Care coordinator",
          demo: true,
          mfaVerified: true,
        };
        await transition(form, "Opening workspace…", async () => {
          if (recovery) auth.recoveryUsed = true;
          auth.pending = null;
          auth.profile = profile;
          form.reset();
          await complete(profile);
        });
      });
  }
  document
    .querySelectorAll(
      ".auth-fields md-text-field,.auth-fields md-otp-field,.auth-fields md-checkbox",
    )
    .forEach((control) => {
      const clearError = () => {
        control.error = false;
        void control.setCustomValidity?.("");
        const alert = document.querySelector("#auth-error");
        if (alert) alert.textContent = "";
      };
      control.addEventListener("mdInput", clearError);
      control.addEventListener("mdChange", clearError);
      control.addEventListener("invalid", (event) => {
        // Keep constraint validation load-bearing while replacing the browser's
        // English-only balloon with the component's translated inline error.
        if (getLanguage() === "ar") event.preventDefault();
        control.error = true;
        if (control.localName === "md-checkbox") {
          const alert = document.querySelector("#auth-error");
          if (alert)
            alert.textContent = t("Confirm you will use fictional details.");
        } else
          control.errorText =
            control.localName === "md-otp-field"
              ? t("Enter the complete code.")
              : t("Check {field} and try again.", {
                  field: control.label.toLowerCase(),
                });
        if (getLanguage() === "ar")
          void control.setCustomValidity?.(
            control.localName === "md-checkbox"
              ? t("Confirm you will use fictional details.")
              : control.errorText,
          );
      });
    });
}

export function handleAuthAction(action, state, { navigate, toast }) {
  if (!action?.startsWith("auth-")) return false;
  const auth = authState(state);
  if (action === "auth-fill-demo") {
    const form = document.querySelector("#login-form");
    if (form) {
      form.querySelector('[name="email"]').value = DEMO_EMAIL;
      form.querySelector('[name="password"]').value = DEMO_PASSWORD;
      form.querySelectorAll("md-text-field").forEach((control) => {
        control.error = false;
        control.errorText = "";
        void control.setCustomValidity?.("");
      });
      form.querySelector("#auth-error").textContent = "";
      form.querySelector('md-button[type="submit"]')?.focus();
    }
  } else if (
    ["auth-login", "auth-back", "auth-signout", "auth-signup"].includes(action)
  ) {
    clearAuth(state);
    navigate(action === "auth-signup" ? "signup" : "login");
  } else if (action === "auth-mfa" || action === "auth-recovery") {
    const status = challengeStatus(auth.pending);
    if (!status.ok) {
      clearAuth(state);
      navigate("login");
      toast(authMessage(status.message));
    } else navigate(action === "auth-recovery" ? "recovery" : "mfa");
  }
  return true;
}
