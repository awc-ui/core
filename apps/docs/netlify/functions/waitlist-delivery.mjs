import { getRuntime } from "../../waitlist/runtime.mjs";
import { runScheduledDelivery } from "../../waitlist/scheduled-delivery.mjs";

// Scheduled functions are not publicly callable on Netlify. Production context
// and separate switches prevent preview SMTP side effects. The explicit operator
// check can deliver only the owner's two messages while public signup is closed.
export default async (_request, context) => {
  try {
    const runtime = getRuntime(context);
    if (runtime) await runScheduledDelivery(runtime);
  } catch {
    console.error("waitlist_delivery_unavailable");
  }
};

export const config = { schedule: "0 * * * *" };
