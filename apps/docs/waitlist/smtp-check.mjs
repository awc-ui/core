import { randomBytes } from "node:crypto";
import { OWNER, LIMITS } from "./config.mjs";
import { hashToken, privateKey } from "./handler.mjs";
import { deliverBatch } from "./mail.mjs";

// Called only by the private scheduled worker, after getRuntime has enforced
// production and privacy readiness. There is no HTTP recipient or CAPTCHA bypass.
// Operator authorization is recorded separately from public-form consent.
export async function runSmtpCheck({
  store,
  config,
  deliver = deliverBatch,
  clock = () => new Date(),
}) {
  if (
    !config.smtpCheckEnabled ||
    config.joinEnabled !== false ||
    config.emailEnabled !== false ||
    !config.smtpPassword
  )
    return;

  const unsubscribeToken = randomBytes(32).toString("base64url");
  const registration = await store.register({
    email: OWNER,
    emailKey: privateKey(config.hmacSecret, "email", OWNER),
    ipKey: privateKey(config.hmacSecret, "operator", "smtp-check"),
    unsubscribeHash: hashToken(unsubscribeToken),
    unsubscribeToken,
    consentVersion: "operator-email-check-v1",
    now: clock(),
    limits: LIMITS,
  });
  if (!registration.subscriberId) return;
  // Registration deduplication and existing outbox states prevent re-sending
  // accepted/uncertain messages across manual, scheduled, or concurrent runs.
  // Never drain unrelated subscribers while general delivery is disabled.
  await deliver({
    store,
    config: { ...config, emailEnabled: true },
    subscriberId: registration.subscriberId,
    maxJobs: 2,
  });
}
