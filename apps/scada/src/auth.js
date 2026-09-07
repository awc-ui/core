import { t } from "./i18n.js";
import {
  escapeHtml as esc,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_CODE,
  RECOVERY_CODE,
  validateSignup,
  checkChallenge,
} from "./model.js";

const icon = (name) =>
  '<span class="icon" aria-hidden="true">' + name + "</span>";
const field = (name, label, type = "text", extra = "") =>
  '<md-text-field variant="outlined" name="' +
  name +
  '" label="' +
  label +
  '" type="' +
  type +
  '" required reserve-supporting-space ' +
  (type === "password" ? 'password-toggle="internal" ' : "") +
  extra +
  "></md-text-field>";
export function authView(route, state, brand) {
  const signup = route === "signup",
    mfa = route === "mfa";
  const title = mfa
    ? "Verify your identity"
    : signup
      ? "Create your workspace access"
      : "Welcome back";
  const intro = mfa
    ? "Complete this demo with the six-digit code below."
    : signup
      ? "Set up a demo operator profile to explore Sentinel."
      : "Sign in to your SCADA monitoring workspace.";
  return (
    '<div class="auth-page"><section class="auth-story">' +
    brand() +
    '<div class="auth-content"><span class="eyebrow">OPERATIONS, IN FOCUS</span><h2>Your systems.<br>Your signals.<br><em>One clear view.</em></h2><p>Follow the process, spot what needs attention, and keep every asset in sight.</p><md-card variant="outlined" class="auth-preview"><div class="row between"><span class="small">North water treatment</span><span class="subtle">Demo plant</span></div><div class="metric-value">1,248 <span class="metric-unit">m³/h</span></div><md-sparkline data-spark="P-101" height="65px" variant="area" show-marks="none" aria-hidden="true"></md-sparkline><div class="row between small muted"><span>Intake flow</span><span>6 monitored assets</span></div></md-card></div><p class="auth-foot">SENTINEL / AWC UI<br>Interactive component showcase · Simulated environment</p></section><main id="main" tabindex="-1" class="auth-form-area"><md-button class="back" variant="text" data-action="overview" icon="arrow_back" mirror-icon>Back to monitoring</md-button><div class="auth-form">' +
    '<md-stepper class="auth-progress" label="Account verification progress" readonly nav="false" auto-complete="false" active="' +
    (mfa ? "1" : "0") +
    '"><md-step label="Account" ' +
    (mfa ? "completed" : "") +
    '></md-step><md-step label="Verification"></md-step></md-stepper>' +
    '<div class="auth-symbol">' +
    icon(mfa ? "phonelink_lock" : signup ? "person_add" : "shield_lock") +
    "</div><h1>" +
    title +
    "</h1><p>" +
    intro +
    "</p>" +
    (mfa
      ? '<form id="mfa-form"><md-card variant="filled" class="notice">Demo code: <strong class="mono">' +
        DEMO_CODE +
        '</strong><br>This code is shown here; no message was sent.</md-card><md-otp-field name="code" label="Six-digit verification code" length="6" group-size="3" required incomplete-label="Enter all six digits." reserve-supporting-space supporting-text="Demo challenge expires after five minutes."></md-otp-field><p class="auth-error" id="auth-error" role="alert"></p><md-button variant="filled" type="submit" full-width size="md">Verify and continue</md-button><md-button variant="text" data-action="recovery">Use a recovery code</md-button><md-button variant="text" data-action="login">Back to sign in</md-button></form>'
      : '<form id="' +
        (signup ? "signup" : "login") +
        '-form">' +
        (signup
          ? field(
              "name",
              "Full name",
              "text",
              'autocomplete="name" max-length="80"',
            )
          : "") +
        field(
          "email",
          signup ? "Work email" : "Email address",
          "email",
          'autocomplete="username"',
        ) +
        field(
          "password",
          "Password",
          "password",
          'autocomplete="' +
            (signup ? "new-password" : "current-password") +
            '" ' +
            (signup
              ? 'min-length="12" supporting-text="Use at least 12 characters."'
              : ""),
        ) +
        (signup
          ? field(
              "confirm",
              "Confirm password",
              "password",
              'autocomplete="new-password"',
            ) +
            '<label><md-checkbox name="consent" value="yes" required aria-label="I understand this creates a demo session only"></md-checkbox><span>I understand this creates a demo session only.</span></label>'
          : "") +
        '<p class="auth-error" id="auth-error" role="alert"></p><md-button variant="filled" type="submit" full-width size="md">' +
        (signup ? "Create demo profile" : "Continue to verification") +
        "</md-button></form>" +
        (signup
          ? '<div class="auth-links"><span class="muted">Already have access?</span><md-button variant="text" data-action="login">Sign in</md-button></div>'
          : '<div class="auth-divider"><md-divider aria-hidden="true"></md-divider><span>Try the complete flow</span><md-divider aria-hidden="true"></md-divider></div><md-button variant="outlined" full-width data-action="fill-demo" icon="science">Use demo credentials</md-button><div class="auth-links"><span class="muted">New to Sentinel?</span><md-button variant="text" data-action="signup">Create an account</md-button></div>')) +
    '<md-card variant="filled" class="notice">' +
    icon("info") +
    "<span>Interactive auth demo. No identity service is connected. Use sample details; passwords are discarded.</span> " +
    (mfa
      ? '<span>Profile:</span> <span translate="no">' +
        esc(state.pending?.name || "Demo operator") +
        "</span>"
      : "") +
    "</md-card></div></main></div>"
  );
}
export function wireAuth(state, { navigate, complete, runAction }) {
  const error = (message) => {
    const el = document.querySelector("#auth-error");
    if (el) el.textContent = t(message);
  };
  document
    .querySelector("#login-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (form.querySelector('md-button[type="submit"]')?.loading) return;
      const data = new FormData(form);
      if (
        data.get("email") !== DEMO_EMAIL ||
        data.get("password") !== DEMO_PASSWORD
      ) {
        error("Use the sample credentials below, or create a demo profile.");
        return;
      }
      await runAction(
        "auth",
        form.querySelector('md-button[type="submit"]'),
        t("Signing in…"),
        () => {
          state.pending = {
            name: "Alex Morgan",
            email: DEMO_EMAIL,
            expiresAt: Date.now() + 300000,
            attempts: 0,
          };
          form.reset();
          navigate("mfa");
        },
        { scope: form },
      );
    });
  document
    .querySelector("#signup-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (form.querySelector('md-button[type="submit"]')?.loading) return;
      const data = Object.fromEntries(new FormData(form));
      const issue = validateSignup(data);
      if (issue) {
        const field = form.querySelector('[name="' + issue.field + '"]');
        if (field && field.localName === "md-text-field") {
          error("");
          field.error = true;
          field.errorText = t(issue.message);
        } else error(issue.message);
        return;
      }
      await runAction(
        "auth",
        form.querySelector('md-button[type="submit"]'),
        t("Creating demo profile…"),
        () => {
          state.pending = {
            name: data.name.trim(),
            email: data.email.trim(),
            expiresAt: Date.now() + 300000,
            attempts: 0,
          };
          form.reset();
          navigate("mfa");
        },
        { scope: form },
      );
    });
  document.querySelector("#mfa-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (form.querySelector('md-button[type="submit"]')?.loading) return;
    const code = new FormData(form).get("code");
    const pending = state.pending;
    await runAction(
      "verification",
      form.querySelector('md-button[type="submit"]'),
      t("Verifying code…"),
      () => {
        const result = checkChallenge(pending, code);
        if (!result.ok) {
          error("");
          const otp = form.querySelector("md-otp-field");
          otp.error = true;
          otp.errorText = t(result.message);
          if (pending) pending.attempts++;
          return;
        }
        complete({
          name: pending.name,
          email: pending.email,
          demo: true,
          mfaVerified: true,
        });
      },
      { scope: form, isCurrent: () => state.pending === pending },
    );
  });
  document.querySelectorAll("md-text-field,md-otp-field").forEach((field) =>
    field.addEventListener("mdInput", () => {
      field.error = false;
      field.errorText = "";
      error("");
    }),
  );
}
export function fillDemo() {
  const form = document.querySelector("#login-form");
  if (!form) return;
  form.querySelector('[name="email"]').value = DEMO_EMAIL;
  form.querySelector('[name="password"]').value = DEMO_PASSWORD;
  document.querySelector("#auth-error").textContent = "";
}
export function recoveryMarkup() {
  return (
    '<md-dialog id="recovery-dialog" headline="Use a recovery code" icon="key"><form id="recovery-form" class="stack"><p class="small muted">Enter the sample code <strong class="mono">' +
    RECOVERY_CODE +
    '</strong> to try the alternate verification flow.</p><md-otp-field name="recovery" label="Eight-character recovery code" length="8" group-size="4" validation-type="alphanumeric" transform="uppercase" required incomplete-label="Enter all eight characters." reserve-supporting-space></md-otp-field><md-button variant="filled" type="submit" full-width>Verify recovery code</md-button></form><md-button variant="text" slot="actions" data-action="close-recovery">Cancel</md-button></md-dialog>'
  );
}
