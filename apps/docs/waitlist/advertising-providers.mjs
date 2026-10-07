// Each integration fails closed independently. No request-supplied URL, account,
// credential, email, hash, IP, or arbitrary event parameter reaches a provider.
const GOOGLE_INGEST = "https://datamanager.googleapis.com/v1/events:ingest";
const GOOGLE_STATUS =
  "https://datamanager.googleapis.com/v1/requestStatus:retrieve";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const MAX_RESPONSE_BYTES = 64 * 1024;
const GOOGLE_TRANSIENT = new Set([
  "UNAVAILABLE",
  "DEADLINE_EXCEEDED",
  "INTERNAL",
  "UNKNOWN",
  "ABORTED",
  "RESOURCE_EXHAUSTED",
]);
const GOOGLE_PERMANENT = new Set([
  "INVALID_ARGUMENT",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "FAILED_PRECONDITION",
  "UNAUTHENTICATED",
  "OUT_OF_RANGE",
  "UNIMPLEMENTED",
]);

const matches = (value, pattern) =>
  typeof value === "string" && !/[\r\n\0]/.test(value) && pattern.test(value);
const secret = (value) => matches(value, /^[\x21-\x7e]{10,4096}$/);
const customerId = (value) => matches(value, /^\d{10}$/);
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const clickId = (value) => matches(value, /^[A-Za-z0-9_-]{1,500}$/);
const eventId = (value) => matches(value, /^[A-Za-z0-9_-]{1,128}$/);
const requestId = (value) => matches(value, /^[A-Za-z0-9_-]{1,200}$/);

function validReddit(settings) {
  return (
    record(settings) &&
    matches(settings.pixelId, /^a2_[A-Za-z0-9]{1,64}$/) &&
    secret(settings.accessToken)
  );
}

function validGoogle(settings) {
  return (
    record(settings) &&
    customerId(settings.customerId) &&
    matches(settings.conversionActionId, /^\d{1,30}$/) &&
    (settings.loginCustomerId === undefined ||
      customerId(settings.loginCustomerId)) &&
    matches(settings.clientId, /^[A-Za-z0-9._-]{10,256}$/) &&
    secret(settings.clientSecret) &&
    secret(settings.refreshToken)
  );
}

export function readProviderConfigs(env = process.env) {
  const reddit = {
    pixelId: env.REDDIT_PIXEL_ID,
    accessToken: env.REDDIT_CAPI_ACCESS_TOKEN,
  };
  const google = {
    customerId: env.GOOGLE_CONVERSION_CUSTOMER_ID,
    conversionActionId: env.GOOGLE_CONVERSION_ACTION_ID,
    ...(env.GOOGLE_LOGIN_CUSTOMER_ID !== undefined
      ? { loginCustomerId: env.GOOGLE_LOGIN_CUSTOMER_ID }
      : {}),
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN,
  };
  return {
    reddit:
      env.REDDIT_CAPI_ENABLED === "true" && validReddit(reddit) ? reddit : null,
    google:
      env.GOOGLE_CONVERSIONS_ENABLED === "true" && validGoogle(google)
        ? google
        : null,
  };
}

// Bind queued events to a destination, without binding them to a credential
// that should be rotatable. The caller rejects a changed destination on retry.
export function providerDestination(provider, settings) {
  if (provider === "reddit" && validReddit(settings))
    return `reddit:${settings.pixelId}`;
  if (provider === "google" && validGoogle(settings))
    return `google:${settings.customerId}:${settings.conversionActionId}:${settings.loginCustomerId ?? settings.customerId}`;
  return null;
}

const failure = (errorCode, retryable = false) => ({
  status: retryable ? "retry" : "failed",
  retryable,
  errorCode,
});

// Read a bounded response under the same abort deadline as its request. Never
// include provider descriptions or bodies in exceptions, logs, or return values.
async function readJson(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } finally {
    reader.releaseLock();
  }
}

async function send(fetcher, url, options) {
  const response = await fetcher(url, {
    ...options,
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  const body = await readJson(response);
  return { response, body };
}

function httpFailure(provider, stage, response, body) {
  const status = response.status;
  let retryable = status === 408 || status === 429 || status >= 500;
  if (provider === "google") {
    const reason = body?.error?.status;
    if (GOOGLE_TRANSIENT.has(reason)) retryable = true;
    if (GOOGLE_PERMANENT.has(reason)) retryable = false;
  }
  return failure(`${provider}_${stage}_http_${status}`, retryable);
}

function timestamp(job) {
  const input = job?.createdAt;
  if (!(input instanceof Date) && typeof input !== "string") return null;
  if (
    typeof input === "string" &&
    (input.length > 64 || /[\r\n\0]/.test(input))
  )
    return null;
  const date = new Date(input);
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : null;
}

function identifiers(userData, allowed) {
  if (!record(userData)) return null;
  const keys = Object.keys(userData);
  if (
    keys.length !== 1 ||
    !allowed.includes(keys[0]) ||
    !clickId(userData[keys[0]])
  )
    return null;
  return { [keys[0]]: userData[keys[0]] };
}

async function deliverReddit(settings, job, fetcher) {
  const data = identifiers(job.userData, ["click_id"]);
  const date = timestamp(job);
  if (!data || !date) return failure("reddit_invalid_job");
  const { response, body } = await send(
    fetcher,
    `https://ads-api.reddit.com/api/v3/pixels/${settings.pixelId}/conversion_events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.accessToken}`,
      },
      body: JSON.stringify({
        events: [
          {
            event_at: date.getTime(),
            action_source: "WEBSITE",
            event_source_url: "https://awc-ui.dev/",
            type: { tracking_type: "SIGN_UP" },
            click_id: data.click_id,
            metadata: { conversion_id: job.id },
          },
        ],
      }),
    },
  );
  if (!response.ok) return httpFailure("reddit", "ingest", response, body);
  return body?.data?.message === "Successfully processed 1 conversion events."
    ? { status: "accepted" }
    : failure("reddit_invalid_response", true);
}

async function googleAccessToken(settings, fetcher) {
  const { response, body } = await send(fetcher, GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      refresh_token: settings.refreshToken,
    }).toString(),
  });
  if (!response.ok) return httpFailure("google", "oauth", response, body);
  if (
    !secret(body?.access_token) ||
    body.token_type !== "Bearer" ||
    !Number.isFinite(body.expires_in) ||
    body.expires_in <= 0
  )
    return failure("google_invalid_oauth_response", true);
  return { accessToken: body.access_token };
}

function destination(settings) {
  return {
    operatingAccount: {
      accountType: "GOOGLE_ADS",
      accountId: settings.customerId,
    },
    ...(settings.loginCustomerId
      ? {
          loginAccount: {
            accountType: "GOOGLE_ADS",
            accountId: settings.loginCustomerId,
          },
        }
      : {}),
    productDestinationId: settings.conversionActionId,
  };
}

function sameDestination(actual, settings) {
  if (
    !record(actual) ||
    actual.operatingAccount?.accountType !== "GOOGLE_ADS" ||
    actual.operatingAccount.accountId !== settings.customerId ||
    actual.productDestinationId !== settings.conversionActionId ||
    actual.linkedAccount !== undefined
  )
    return false;
  // Direct access may be returned with the implicit login account made explicit.
  const login = actual.loginAccount;
  if (login === undefined) return settings.loginCustomerId === undefined;
  return (
    login?.accountType === "GOOGLE_ADS" &&
    login.accountId === (settings.loginCustomerId ?? settings.customerId)
  );
}

function cleanCounts(info, name) {
  if (info === undefined) return true;
  if (!record(info) || (info[name] !== undefined && !Array.isArray(info[name])))
    return false;
  return (info[name] ?? []).every(
    (entry) => record(entry) && entry.recordCount === "0",
  );
}

async function pollGoogle(settings, job, fetcher, accessToken) {
  const url = new URL(GOOGLE_STATUS);
  url.searchParams.set("requestId", job.remoteRequestId);
  const { response, body } = await send(fetcher, url.href, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return httpFailure("google", "diagnostics", response, body);
  const rows = body?.requestStatusPerDestination;
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    !sameDestination(rows[0]?.destination, settings)
  )
    return failure("google_invalid_diagnostics", true);
  const row = rows[0];
  if (row.requestStatus === "PROCESSING")
    return { status: "processing", requestId: job.remoteRequestId };
  if (["FAILED", "PARTIAL_SUCCESS"].includes(row.requestStatus))
    return failure("google_diagnostics_failed");
  if (
    row.requestStatus !== "SUCCESS" ||
    row.eventsIngestionStatus?.recordCount !== "1"
  )
    return failure("google_invalid_diagnostics", true);
  if (
    !cleanCounts(row.errorInfo, "errorCounts") ||
    !cleanCounts(row.warningInfo, "warningCounts")
  )
    return failure("google_diagnostics_warning_or_error");
  return { status: "accepted" };
}

async function deliverGoogle(settings, job, fetcher, canSend) {
  const polling =
    job.remoteRequestId !== undefined && job.remoteRequestId !== null;
  const data = polling
    ? null
    : identifiers(job.userData, ["gclid", "gbraid", "wbraid"]);
  const date = polling ? null : timestamp(job);
  if (
    (polling && !requestId(job.remoteRequestId)) ||
    (!polling && (!data || !date))
  )
    return failure("google_invalid_job");
  const token = await googleAccessToken(settings, fetcher);
  if (!token.accessToken) return token;
  // OAuth can take several seconds. Recheck the live consent and lease after
  // it completes, before any conversion payload or diagnostics request leaves.
  if (!(await canSend())) return { status: "cancelled" };
  if (polling) return pollGoogle(settings, job, fetcher, token.accessToken);
  const { response, body } = await send(fetcher, GOOGLE_INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.accessToken}`,
    },
    body: JSON.stringify({
      destinations: [destination(settings)],
      consent: {
        adUserData: "CONSENT_GRANTED",
        adPersonalization: "CONSENT_DENIED",
      },
      events: [
        {
          transactionId: job.id,
          eventTimestamp: date.toISOString(),
          eventSource: "WEB",
          adIdentifiers: data,
        },
      ],
      validateOnly: false,
    }),
  });
  if (!response.ok) return httpFailure("google", "ingest", response, body);
  if (!requestId(body?.requestId))
    return failure("google_invalid_response", true);
  if (
    body.fieldWarnings !== undefined &&
    (!Array.isArray(body.fieldWarnings) || body.fieldWarnings.length !== 0)
  )
    return {
      ...failure("google_ingestion_warning"),
      requestId: body.requestId,
    };
  return { status: "processing", requestId: body.requestId };
}

export async function deliverProvider({
  provider,
  settings,
  job,
  fetcher = fetch,
  canSend = () => true,
}) {
  if (!record(job) || !eventId(job.id))
    return failure("invalid_advertising_job");
  if (
    (provider === "reddit" && !validReddit(settings)) ||
    (provider === "google" && !validGoogle(settings)) ||
    !["reddit", "google"].includes(provider)
  )
    return failure("invalid_provider_config");
  try {
    return await (provider === "reddit"
      ? deliverReddit(settings, job, fetcher)
      : deliverGoogle(settings, job, fetcher, canSend));
  } catch {
    return failure(`${provider}_network`, true);
  }
}
