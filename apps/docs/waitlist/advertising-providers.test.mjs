import assert from "node:assert/strict";
import test from "node:test";
import {
  deliverProvider,
  providerDestination,
  readProviderConfigs,
} from "./advertising-providers.mjs";

const env = {
  REDDIT_CAPI_ENABLED: "true",
  REDDIT_PIXEL_ID: "a2_example123",
  REDDIT_CAPI_ACCESS_TOKEN: "test-only.reddit-token",
  GOOGLE_CONVERSIONS_ENABLED: "true",
  GOOGLE_CONVERSION_CUSTOMER_ID: "1234567890",
  GOOGLE_CONVERSION_ACTION_ID: "987654321",
  GOOGLE_OAUTH_CLIENT_ID: "test-only.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-only-client-secret",
  GOOGLE_OAUTH_REFRESH_TOKEN: "test-only-refresh-token",
};
const configs = readProviderConfigs(env);
const baseJob = {
  id: "8b87ee82-5a98-491f-b662-f52ed89f2e2a",
  createdAt: new Date("2026-10-07T12:34:56Z"),
};
const googleJob = { ...baseJob, userData: { gclid: "test-click-id" } };
const redditJob = { ...baseJob, userData: { click_id: "test-reddit-click" } };
const token = {
  access_token: "test-only-google-access-token",
  expires_in: 3600,
  token_type: "Bearer",
};
const remoteId = "3221b3bd-2a97-47e2-9f97-8116a8623ea4";
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });
const googleStatus = (overrides = {}) => ({
  requestStatusPerDestination: [
    {
      destination: {
        operatingAccount: {
          accountType: "GOOGLE_ADS",
          accountId: configs.google.customerId,
        },
        productDestinationId: configs.google.conversionActionId,
      },
      requestStatus: "SUCCESS",
      eventsIngestionStatus: { recordCount: "1" },
      ...overrides,
    },
  ],
});
function sequence(responses, requests = []) {
  return async (url, options) => {
    requests.push({ url, options });
    assert.ok(responses.length, "Unexpected provider request");
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}
const google = (fetcher, job = googleJob, settings = configs.google) =>
  deliverProvider({ provider: "google", settings, job, fetcher });
const reddit = (fetcher, job = redditJob) =>
  deliverProvider({
    provider: "reddit",
    settings: configs.reddit,
    job,
    fetcher,
  });

test("configuration is opt-in, independently validated and bounded", () => {
  assert.deepEqual(readProviderConfigs({}), { reddit: null, google: null });
  assert.deepEqual(
    readProviderConfigs({ ...env, GOOGLE_CONVERSIONS_ENABLED: "TRUE" }),
    {
      reddit: configs.reddit,
      google: null,
    },
  );
  for (const invalid of [
    { REDDIT_PIXEL_ID: "a2_bad/../other" },
    { REDDIT_PIXEL_ID: `${env.REDDIT_PIXEL_ID}\n` },
    { REDDIT_CAPI_ACCESS_TOKEN: "" },
    { REDDIT_CAPI_ACCESS_TOKEN: "x".repeat(4097) },
    { REDDIT_CAPI_ACCESS_TOKEN: "test\0secretvalue" },
    { REDDIT_CAPI_ACCESS_TOKEN: "test token spaces" },
  ])
    assert.deepEqual(readProviderConfigs({ ...env, ...invalid }), {
      reddit: null,
      google: configs.google,
    });
  for (const invalid of [
    { GOOGLE_CONVERSION_CUSTOMER_ID: "123-456-7890" },
    { GOOGLE_CONVERSION_CUSTOMER_ID: 1234567890 },
    { GOOGLE_CONVERSION_ACTION_ID: "customers/123/actions/456" },
    { GOOGLE_CONVERSION_ACTION_ID: "9".repeat(31) },
    { GOOGLE_LOGIN_CUSTOMER_ID: "" },
    { GOOGLE_LOGIN_CUSTOMER_ID: "1234567890\r" },
    { GOOGLE_OAUTH_CLIENT_ID: "https://evil.example/credentials" },
    { GOOGLE_OAUTH_CLIENT_SECRET: "" },
    { GOOGLE_OAUTH_REFRESH_TOKEN: "test\nsecretvalue" },
  ])
    assert.deepEqual(readProviderConfigs({ ...env, ...invalid }), {
      reddit: configs.reddit,
      google: null,
    });
});

test("destination keys bind account/action/login but tolerate credential rotation", () => {
  assert.equal(
    providerDestination("reddit", configs.reddit),
    "reddit:a2_example123",
  );
  const key = providerDestination("google", configs.google);
  assert.equal(key, "google:1234567890:987654321:1234567890");
  assert.equal(
    providerDestination("google", {
      ...configs.google,
      refreshToken: "test-only-rotated-refresh-token",
    }),
    key,
  );
  for (const delta of [
    { customerId: "0987654321" },
    { conversionActionId: "1" },
    { loginCustomerId: "0987654321" },
  ])
    assert.notEqual(
      providerDestination("google", { ...configs.google, ...delta }),
      key,
    );
  assert.equal(providerDestination("google", {}), null);
  assert.equal(providerDestination("unknown", configs.google), null);
  assert.ok(key.length <= 256);
});

test("invalid jobs cannot transmit identity fields or select another endpoint", async () => {
  let calls = 0;
  const fetcher = () => {
    calls++;
    throw new Error("No network permitted");
  };
  for (const userData of [
    {},
    [],
    { gclid: "x", email: "private@example.test" },
    { gclid: "x", wbraid: "y" },
    { ip_address: "192.0.2.1" },
    { gclid: "invalid\n" },
    { gclid: "x".repeat(501) },
  ])
    assert.equal(
      (await google(fetcher, { ...googleJob, userData })).status,
      "failed",
    );
  assert.equal(
    (
      await reddit(fetcher, {
        ...redditJob,
        userData: { click_id: "x", user: { email: "private@example.test" } },
      })
    ).status,
    "failed",
  );
  assert.equal(
    (await reddit(fetcher, { ...redditJob, createdAt: "invalid date" })).status,
    "failed",
  );
  assert.equal(
    (await google(fetcher, { ...googleJob, id: "unsafe\n" })).status,
    "failed",
  );
  assert.equal(
    (
      await google(fetcher, {
        ...googleJob,
        remoteRequestId: "http://evil.test",
      })
    ).status,
    "failed",
  );
  assert.equal(
    (
      await google(fetcher, googleJob, {
        ...configs.google,
        customerId: "unsafe",
      })
    ).status,
    "failed",
  );
  assert.equal(calls, 0);
});

test("Reddit submits exactly one signup, with a stable ID and only consented click identity", async () => {
  const requests = [];
  const result = await reddit(
    sequence(
      [
        json({
          data: { message: "Successfully processed 1 conversion events." },
        }),
      ],
      requests,
    ),
  );
  assert.deepEqual(result, { status: "accepted" });
  assert.equal(
    requests[0].url,
    "https://ads-api.reddit.com/api/v3/pixels/a2_example123/conversion_events",
  );
  assert.equal(requests[0].options.redirect, "error");
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.equal(
    requests[0].options.headers.Authorization,
    `Bearer ${env.REDDIT_CAPI_ACCESS_TOKEN}`,
  );
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    events: [
      {
        event_at: baseJob.createdAt.getTime(),
        action_source: "WEBSITE",
        event_source_url: "https://awc-ui.dev/",
        type: { tracking_type: "SIGN_UP" },
        click_id: "test-reddit-click",
        metadata: { conversion_id: baseJob.id },
      },
    ],
  });
});

test("Reddit distinguishes exact acceptance from malformed or rejected requests", async () => {
  for (const [response, expected] of [
    [
      json({
        data: { message: "Successfully processed 0 conversion events." },
      }),
      "retry",
    ],
    [json({}), "retry"],
    [new Response("bad JSON"), "retry"],
    [json({ message: "private@example.test" }, 400), "failed"],
    [json({}, 401), "failed"],
    [json({}, 429), "retry"],
    [json({}, 503), "retry"],
  ]) {
    const result = await reddit(sequence([response]));
    assert.equal(result.status, expected);
    assert.ok(!JSON.stringify(result).includes("private@example.test"));
  }
});

test("Google refreshes only at the fixed OAuth endpoint, then queues exact click-only request", async () => {
  for (const kind of ["gclid", "gbraid", "wbraid"]) {
    const requests = [];
    const result = await google(
      sequence([json(token), json({ requestId: remoteId })], requests),
      {
        ...googleJob,
        userData: { [kind]: "test-click-id" },
      },
    );
    assert.deepEqual(result, { status: "processing", requestId: remoteId });
    assert.equal(requests[0].url, "https://oauth2.googleapis.com/token");
    assert.deepEqual(
      Object.fromEntries(new URLSearchParams(requests[0].options.body)),
      {
        grant_type: "refresh_token",
        client_id: env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
        refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
      },
    );
    assert.equal(
      requests[1].url,
      "https://datamanager.googleapis.com/v1/events:ingest",
    );
    assert.deepEqual(JSON.parse(requests[1].options.body), {
      destinations: [
        {
          operatingAccount: {
            accountType: "GOOGLE_ADS",
            accountId: "1234567890",
          },
          productDestinationId: "987654321",
        },
      ],
      consent: {
        adUserData: "CONSENT_GRANTED",
        adPersonalization: "CONSENT_DENIED",
      },
      events: [
        {
          transactionId: baseJob.id,
          eventTimestamp: baseJob.createdAt.toISOString(),
          eventSource: "WEB",
          adIdentifiers: { [kind]: "test-click-id" },
        },
      ],
      validateOnly: false,
    });
    for (const request of requests) {
      assert.equal(request.options.redirect, "error");
      assert.ok(request.options.signal instanceof AbortSignal);
    }
  }
});

test("Google retries preserve the original conversion ID, timestamp and destination", async () => {
  const requests = [];
  const settings = { ...configs.google, loginCustomerId: "1111111111" };
  assert.equal(
    (
      await google(
        sequence([json(token), new Error("secret-body")], requests),
        googleJob,
        settings,
      )
    ).status,
    "retry",
  );
  await google(
    sequence([json(token), json({ requestId: remoteId })], requests),
    googleJob,
    settings,
  );
  assert.equal(requests[1].options.body, requests[3].options.body);
  assert.deepEqual(
    JSON.parse(requests[1].options.body).destinations[0].loginAccount,
    { accountType: "GOOGLE_ADS", accountId: "1111111111" },
  );
});

test("Google transport failures do not leak credentials or provider bodies", async () => {
  for (const [status, reason, expected] of [
    [400, "INVALID_ARGUMENT", "failed"],
    [401, "UNAUTHENTICATED", "failed"],
    [403, "PERMISSION_DENIED", "failed"],
    [429, "RESOURCE_EXHAUSTED", "retry"],
    [503, "UNAVAILABLE", "retry"],
    [500, "INTERNAL", "retry"],
  ]) {
    const result = await google(
      sequence([
        json(token),
        json(
          { error: { status: reason, message: "private@example.test" } },
          status,
        ),
      ]),
    );
    assert.equal(result.status, expected);
    assert.match(result.errorCode, /^google_ingest_http_\d{3}$/);
    assert.ok(!JSON.stringify(result).includes("private@example.test"));
  }
  const requests = [];
  assert.equal(
    (
      await google(
        sequence(
          [
            json(
              { error: "invalid_grant", error_description: "sensitive" },
              400,
            ),
          ],
          requests,
        ),
      )
    ).status,
    "failed",
  );
  assert.equal(requests.length, 1);
  assert.equal(
    (
      await google(
        sequence([
          json({ ...token, access_token: "test-token\r\nInjected: header" }),
        ]),
      )
    ).status,
    "retry",
  );
  assert.equal(
    (
      await google(
        sequence([
          json(token),
          json({
            requestId: remoteId,
            fieldWarnings: [{ description: "sensitive" }],
          }),
        ]),
      )
    ).status,
    "failed",
  );
});

test("Google polls a known request without sending another event or retaining click identity", async () => {
  const requests = [];
  const result = await google(
    sequence([json(token), json(googleStatus())], requests),
    {
      ...baseJob,
      remoteRequestId: remoteId,
      userData: {},
    },
  );
  assert.deepEqual(result, { status: "accepted" });
  assert.equal(requests.length, 2);
  assert.equal(
    requests[1].url,
    `https://datamanager.googleapis.com/v1/requestStatus:retrieve?requestId=${remoteId}`,
  );
  assert.equal(requests[1].options.method, "GET");
  assert.equal(requests[1].options.body, undefined);
  assert.ok(!JSON.stringify(requests).includes("test-click-id"));
});

test("Google requires completed diagnostics for the correct destination and one event", async () => {
  const job = { ...baseJob, remoteRequestId: remoteId, userData: {} };
  const good = googleStatus().requestStatusPerDestination[0];
  for (const [payload, expected] of [
    [
      googleStatus({
        requestStatus: "PROCESSING",
        eventsIngestionStatus: undefined,
      }),
      "processing",
    ],
    [googleStatus({ requestStatus: "FAILED" }), "failed"],
    [googleStatus({ requestStatus: "PARTIAL_SUCCESS" }), "failed"],
    [googleStatus({ requestStatus: "REQUEST_STATUS_UNKNOWN" }), "retry"],
    [googleStatus({ eventsIngestionStatus: { recordCount: "0" } }), "retry"],
    [googleStatus({ eventsIngestionStatus: { recordCount: "2" } }), "retry"],
    [
      googleStatus({
        warningInfo: {
          warningCounts: [{ reason: "WARNING", recordCount: "1" }],
        },
      }),
      "failed",
    ],
    [
      googleStatus({
        errorInfo: { errorCounts: [{ reason: "ERROR", recordCount: "1" }] },
      }),
      "failed",
    ],
    [googleStatus({ errorInfo: { errorCounts: [{}] } }), "failed"],
    [
      googleStatus({
        destination: { ...good.destination, productDestinationId: "1" },
      }),
      "retry",
    ],
    [
      googleStatus({
        destination: {
          ...good.destination,
          operatingAccount: {
            accountType: "GOOGLE_ADS",
            accountId: "1111111111",
          },
        },
      }),
      "retry",
    ],
    [{ requestStatusPerDestination: [good, good] }, "retry"],
    [{}, "retry"],
  ]) {
    const result = await google(sequence([json(token), json(payload)]), job);
    assert.equal(result.status, expected, JSON.stringify(payload));
    if (expected === "processing") assert.equal(result.requestId, remoteId);
  }
  assert.equal(
    (
      await google(
        sequence([
          json(token),
          json(
            googleStatus({
              destination: {
                ...good.destination,
                loginAccount: {
                  accountType: "GOOGLE_ADS",
                  accountId: configs.google.customerId,
                },
              },
            }),
          ),
        ]),
        job,
      )
    ).status,
    "accepted",
  );
});

test("oversized, empty and malformed successful responses never become accepted", async () => {
  for (const response of [
    new Response("x".repeat(65_537)),
    new Response(null),
    new Response("[]"),
    new Response("invalid"),
  ])
    assert.equal(
      (await google(sequence([json(token), response]))).status,
      "retry",
    );
});

test("withdrawal during OAuth cancels Google ingestion and diagnostics before transmission", async () => {
  for (const job of [
    googleJob,
    { ...baseJob, userData: {}, remoteRequestId: remoteId },
  ]) {
    let resolveOAuth;
    let startedOAuth;
    const oauthStarted = new Promise((resolve) => {
      startedOAuth = resolve;
    });
    const oauthResponse = new Promise((resolve) => {
      resolveOAuth = resolve;
    });
    const requests = [];
    let allowed = true;
    let checks = 0;
    const pending = deliverProvider({
      provider: "google",
      settings: configs.google,
      job,
      canSend: async () => {
        checks++;
        return allowed;
      },
      fetcher: async (url, options) => {
        requests.push({ url, options });
        assert.equal(
          url,
          "https://oauth2.googleapis.com/token",
          "Revoked job must never reach the data endpoint",
        );
        startedOAuth();
        return oauthResponse;
      },
    });
    await oauthStarted;
    assert.equal(checks, 0);
    allowed = false;
    resolveOAuth(json(token));
    assert.deepEqual(await pending, { status: "cancelled" });
    assert.equal(checks, 1);
    assert.equal(requests.length, 1);
  }
});
