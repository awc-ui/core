import { getRuntime } from "../../waitlist/runtime.mjs";
import { createJoinHandler, json } from "../../waitlist/handler.mjs";
import { deliverBatch } from "../../waitlist/mail.mjs";

export default async (request, context) => {
  try {
    const runtime = getRuntime(context);
    return runtime
      ? await createJoinHandler({
          ...runtime,
          onRegistered: (ctx) => {
            if (typeof ctx.waitUntil === "function")
              ctx.waitUntil(deliverBatch(runtime));
          },
        })(request, context)
      : json(503, { ok: false });
  } catch {
    return json(503, { ok: false });
  }
};

export const config = {
  path: "/api/waitlist",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
