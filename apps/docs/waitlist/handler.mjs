import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { OFFER_VERSION, ORIGIN, LIMITS, normalizeEmail } from "./config.mjs";
export { normalizeEmail } from "./config.mjs";

export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export const privateKey = (secret, kind, value) =>
  createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex");
export const headers = {
  "Cache-Control": "no-store",
  "Netlify-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      ...extra,
    },
  });

export async function readBody(request, max = 4096) {
  if (Number(request.headers.get("content-length")) > max)
    throw new Error("body_size");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, 5000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new Error("body_size");
      }
      chunks.push(value);
    }
    if (timedOut) throw new Error("body_timeout");
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

export async function verifyTurnstile({
  token,
  ip,
  secret,
  now,
  fetcher = fetch,
}) {
  const response = await fetcher(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
        idempotency_key: randomUUID(),
      }),
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) throw new Error("verification_unavailable");
  const result = await response.json();
  const timestamp = Date.parse(result.challenge_ts);
  return (
    result.success === true &&
    result.hostname === "awc-ui.dev" &&
    result.action === "waitlist_join" &&
    Number.isFinite(timestamp) &&
    timestamp <= now.getTime() + 5000 &&
    now.getTime() - timestamp <= 300_000
  );
}

export function createJoinHandler({
  config,
  store,
  verify = verifyTurnstile,
  clock = () => new Date(),
  onRegistered = () => {},
}) {
  return async (request, context) => {
    if (request.method !== "POST")
      return json(405, { ok: false }, { Allow: "POST" });
    const now = clock();
    // The browser check follows the ordinary verification/persistence path but
    // permits only its configured mailbox while public signup and SMTP are off.
    const signupCheckEmail = normalizeEmail(config?.signupCheckEmail);
    const signupCheck =
      config?.signupCheckEnabled === true &&
      config.joinEnabled === false &&
      config.emailEnabled === false &&
      config.smtpCheckEnabled === false &&
      signupCheckEmail !== null;
    if (
      (!config?.joinEnabled && !signupCheck) ||
      !config.turnstileSecret ||
      (config.closesAt !== null &&
        (!Number.isFinite(config.closesAt) || now.getTime() >= config.closesAt))
    )
      return json(503, { ok: false });
    const url = new URL(request.url);
    // Protect the direct function route and Netlify aliases too. Origin is a
    // browser guard, never a substitute for Turnstile and persisted budgets.
    if (
      url.origin !== ORIGIN ||
      url.pathname !== "/api/waitlist" ||
      request.headers.get("origin") !== ORIGIN
    )
      return json(403, { ok: false });
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return json(415, { ok: false });
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      return json(400, { ok: false });
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !["email", "token", "website"].includes(key),
      )
    )
      return json(400, { ok: false });
    const email = normalizeEmail(body.email);
    if (signupCheck && email !== signupCheckEmail)
      return json(503, { ok: false });
    if (
      !email ||
      typeof body.token !== "string" ||
      !body.token.length ||
      body.token.length > 2048 ||
      (body.website !== undefined && typeof body.website !== "string")
    )
      return json(400, { ok: false });
    if (body.website) return json(200, { ok: true });
    // Only Netlify's trusted context, never a client-supplied forwarding header.
    const ip = context?.ip;
    if (!ip || !isIP(ip)) return json(503, { ok: false });
    const ipKey = privateKey(
      config.hmacSecret,
      "ip",
      `${now.toISOString().slice(0, 10)}:${ip}`,
    );
    try {
      // Failed challenges consume only this IP's attempt quota, never the
      // shared registration or SMTP budgets used by legitimate visitors.
      if (!(await store.consumeAttempt({ ipKey, now, limits: LIMITS })))
        return json(429, { ok: false }, { "Retry-After": "3600" });
      if (
        !(await verify({
          token: body.token,
          ip,
          secret: config.turnstileSecret,
          now,
        }))
      )
        return json(403, { ok: false });
      const token = randomBytes(32).toString("base64url");
      const result = await store.register({
        email,
        emailKey: privateKey(config.hmacSecret, "email", email),
        ipKey,
        unsubscribeHash: hashToken(token),
        unsubscribeToken: token,
        offerVersion: OFFER_VERSION,
        now,
        limits: LIMITS,
      });
      if (result.status === "limited")
        return json(429, { ok: false }, { "Retry-After": "3600" });
      if (result.status === "registered") {
        try {
          onRegistered(context, result.subscriberId);
        } catch {
          console.error("waitlist_delivery_deferred");
        }
      }
      // Both new and duplicate/suppressed addresses get exactly the same reply.
      // Success means durable signup, not a claim that SMTP already delivered.
      return json(200, { ok: true });
    } catch {
      // Never include mailbox addresses, tokens, DB URLs or SMTP errors in logs.
      console.error("waitlist_request_unavailable");
      return json(503, { ok: false }, { "Retry-After": "60" });
    }
  };
}
