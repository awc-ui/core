import { getRuntime } from "../../waitlist/runtime.mjs";
import { json } from "../../waitlist/handler.mjs";
import { createAdvertisingWithdrawalHandler } from "../../waitlist/advertising-withdraw.mjs";

export default async (request, context) => {
  try {
    const runtime = getRuntime(context);
    return runtime
      ? await createAdvertisingWithdrawalHandler(runtime)(request, context)
      : json(503, { ok: false });
  } catch {
    return json(503, { ok: false });
  }
};

export const config = {
  path: "/api/advertising/withdraw",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
