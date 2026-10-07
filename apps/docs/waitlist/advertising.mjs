import { createHash } from "node:crypto";
import {
  deliverProvider,
  providerDestination,
} from "./advertising-providers.mjs";

export const AD_CONSENT_VERSION = "advertising-2026-10-07-v2";
export const AD_EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const AD_MAX_ATTEMPTS = 6;
export const AD_CONSENT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
export const consentKey = (token) =>
  createHash("sha256").update(token).digest("hex");
export const validConsentToken = (token) =>
  typeof token === "string" &&
  token.length === 43 &&
  /^[A-Za-z0-9_-]{43}$/.test(token);

// No endpoint, token, or dataset comes from a visitor. Missing/invalid config
// disables measurement without disabling signup or transactional email.
export function readAdvertisingConfig(env = process.env) {
  if (
    [
      env.META_DATASET_ID,
      env.META_GRAPH_API_VERSION,
      env.META_CAPI_ACCESS_TOKEN,
      env.META_TEST_EVENT_CODE,
    ].some(
      (value) =>
        value !== undefined &&
        (typeof value !== "string" || /[\r\n\0]/.test(value)),
    ) ||
    env.META_CAPI_ENABLED !== "true" ||
    !/^\d{5,30}$/.test(env.META_DATASET_ID ?? "") ||
    !/^v\d{1,2}\.0$/.test(env.META_GRAPH_API_VERSION ?? "") ||
    !/^[A-Za-z0-9_-]{20,4096}$/.test(env.META_CAPI_ACCESS_TOKEN ?? "") ||
    (env.META_TEST_EVENT_CODE !== undefined &&
      !/^[A-Za-z0-9_-]{1,100}$/.test(env.META_TEST_EVENT_CODE))
  )
    return null;
  return {
    datasetId: env.META_DATASET_ID,
    apiVersion: env.META_GRAPH_API_VERSION,
    accessToken: env.META_CAPI_ACCESS_TOKEN,
    testEventCode: env.META_TEST_EVENT_CODE,
  };
}

function identifier(value, kind, now) {
  if (typeof value !== "string") return undefined;
  const match = /^fb\.[0-2]\.(\d{13})\.([A-Za-z0-9_-]{1,500})$/.exec(value);
  if (
    !match ||
    match[0] !== value ||
    (kind === "fbp" && !/^\d{1,20}$/.test(match[2]))
  )
    return undefined;
  const age = now.getTime() - Number(match[1]);
  return age >= -300_000 && age <= 90 * 86400_000 ? value : undefined;
}

export function readAdvertisingMeasurement(
  value,
  userAgent,
  now = new Date(),
  enabled = { meta: true },
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.consent !== true ||
    value.version !== AD_CONSENT_VERSION ||
    !validConsentToken(value.token) ||
    Object.keys(value).some(
      (key) =>
        ![
          "consent",
          "version",
          "token",
          "fbp",
          "fbc",
          "rdt_cid",
          "gclid",
          "gbraid",
          "wbraid",
        ].includes(key),
    ) ||
    typeof userAgent !== "string" ||
    userAgent.length < 1 ||
    userAgent.length > 512 ||
    /[\r\n\0]/.test(userAgent)
  )
    return null;
  const fbp = enabled.meta ? identifier(value.fbp, "fbp", now) : undefined;
  const fbc = enabled.meta ? identifier(value.fbc, "fbc", now) : undefined;
  const click = (id) =>
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 500 &&
    !/[^A-Za-z0-9_-]/.test(id)
      ? id
      : undefined;
  const providers = {};
  const redditClick = enabled.reddit ? click(value.rdt_cid) : undefined;
  if (redditClick) providers.reddit = { click_id: redditClick };
  const googleIds = ["gclid", "gbraid", "wbraid"].filter(
    (key) => value[key] !== undefined,
  );
  if (enabled.google && googleIds.length === 1 && click(value[googleIds[0]]))
    providers.google = { [googleIds[0]]: value[googleIds[0]] };
  // Never invent attribution or substitute email/hash/IP identity.
  if (!fbp && !fbc && !Object.keys(providers).length) return null;
  return {
    consentKey: consentKey(value.token),
    version: AD_CONSENT_VERSION,
    ...(fbp || fbc
      ? {
          userData: {
            client_user_agent: userAgent,
            ...(fbp ? { fbp } : {}),
            ...(fbc ? { fbc } : {}),
          },
        }
      : {}),
    ...(Object.keys(providers).length
      ? {
          providers,
          destinations: Object.fromEntries(
            Object.keys(providers).map((provider) => [
              provider,
              providerDestination(provider, enabled[provider]),
            ]),
          ),
        }
      : {}),
  };
}

export function enabledAdvertisingProviders(config) {
  return {
    ...(config.advertising ? { meta: config.advertising } : {}),
    ...(config.advertisingProviders?.reddit
      ? { reddit: config.advertisingProviders.reddit }
      : {}),
    ...(config.advertisingProviders?.google
      ? { google: config.advertisingProviders.google }
      : {}),
  };
}

export async function deliverAdvertisingOne({
  store,
  config,
  fetcher = fetch,
  clock = () => new Date(),
  provider: selectedProvider,
}) {
  const providers = enabledAdvertisingProviders(config);
  if (selectedProvider !== undefined) {
    for (const provider of Object.keys(providers))
      if (provider !== selectedProvider) delete providers[provider];
  }
  if (!Object.keys(providers).length) return { status: "disabled" };
  const job = await store.claimAdvertising({
    now: clock(),
    providers: Object.keys(providers),
  });
  if (!job) return { status: "idle" };
  // Withdrawal may have happened after the lease was claimed. Once the HTTP
  // request is in flight it cannot be recalled; subsequent jobs are cancelled.
  if (
    !(await store.advertisingCanSend({
      id: job.id,
      claimToken: job.claimToken,
      now: clock(),
    }))
  )
    return { status: "cancelled" };
  const provider = job.provider ?? "meta";
  const settings = providers[provider];
  if (!settings) return { status: "disabled" };
  if (provider !== "meta") {
    if (job.destinationKey !== providerDestination(provider, settings)) {
      await store.failAdvertising({
        id: job.id,
        claimToken: job.claimToken,
        now: clock(),
        retryable: false,
        errorCode: "destination_changed",
      });
      return { status: "failed" };
    }
    const result = await deliverProvider({
      provider,
      settings,
      job,
      fetcher,
      canSend: () =>
        store.advertisingCanSend({
          id: job.id,
          claimToken: job.claimToken,
          now: clock(),
        }),
    });
    if (result.status === "cancelled") return { status: "cancelled" };
    if (result.status === "processing") {
      await store.deferAdvertising({
        id: job.id,
        claimToken: job.claimToken,
        requestId: result.requestId,
        now: clock(),
      });
    } else if (result.status === "accepted") {
      await store.completeAdvertising({
        id: job.id,
        claimToken: job.claimToken,
        now: clock(),
      });
    } else {
      await store.failAdvertising({
        id: job.id,
        claimToken: job.claimToken,
        now: clock(),
        retryable: result.retryable,
        errorCode: result.errorCode,
      });
    }
    return { status: result.status };
  }
  let retryable = true;
  let errorCode = "network";
  try {
    const response = await fetcher(
      `https://graph.facebook.com/${settings.apiVersion}/${settings.datasetId}/events`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.accessToken}`,
        },
        body: JSON.stringify({
          data: [
            {
              event_name: "Lead",
              event_id: job.id,
              event_time: Math.floor(new Date(job.createdAt).getTime() / 1000),
              action_source: "website",
              event_source_url: "https://awc-ui.dev/#pro-tier",
              user_data: job.userData,
            },
          ],
          ...(settings.testEventCode
            ? { test_event_code: settings.testEventCode }
            : {}),
        }),
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      },
    );
    if (response.ok) {
      const result = await response.json();
      if (result?.events_received === 1) {
        await store.completeAdvertising({
          id: job.id,
          claimToken: job.claimToken,
          now: clock(),
        });
        return { status: "accepted" };
      }
      // An unknown successful response may have accepted the event. Reuse the
      // original event_id and event_time for every retry, within 24 hours.
      errorCode = "invalid_response";
    } else {
      retryable = response.status === 429 || response.status >= 500;
      errorCode = `http_${response.status}`;
      // Graph can report a transient application error with HTTP 400. Keep
      // only the documented retry signal; never log/store the provider message.
      if (response.status === 400) {
        const result = await response.json();
        retryable = result?.error?.is_transient === true;
      } else await response.body?.cancel();
    }
  } catch {
    // Provider bodies, request payloads, and credentials never enter logs.
  }
  await store.failAdvertising({
    id: job.id,
    claimToken: job.claimToken,
    now: clock(),
    retryable,
    errorCode,
  });
  return { status: retryable ? "retry" : "failed" };
}

export async function deliverAdvertisingBatch(runtime, { maxJobs = 20 } = {}) {
  if (!Number.isSafeInteger(maxJobs) || maxJobs < 1 || maxJobs > 20)
    throw new TypeError("Invalid job limit");
  const providers = Object.keys(enabledAdvertisingProviders(runtime.config));
  // Each provider gets its own small worker budget. A slow OAuth exchange or
  // unavailable Reddit endpoint cannot consume Meta's delivery opportunity.
  await Promise.all(
    providers.map(async (provider, index) => {
      const quota =
        Math.floor(maxJobs / providers.length) +
        (index < maxJobs % providers.length ? 1 : 0);
      const deadline = Date.now() + 10_000;
      for (
        let attempt = 0;
        attempt < quota && Date.now() < deadline;
        attempt++
      ) {
        try {
          const result = await deliverAdvertisingOne({ ...runtime, provider });
          if (["disabled", "idle"].includes(result.status)) break;
          console.info(`advertising_${provider}_delivery_${result.status}`);
        } catch {
          console.error(`advertising_${provider}_delivery_deferred`);
          break;
        }
      }
    }),
  );
}
