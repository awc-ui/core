import { readProviderConfigs } from "./advertising-providers.mjs";
import { readAdvertisingConfig } from "./advertising.mjs";

export const OFFER_VERSION = "datagrid-early-20-v1";
export const ORIGIN = "https://awc-ui.dev";
export const SENDER = "waitlist@awc-ui.dev";
export const OWNER = "ionut-valentin.mitrache@awc-ui.dev";
export const LIMITS = Object.freeze({
  dailyAttemptsPerIp: 30,
  dailyRegistrations: 100,
  dailyRegistrationsPerIp: 5,
  maxQueueDepth: 400,
});

// Deliberately supports ordinary ASCII mailbox names; no display names, lists,
// quoted local parts, CRLF or user-controlled headers. Dots/plus are preserved.
export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      email,
    )
  )
    return null;
  if (email.split("@")[0].length > 64) return null;
  return email;
}

// Every runtime path requires production metadata and the privacy readiness
// gate. Tests inject dependencies; preview flags never promote a deployment.
export function readConfig(env = process.env, context) {
  if (
    context?.deploy?.context !== "production" ||
    env.WAITLIST_PRIVACY_READY !== "true"
  )
    return null;
  if (
    !env.WAITLIST_HMAC_SECRET ||
    Buffer.byteLength(env.WAITLIST_HMAC_SECRET) < 32
  )
    return null;
  const signupCheckEmail = normalizeEmail(env.WAITLIST_SIGNUP_CHECK_EMAIL);
  return {
    advertising: readAdvertisingConfig(env),
    advertisingProviders: readProviderConfigs(env),
    hmacSecret: env.WAITLIST_HMAC_SECRET,
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    joinEnabled: env.WAITLIST_ENABLED === "true",
    emailEnabled: env.WAITLIST_EMAIL_ENABLED === "true",
    smtpCheckEnabled:
      env.WAITLIST_SMTP_CHECK_ENABLED === "true" &&
      env.WAITLIST_ENABLED === "false" &&
      env.WAITLIST_EMAIL_ENABLED === "false",
    signupCheckEnabled:
      env.WAITLIST_SIGNUP_CHECK_ENABLED === "true" &&
      env.WAITLIST_ENABLED === "false" &&
      env.WAITLIST_EMAIL_ENABLED === "false" &&
      (env.WAITLIST_SMTP_CHECK_ENABLED === undefined ||
        env.WAITLIST_SMTP_CHECK_ENABLED === "false") &&
      signupCheckEmail !== null,
    signupCheckEmail,
    smtpPassword: env.WAITLIST_SMTP_PASSWORD,
    // Enrollment closes at commercial launch. Until its date is known, the
    // explicit signup switch controls closure; an invalid supplied date fails
    // closed instead of silently removing a configured deadline.
    closesAt:
      env.WAITLIST_CLOSES_AT === undefined
        ? null
        : Date.parse(env.WAITLIST_CLOSES_AT),
  };
}
