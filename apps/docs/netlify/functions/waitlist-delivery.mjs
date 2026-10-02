import { getRuntime } from "../../waitlist/runtime.mjs";
import { deliverBatch } from "../../waitlist/mail.mjs";

// Scheduled functions are not publicly callable on Netlify. Production context
// and the separate mail switch also prevent preview/manual SMTP side effects.
export default async (_request, context) => {
  try {
    const runtime = getRuntime(context);
    if (runtime) {
      await runtime.store.maintain({ now: new Date() });
      await deliverBatch({ ...runtime, maxJobs: 20 });
    }
  } catch {
    console.error("waitlist_delivery_unavailable");
  }
};

export const config = { schedule: "0 * * * *" };
