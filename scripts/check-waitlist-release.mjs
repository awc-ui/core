#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Validate public build configuration without loading any runtime credentials. */
export function checkWaitlistRelease(env = process.env) {
  const enabled = env.PUBLIC_WAITLIST_ENABLED;
  const signupCheckEnabled = env.PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED;
  const measurementFlags = [
    ["PUBLIC_META_MEASUREMENT_ENABLED", "Meta"],
    ["PUBLIC_REDDIT_MEASUREMENT_ENABLED", "Reddit"],
    ["PUBLIC_GOOGLE_MEASUREMENT_ENABLED", "Google"],
  ];
  for (const [name, value] of [
    ["PUBLIC_WAITLIST_ENABLED", enabled],
    ["PUBLIC_WAITLIST_SIGNUP_CHECK_ENABLED", signupCheckEnabled],
    ...measurementFlags.map(([name]) => [name, env[name]]),
  ]) {
    if (![undefined, "", "false", "true"].includes(value))
      throw new Error(`${name} must be true or false.`);
  }
  for (const [name, provider] of measurementFlags) {
    if (
      env[name] === "true" &&
      (env.CONTEXT !== "production" || enabled !== "true")
    )
      throw new Error(
        `${provider} measurement requires the production public waitlist.`,
      );
  }
  if (enabled !== "true" && signupCheckEnabled !== "true")
    return { enabled: false };
  if (signupCheckEnabled === "true" && enabled !== "false")
    throw new Error(
      "An operator signup check requires PUBLIC_WAITLIST_ENABLED=false.",
    );
  if (env.CONTEXT !== "production")
    throw new Error(
      "The public waitlist may only be enabled in the production build.",
    );

  const key = env.PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!key || !/^0x4[A-Za-z0-9_-]{10,100}$/.test(key)) {
    throw new Error(
      "An enabled production waitlist needs a real PUBLIC_TURNSTILE_SITE_KEY, never a testing key.",
    );
  }
  for (const name of [
    "PUBLIC_WAITLIST_CONTROLLER_NAME",
    "PUBLIC_WAITLIST_CONTACT_ADDRESS",
  ]) {
    const value = env[name]?.trim();
    if (
      !value ||
      value.length < 5 ||
      /(?:\bTODO\b|\bTBD\b|placeholder|example\.com|\[.+\])/i.test(value)
    ) {
      throw new Error(
        `An enabled production waitlist needs completed ${name}.`,
      );
    }
  }
  return signupCheckEnabled === "true"
    ? { enabled: false, signupCheckEnabled: true }
    : { enabled: true };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { enabled, signupCheckEnabled } = checkWaitlistRelease();
    console.log(
      `Waitlist public configuration verified (${signupCheckEnabled ? "operator check only" : enabled ? "enabled" : "disabled"}).`,
    );
  } catch (error) {
    console.error(`[waitlist:release] ${error.message}`);
    process.exitCode = 1;
  }
}
