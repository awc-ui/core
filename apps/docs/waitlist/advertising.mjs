import { createHash } from "node:crypto";

export const AD_CONSENT_VERSION = "advertising-2026-10-06-v1";
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

export function readAdvertisingMeasurement(value, userAgent, now = new Date()) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.consent !== true ||
    value.version !== AD_CONSENT_VERSION ||
    !validConsentToken(value.token) ||
    Object.keys(value).some(
      (key) => !["consent", "version", "token", "fbp", "fbc"].includes(key),
    ) ||
    typeof userAgent !== "string" ||
    userAgent.length < 1 ||
    userAgent.length > 512 ||
    /[\r\n\0]/.test(userAgent)
  )
    return null;
  const fbp = identifier(value.fbp, "fbp", now);
  const fbc = identifier(value.fbc, "fbc", now);
  // Do not substitute an email hash or IP when attribution is unavailable.
  if (!fbp && !fbc) return null;
  return {
    consentKey: consentKey(value.token),
    version: AD_CONSENT_VERSION,
    userData: {
      client_user_agent: userAgent,
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
    },
  };
}

export async function deliverAdvertisingOne({
  store,
  config,
  fetcher = fetch,
  clock = () => new Date(),
}) {
  if (!config.advertising) return { status: "disabled" };
  const job = await store.claimAdvertising({ now: clock() });
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
  const settings = config.advertising;
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
  const deadline = Date.now() + 10_000;
  for (let index = 0; index < maxJobs && Date.now() < deadline; index++) {
    const result = await deliverAdvertisingOne(runtime);
    if (["disabled", "idle"].includes(result.status)) break;
    console.info(`advertising_delivery_${result.status}`);
  }
}
