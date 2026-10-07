import { deliverBatch } from "./mail.mjs";
import { runSmtpCheck } from "./smtp-check.mjs";
import { deliverAdvertisingBatch } from "./advertising.mjs";

export async function runScheduledDelivery(
  runtime,
  {
    email = deliverBatch,
    smtpCheck = runSmtpCheck,
    advertising = deliverAdvertisingBatch,
    clock = () => new Date(),
  } = {},
) {
  // Cleanup does not depend on either provider accepting requests. Run the two
  // stores independently too, so one failed maintenance query cannot starve the
  // other's retention work indefinitely.
  try {
    await runtime.store.maintain({ now: clock() });
  } catch {
    console.error("waitlist_maintenance_unavailable");
  }
  try {
    await runtime.store.maintainAdvertising({ now: clock() });
  } catch {
    console.error("advertising_maintenance_unavailable");
  }
  try {
    await advertising(runtime);
  } catch {
    console.error("advertising_delivery_unavailable");
  }
  try {
    if (runtime.config.smtpCheckEnabled) await smtpCheck(runtime);
    else await email({ ...runtime, maxJobs: 20 });
  } catch {
    console.error("waitlist_delivery_unavailable");
  }
}
