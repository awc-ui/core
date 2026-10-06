import { isIP } from "node:net";
import { ORIGIN } from "./config.mjs";
import { json, privateKey, readBody } from "./handler.mjs";
import { consentKey, validConsentToken } from "./advertising.mjs";

export function createAdvertisingWithdrawalHandler({
  store,
  config,
  clock = () => new Date(),
}) {
  return async (request, context) => {
    if (request.method !== "POST")
      return json(405, { ok: false }, { Allow: "POST" });
    const url = new URL(request.url);
    if (
      url.origin !== ORIGIN ||
      url.pathname !== "/api/advertising/withdraw" ||
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
      body = JSON.parse(await readBody(request, 256));
    } catch {
      return json(400, { ok: false });
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !validConsentToken(body.token)
    )
      return json(400, { ok: false });
    if (!config?.hmacSecret || !isIP(context?.ip ?? ""))
      return json(503, { ok: false });
    const now = clock();
    try {
      // Separate rate-limit scope: withdrawing never spends signup attempts.
      const ipKey = privateKey(
        config.hmacSecret,
        "ad-withdraw",
        `${now.toISOString().slice(0, 10)}:${context.ip}`,
      );
      if (
        !(await store.consumeAttempt({
          ipKey,
          now,
          limits: { dailyAttemptsPerIp: 30 },
        }))
      )
        return json(429, { ok: false }, { "Retry-After": "3600" });
      await store.withdrawAdvertising({
        consentKey: consentKey(body.token),
        now,
      });
      // Same response whether this browser ever registered or not.
      return json(200, { ok: true });
    } catch {
      console.error("advertising_withdrawal_unavailable");
      return json(503, { ok: false });
    }
  };
}
