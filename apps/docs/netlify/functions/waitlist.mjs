import { getRuntime } from "../../waitlist/runtime.mjs";
import { createJoinHandler, json } from "../../waitlist/handler.mjs";
import { queueSignupDelivery } from "../../waitlist/mail.mjs";
import { deliverAdvertisingBatch } from "../../waitlist/advertising.mjs";

export default async (request, context) => {
  try {
    const runtime = getRuntime(context);
    return runtime
      ? await createJoinHandler({
          ...runtime,
          onRegistered: (ctx, subscriberId) => {
            queueSignupDelivery(runtime, ctx, subscriberId);
            if (
              runtime.config.advertising &&
              typeof ctx?.waitUntil === "function"
            )
              ctx.waitUntil(
                deliverAdvertisingBatch(runtime, { maxJobs: 2 }).catch(() => {
                  console.error("advertising_delivery_deferred");
                }),
              );
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
