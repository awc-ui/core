export const OFFER_VERSION = "datagrid-early-20-v1";
export const ORIGIN = "https://awc-ui.dev";
export const SENDER = "waitlist@awc-ui.dev";
export const OWNER = "ionut-valentin.mitrache@awc-ui.dev";
export const LIMITS = Object.freeze({
  dailyAttempts: 1000,
  dailyAttemptsPerIp: 30,
  dailyRegistrations: 100,
  dailyRegistrationsPerIp: 5,
  maxQueueDepth: 400,
});

// No test/preview override in deployed code. Tests inject dependencies into the
// pure handlers; they never enable production connections through an env flag.
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
  return {
    hmacSecret: env.WAITLIST_HMAC_SECRET,
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    joinEnabled: env.WAITLIST_ENABLED === "true",
    emailEnabled: env.WAITLIST_EMAIL_ENABLED === "true",
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
