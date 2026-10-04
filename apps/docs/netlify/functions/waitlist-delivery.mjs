import { getRuntime } from "../../waitlist/runtime.mjs";
import { deliverBatch } from "../../waitlist/mail.mjs";
import { runSmtpCheck } from "../../waitlist/smtp-check.mjs";

// Scheduled functions are not publicly callable on Netlify. Production context
// and separate switches prevent preview SMTP side effects. The explicit operator
// check can deliver only the owner's two messages while public signup is closed.
export default async (_request, context) => {
  try {
    const runtime = getRuntime(context);
    if (runtime) {
      await runtime.store.maintain({ now: new Date() });
      if (runtime.config.smtpCheckEnabled) await runSmtpCheck(runtime);
      else await deliverBatch({ ...runtime, maxJobs: 20 });
    }
  } catch {
    console.error("waitlist_delivery_unavailable");
  }
};

export const config = { schedule: "0 * * * *" };
