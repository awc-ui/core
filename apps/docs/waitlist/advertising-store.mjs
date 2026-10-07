import { randomUUID } from "node:crypto";
import {
  AD_CONSENT_VERSION,
  AD_EVENT_MAX_AGE_MS,
  AD_MAX_ATTEMPTS,
  AD_CONSENT_RETENTION_MS,
} from "./advertising.mjs";

const DAY_MS = 86400_000;
function instant(now) {
  const value = new Date(now);
  if (!Number.isFinite(value.getTime()))
    throw new TypeError("Invalid timestamp");
  return value;
}
function checkKey(key) {
  if (!/^[a-f0-9]{64}$/.test(key ?? ""))
    throw new TypeError("Invalid consent key");
}

// Called ONLY after the fresh subscriber insert, within its transaction. An
// existing/revoked consent capability cannot be silently re-enabled by a POST.
export async function queueAdvertising(
  client,
  { subscriberId, measurement, now },
) {
  checkKey(measurement.consentKey);
  if (measurement.version !== AD_CONSENT_VERSION)
    throw new TypeError("Invalid consent version");
  await client.query(
    `INSERT INTO advertising_consents (consent_key, consent_version, created_at, granted_at, expires_at)
     VALUES ($1, $2, $3, $3, $4) ON CONFLICT (consent_key) DO NOTHING`,
    [
      measurement.consentKey,
      measurement.version,
      now,
      new Date(now.getTime() + 90 * DAY_MS),
    ],
  );
  const consent = await client.query(
    "SELECT revoked_at, expires_at FROM advertising_consents WHERE consent_key = $1 FOR UPDATE",
    [measurement.consentKey],
  );
  if (consent.rows[0].revoked_at || new Date(consent.rows[0].expires_at) <= now)
    return;
  const destinations = {
    ...(measurement.userData ? { meta: measurement.userData } : {}),
    ...(measurement.providers ?? {}),
  };
  for (const [provider, userData] of Object.entries(destinations)) {
    if (!["meta", "reddit", "google"].includes(provider))
      throw new TypeError("Invalid provider");
    await client.query(
      `INSERT INTO waitlist_advertising_outbox
       (id, subscriber_id, consent_key, provider, user_data, created_at, next_attempt_at, destination_key)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6, $7)`,
      [
        randomUUID(),
        subscriberId,
        measurement.consentKey,
        provider,
        JSON.stringify(userData),
        now,
        measurement.destinations?.[provider] ?? null,
      ],
    );
  }
}

export function createAdvertisingStore(transaction) {
  async function withdrawAdvertising({ consentKey, now }) {
    checkKey(consentKey);
    const timestamp = instant(now);
    return transaction(async (client) => {
      // A tombstone also handles withdrawal racing ahead of an in-flight signup.
      await client.query(
        `INSERT INTO advertising_consents (consent_key, consent_version, created_at, revoked_at, expires_at)
         VALUES ($1, $2, $3, $3, $4) ON CONFLICT (consent_key) DO UPDATE
         SET revoked_at = COALESCE(advertising_consents.revoked_at, $3),
         expires_at = CASE WHEN advertising_consents.granted_at IS NOT NULL
           THEN GREATEST(advertising_consents.expires_at,
             COALESCE(advertising_consents.revoked_at, $3) + $5::bigint * INTERVAL '1 millisecond')
           ELSE advertising_consents.expires_at END`,
        [
          consentKey,
          AD_CONSENT_VERSION,
          timestamp,
          new Date(timestamp.getTime() + DAY_MS),
          AD_CONSENT_RETENTION_MS,
        ],
      );
      await client.query(
        `UPDATE waitlist_advertising_outbox SET state = 'cancelled', user_data = '{}'::jsonb,
         completed_at = $2, claim_token = NULL, lease_until = NULL
         WHERE consent_key = $1 AND state IN ('pending', 'sending', 'processing')`,
        [consentKey, timestamp],
      );
    });
  }

  async function expire(client, now) {
    await client.query(
      `UPDATE waitlist_advertising_outbox SET state = 'expired', user_data = '{}'::jsonb,
       completed_at = $1, claim_token = NULL, lease_until = NULL
       WHERE state IN ('pending', 'sending', 'processing') AND (created_at <= $2 OR ((remote_request_id IS NULL AND attempts >= $3) OR poll_attempts >= 48) AND (lease_until IS NULL OR lease_until <= $1))`,
      [now, new Date(now.getTime() - AD_EVENT_MAX_AGE_MS), AD_MAX_ATTEMPTS],
    );
    // Network ambiguity is safe to retry with the SAME id, unlike SMTP. Never
    // replay outside the bounded 24-hour event window.
    await client.query(
      `UPDATE waitlist_advertising_outbox SET state = 'pending', claim_token = NULL, lease_until = NULL
       WHERE state = 'sending' AND lease_until <= $1
       AND ((remote_request_id IS NULL AND attempts < $2) OR (remote_request_id IS NOT NULL AND poll_attempts < 48))`,
      [now, AD_MAX_ATTEMPTS],
    );
  }

  async function claimAdvertising({ now, providers = ["meta"] }) {
    if (
      !Array.isArray(providers) ||
      !providers.length ||
      providers.some(
        (provider) => !["meta", "reddit", "google"].includes(provider),
      )
    )
      throw new TypeError("Invalid providers");
    const timestamp = instant(now);
    return transaction(async (client) => {
      await expire(client, timestamp);
      const jobs = await client.query(
        `SELECT job.* FROM waitlist_advertising_outbox AS job
         JOIN advertising_consents AS consent ON consent.consent_key = job.consent_key
         WHERE job.state IN ('pending', 'processing') AND job.next_attempt_at <= $1
         AND ((job.remote_request_id IS NULL AND job.attempts < $2) OR (job.remote_request_id IS NOT NULL AND job.poll_attempts < 48))
         AND job.provider = ANY($3::text[])
         AND consent.revoked_at IS NULL AND consent.expires_at > $1
         ORDER BY job.created_at, job.id LIMIT 1 FOR UPDATE OF job SKIP LOCKED`,
        [timestamp, AD_MAX_ATTEMPTS, providers],
      );
      if (!jobs.rowCount) return null;
      const job = jobs.rows[0];
      const claimToken = randomUUID();
      await client.query(
        `UPDATE waitlist_advertising_outbox SET state = 'sending',
         attempts = attempts + CASE WHEN remote_request_id IS NULL THEN 1 ELSE 0 END,
         poll_attempts = poll_attempts + CASE WHEN remote_request_id IS NOT NULL THEN 1 ELSE 0 END,
         claim_token = $2, lease_until = $3 WHERE id = $1`,
        [job.id, claimToken, new Date(timestamp.getTime() + 60_000)],
      );
      return {
        id: job.id,
        claimToken,
        userData: job.user_data,
        provider: job.provider,
        remoteRequestId: job.remote_request_id,
        destinationKey: job.destination_key,
        createdAt: job.created_at,
      };
    });
  }

  async function advertisingCanSend({ id, claimToken, now }) {
    const timestamp = instant(now);
    return transaction(async (client) => {
      const result = await client.query(
        `SELECT job.id FROM waitlist_advertising_outbox AS job
         JOIN advertising_consents AS consent ON consent.consent_key = job.consent_key
         WHERE job.id = $1 AND job.claim_token = $2 AND job.state = 'sending'
         AND job.lease_until > $3 AND job.created_at > $4
         AND consent.revoked_at IS NULL AND consent.expires_at > $3`,
        [
          id,
          claimToken,
          timestamp,
          new Date(timestamp.getTime() - AD_EVENT_MAX_AGE_MS),
        ],
      );
      return result.rowCount === 1;
    });
  }

  async function deferAdvertising({ id, claimToken, requestId, now }) {
    if (
      typeof requestId !== "string" ||
      requestId.length < 1 ||
      requestId.length > 512 ||
      /[\r\n\0]/.test(requestId)
    )
      throw new TypeError("Invalid provider request ID");
    const timestamp = instant(now);
    return transaction(async (client) => {
      // Google acknowledges ingestion before processing. Save its opaque request
      // ID and verify diagnostics later, rather than reporting a conversion now.
      const result = await client.query(
        `UPDATE waitlist_advertising_outbox SET state = 'processing', remote_request_id = $3, user_data = '{}'::jsonb,
         next_attempt_at = $4::timestamptz + LEAST(3600000, 1800000 * POWER(1.3, poll_attempts)) * INTERVAL '1 millisecond',
         claim_token = NULL, lease_until = NULL
         WHERE id = $1 AND claim_token = $2 AND state = 'sending' AND provider = 'google'`,
        [id, claimToken, requestId, timestamp],
      );
      return result.rowCount === 1;
    });
  }

  async function completeAdvertising({ id, claimToken, now }) {
    return transaction(async (client) => {
      const result = await client.query(
        `UPDATE waitlist_advertising_outbox SET state = 'sent', user_data = '{}'::jsonb,
         completed_at = $3, claim_token = NULL, lease_until = NULL, last_error = NULL
         WHERE id = $1 AND claim_token = $2 AND state = 'sending'`,
        [id, claimToken, instant(now)],
      );
      return result.rowCount === 1;
    });
  }

  async function failAdvertising({
    id,
    claimToken,
    now,
    retryable,
    errorCode,
  }) {
    const timestamp = instant(now);
    if (!/^[a-z0-9_]{1,64}$/.test(errorCode ?? ""))
      throw new TypeError("Invalid error code");
    return transaction(async (client) => {
      const result = await client.query(
        "SELECT attempts, poll_attempts, remote_request_id, created_at FROM waitlist_advertising_outbox WHERE id = $1 AND claim_token = $2 AND state = 'sending' FOR UPDATE",
        [id, claimToken],
      );
      if (!result.rowCount) return false;
      const job = result.rows[0];
      const nextAttempt = new Date(
        timestamp.getTime() +
          (job.remote_request_id
            ? Math.min(3600000, 1800000 * 1.3 ** job.poll_attempts)
            : 60_000 * 2 ** (job.attempts - 1)),
      );
      const retry =
        retryable === true &&
        (job.remote_request_id
          ? job.poll_attempts < 48
          : job.attempts < AD_MAX_ATTEMPTS) &&
        nextAttempt.getTime() <
          new Date(job.created_at).getTime() + AD_EVENT_MAX_AGE_MS;
      await client.query(
        `UPDATE waitlist_advertising_outbox SET state = $3, completed_at = $4,
         next_attempt_at = $5, claim_token = NULL, lease_until = NULL, last_error = $6,
         user_data = CASE WHEN $3 = 'pending' THEN user_data ELSE '{}'::jsonb END
         WHERE id = $1 AND claim_token = $2`,
        [
          id,
          claimToken,
          retry ? "pending" : "failed",
          retry ? null : timestamp,
          nextAttempt,
          errorCode,
        ],
      );
      return true;
    });
  }

  async function maintainAdvertising({ now }) {
    const timestamp = instant(now);
    return transaction(async (client) => {
      await expire(client, timestamp);
      await client.query(
        "DELETE FROM waitlist_advertising_outbox WHERE completed_at < $1",
        [new Date(timestamp.getTime() - 30 * DAY_MS)],
      );
      await client.query(
        `DELETE FROM advertising_consents AS consent WHERE expires_at < $1
         AND NOT EXISTS (SELECT 1 FROM waitlist_advertising_outbox AS job WHERE job.consent_key = consent.consent_key)`,
        [timestamp],
      );
    });
  }
  return {
    withdrawAdvertising,
    claimAdvertising,
    advertisingCanSend,
    completeAdvertising,
    deferAdvertising,
    failAdvertising,
    maintainAdvertising,
  };
}
