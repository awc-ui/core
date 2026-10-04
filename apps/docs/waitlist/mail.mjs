import nodemailer from "nodemailer";
import { SENDER, OWNER, ORIGIN, OFFER_VERSION } from "./config.mjs";

export function messageFor(job) {
  if (job.offerVersion !== OFFER_VERSION) throw new Error("unsupported_offer");
  const common = {
    from: { name: "AWC UI Waitlist", address: SENDER },
    replyTo: SENDER,
    messageId: `<waitlist-${job.id}@awc-ui.dev>`,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  if (job.kind === "admin")
    return {
      ...common,
      to: OWNER,
      subject: "New AWC UI Data Grid waitlist signup",
      text: `A new address joined the Data Grid waitlist.\n\nEmail: ${job.email}\nJoined: ${new Date(job.createdAt).toISOString()}\nOffer: ${OFFER_VERSION}\n\nThis is a single opt-in signup; email ownership has not been verified.`,
    };
  if (
    job.kind !== "welcome" ||
    !/^[A-Za-z0-9_-]{43}$/.test(job.unsubscribeToken ?? "")
  )
    throw new Error("invalid_message");
  const unsubscribe = `${ORIGIN}/api/waitlist/unsubscribe?token=${job.unsubscribeToken}`;
  return {
    ...common,
    to: { address: job.email },
    subject: "You're on the AWC UI Data Grid waitlist",
    headers: {
      "List-Unsubscribe": `<${unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    // Plain text avoids remote trackers and treats submitted text only as text.
    text: `You're on the list!\n\nThanks for joining the AWC UI Data Grid waitlist. No confirmation is needed. Data Grid will be our first Pro product. We'll email you when it is available.\n\nYour early offer: 20% off your first annual Data Grid purchase, redeemable during the first 30 days after its commercial launch. Renewal is at the standard price shown before purchase. No payment is taken now, and joining does not start a subscription.\n\nOffer terms: ${ORIGIN}/waitlist-terms/\nPrivacy: ${ORIGIN}/privacy/\n\nIf you did not request this email, or no longer want waitlist messages, unsubscribe here:\n${unsubscribe}\n\nUnsubscribing does not remove your early offer eligibility.\n\nQuestions? Reply to this email.\nAWC UI`,
  };
}

export function createSmtpTransport(password) {
  return nodemailer.createTransport({
    host: "smtpout.secureserver.net",
    port: 465,
    secure: true,
    auth: { user: SENDER, pass: password },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    pool: false,
    logger: false,
    debug: false,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export function classifySmtpError(error) {
  const code = Number(error?.responseCode);
  // An explicit negative SMTP reply means the server has not accepted it.
  if (code >= 400 && code < 500)
    return { retryable: true, ambiguous: false, errorCode: "smtp_temporary" };
  if (code >= 500 && code < 600)
    return { retryable: false, ambiguous: false, errorCode: "smtp_rejected" };
  if (
    ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(error?.code) &&
    ["CONN", "CONNECTION"].includes(error?.command)
  )
    return { retryable: true, ambiguous: false, errorCode: "smtp_connection" };
  if (error?.code === "EAUTH")
    return { retryable: false, ambiguous: false, errorCode: "smtp_auth" };
  // Timeout/disconnect after DATA may have delivered. Automatic retry could spam.
  return { retryable: false, ambiguous: true, errorCode: "smtp_uncertain" };
}

export async function deliverOne({
  store,
  transport,
  subscriberId,
  clock = () => new Date(),
}) {
  const job = await store.claimOutbox({
    subscriberId,
    now: clock(),
    dailyLimit: 300,
    maxPendingAgeMs: 7 * 86400_000,
  });
  if (!job) return { status: "idle" };
  let message;
  try {
    message = messageFor(job);
  } catch {
    await store.failOutbox({
      id: job.id,
      claimToken: job.claimToken,
      now: clock(),
      retryable: false,
      ambiguous: false,
      errorCode: "invalid_message",
    });
    return { status: "failed", errorCode: "invalid_message" };
  }
  let accepted;
  try {
    const info = await transport.sendMail(message);
    accepted =
      Array.isArray(info.accepted) &&
      info.accepted.length === 1 &&
      (!info.rejected || info.rejected.length === 0);
    if (!accepted) throw new Error("smtp_uncertain");
  } catch (error) {
    const failure = classifySmtpError(error);
    await store.failOutbox({
      id: job.id,
      claimToken: job.claimToken,
      now: clock(),
      ...failure,
    });
    return {
      status: failure.ambiguous ? "uncertain" : "failed",
      errorCode: failure.errorCode,
    };
  }
  // Deliberately outside the SMTP catch: a DB write failure after acceptance
  // must leave the lease uncertain, never schedule another send.
  const saved = await store.completeOutbox({
    id: job.id,
    claimToken: job.claimToken,
    now: clock(),
  });
  return { status: saved ? "accepted" : "uncertain" };
}

export function queueSignupDelivery(
  runtime,
  context,
  subscriberId,
  deliver = deliverBatch,
) {
  if (typeof context?.waitUntil !== "function") return;
  if (runtime.config.signupCheckEnabled) {
    // Only a new, fully verified operator signup may send while general mail
    // is paused. Missing scope must never fall back to the global queue.
    if (
      runtime.config.joinEnabled !== false ||
      runtime.config.emailEnabled !== false ||
      runtime.config.smtpCheckEnabled !== false ||
      typeof subscriberId !== "string" ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(subscriberId)
    )
      throw new Error("invalid_operator_delivery_scope");
    context.waitUntil(
      deliver({
        ...runtime,
        config: { ...runtime.config, emailEnabled: true },
        subscriberId,
      }),
    );
  } else context.waitUntil(deliver(runtime));
}

export async function deliverBatch({
  store,
  config,
  subscriberId,
  maxJobs = 2,
  maxDurationMs = 10000,
}) {
  if (!config.emailEnabled || !config.smtpPassword) return;
  const transport = createSmtpTransport(config.smtpPassword);
  const deadline = Date.now() + maxDurationMs;
  try {
    for (let index = 0; index < maxJobs && Date.now() < deadline; index++) {
      const result = await deliverOne({ store, transport, subscriberId });
      console.info(`waitlist_delivery_${result.status}`);
      if (result.errorCode)
        console.error(`waitlist_delivery_${result.errorCode}`);
      if (result.status !== "accepted") break;
    }
  } catch {
    console.error("waitlist_delivery_unavailable");
  } finally {
    transport.close();
  }
}
