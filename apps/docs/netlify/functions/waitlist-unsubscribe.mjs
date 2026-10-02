import { getRuntime } from "../../waitlist/runtime.mjs";
import { createUnsubscribeHandler } from "../../waitlist/unsubscribe.mjs";
import { json } from "../../waitlist/handler.mjs";

export default async (request, context) => {
  try {
    const runtime = getRuntime(context);
    return runtime
      ? await createUnsubscribeHandler(runtime)(request)
      : json(503, { ok: false });
  } catch {
    return json(503, { ok: false });
  }
};

export const config = {
  path: "/api/waitlist/unsubscribe",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
