import { randomUUID } from "node:crypto";

export const OFFER_VERSION = "datagrid-early-20-v1";
export const CONSENT_VERSION = "waitlist-2026-10-02-v1";
const STATE_LOCK = 78335111;
const MAX_SENDS_PER_24_HOURS = 300;
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

class BudgetExceeded extends Error {}

function instant(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new TypeError("Invalid timestamp");
  return date;
}

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new TypeError("Invalid limit");
  }
  return result;
}

function boundedString(value, name, maximum = 128) {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > maximum ||
    value.includes("\0")
  ) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

/**
 * The pool is an injected pg-compatible Pool. No connections or schema changes
 * occur at module import. Run schema.sql explicitly before enabling the form.
 */
export function createWaitlistStore(pool) {
  async function transaction(callback, { lockState = false } = {}) {
    const client = await pool.connect();
    let releaseError;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '5s'");
      await client.query("SET LOCAL lock_timeout = '2s'");
      if (lockState)
        await client.query("SELECT pg_advisory_xact_lock($1)", [STATE_LOCK]);
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // Preserve the original failure without logging queries or credentials.
        releaseError = rollbackError;
      }
      throw error;
    } finally {
      client.release(releaseError);
    }
  }

  async function reserveBudget(client, { kind, date, scope, limit }) {
    const result = await client.query(
      `INSERT INTO waitlist_budgets (kind, bucket_date, scope_key, used)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (kind, bucket_date, scope_key) DO UPDATE
       SET used = waitlist_budgets.used + 1
       WHERE waitlist_budgets.used < $4
       RETURNING used`,
      [kind, date, scope, limit],
    );
    if (!result.rowCount) throw new BudgetExceeded();
  }

  async function reserveDaily(client, { kind, now, ipKey, total, perIp }) {
    const date = now.toISOString().slice(0, 10);
    // Always lock global before IP, keeping concurrent transaction order stable.
    await reserveBudget(client, { kind, date, scope: "global", limit: total });
    await reserveBudget(client, {
      kind,
      date,
      scope: `ip:${ipKey}`,
      limit: perIp,
    });
  }

  async function consumeAttempt({ ipKey, now, limits = {} }) {
    boundedString(ipKey, "IP key");
    const timestamp = instant(now);
    const total = positiveInteger(limits.dailyAttempts, 1000);
    const perIp = positiveInteger(limits.dailyAttemptsPerIp, 30);
    try {
      await transaction((client) =>
        reserveDaily(client, {
          kind: "attempt",
          now: timestamp,
          ipKey,
          total,
          perIp,
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof BudgetExceeded) return false;
      throw error;
    }
  }

  async function register({
    email,
    emailKey,
    ipKey,
    unsubscribeHash,
    unsubscribeToken,
    offerVersion = OFFER_VERSION,
    now,
    limits = {},
  }) {
    boundedString(email, "email", 254);
    boundedString(emailKey, "email key");
    boundedString(ipKey, "IP key");
    boundedString(unsubscribeHash, "unsubscribe hash");
    boundedString(unsubscribeToken, "unsubscribe token", 512);
    if (offerVersion !== OFFER_VERSION)
      throw new TypeError("Invalid offer version");
    const timestamp = instant(now);
    const total = positiveInteger(limits.dailyRegistrations, 100);
    const perIp = positiveInteger(limits.dailyRegistrationsPerIp, 5);
    const maxQueueDepth = positiveInteger(limits.maxQueueDepth, 400);
    try {
      return await transaction(
        async (client) => {
          const existing = await client.query(
            "SELECT id FROM waitlist_subscribers WHERE email_key = $1 OR email = $2",
            [emailKey, email],
          );
          if (existing.rowCount)
            return { status: "existing", subscriberId: existing.rows[0].id };

          const queue = await client.query(
            "SELECT count(*)::integer AS count FROM waitlist_outbox WHERE state IN ('pending', 'sending')",
          );
          if (queue.rows[0].count + 2 > maxQueueDepth)
            throw new BudgetExceeded();
          await reserveDaily(client, {
            kind: "registration",
            now: timestamp,
            ipKey,
            total,
            perIp,
          });

          const subscriberId = randomUUID();
          await client.query(
            `INSERT INTO waitlist_subscribers
           (id, email, email_key, unsubscribe_hash, offer_version, consent_version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              subscriberId,
              email,
              emailKey,
              unsubscribeHash,
              offerVersion,
              CONSENT_VERSION,
              timestamp,
            ],
          );
          await client.query(
            `INSERT INTO waitlist_outbox (id, subscriber_id, kind, payload, created_at, next_attempt_at)
           VALUES ($1, $2, 'welcome', $3::jsonb, $4, $4),
                  ($5, $2, 'admin', '{}'::jsonb, $4, $4)`,
            [
              randomUUID(),
              subscriberId,
              JSON.stringify({ unsubscribeToken }),
              timestamp,
              randomUUID(),
            ],
          );
          return { status: "registered", subscriberId };
        },
        { lockState: true },
      );
    } catch (error) {
      if (error instanceof BudgetExceeded) return { status: "limited" };
      throw error;
    }
  }

  async function claimOutbox({
    now,
    dailyLimit = MAX_SENDS_PER_24_HOURS,
    maxPendingAgeMs = 7 * DAY_MS,
    leaseMs = 120_000,
  } = {}) {
    const timestamp = instant(now);
    const limit = positiveInteger(
      dailyLimit,
      MAX_SENDS_PER_24_HOURS,
      MAX_SENDS_PER_24_HOURS,
    );
    positiveInteger(maxPendingAgeMs, 7 * DAY_MS);
    positiveInteger(leaseMs, 120_000);
    return transaction(
      async (client) => {
        // An expired lease could mean SMTP accepted the message. Never requeue it.
        await client.query(
          `UPDATE waitlist_outbox SET state = 'uncertain', claim_token = NULL, lease_until = NULL,
         completed_at = $1, last_error = 'lease_expired', payload = '{}'::jsonb
         WHERE state = 'sending' AND lease_until <= $1`,
          [timestamp],
        );
        await client.query(
          `UPDATE waitlist_outbox SET state = 'expired', completed_at = $1,
         last_error = 'queue_expired', payload = '{}'::jsonb
         WHERE state = 'pending' AND created_at < $2`,
          [timestamp, new Date(timestamp.getTime() - maxPendingAgeMs)],
        );
        await client.query(
          `UPDATE waitlist_outbox AS job SET state = 'cancelled', completed_at = $1,
         payload = '{}'::jsonb FROM waitlist_subscribers AS subscriber
         WHERE job.subscriber_id = subscriber.id AND job.kind = 'welcome'
         AND job.state = 'pending' AND subscriber.suppressed_at IS NOT NULL`,
          [timestamp],
        );

        const budget = await client.query(
          "SELECT count(*)::integer AS count FROM waitlist_send_attempts WHERE reserved_at > $1",
          [new Date(timestamp.getTime() - DAY_MS)],
        );
        if (budget.rows[0].count >= limit) return null;
        const candidates = await client.query(
          `SELECT job.*, subscriber.email, subscriber.offer_version
         FROM waitlist_outbox AS job JOIN waitlist_subscribers AS subscriber
         ON subscriber.id = job.subscriber_id
         WHERE job.state = 'pending' AND job.next_attempt_at <= $1 AND job.attempts < $2
         AND (job.kind = 'admin' OR subscriber.suppressed_at IS NULL)
         ORDER BY job.created_at, job.id LIMIT 1 FOR UPDATE OF job`,
          [timestamp, MAX_ATTEMPTS],
        );
        if (!candidates.rowCount) return null;
        const job = candidates.rows[0];
        const claimToken = randomUUID();
        await client.query(
          `INSERT INTO waitlist_send_attempts (id, outbox_id, attempt_number, reserved_at)
         VALUES ($1, $2, $3, $4)`,
          [claimToken, job.id, job.attempts + 1, timestamp],
        );
        await client.query(
          `UPDATE waitlist_outbox SET state = 'sending', attempts = attempts + 1,
         claim_token = $2, lease_until = $3 WHERE id = $1`,
          [job.id, claimToken, new Date(timestamp.getTime() + leaseMs)],
        );
        return {
          id: job.id,
          claimToken,
          kind: job.kind,
          email: job.email,
          unsubscribeToken:
            job.kind === "welcome" ? job.payload.unsubscribeToken : undefined,
          offerVersion: job.offer_version,
          createdAt: job.created_at,
          attempts: job.attempts + 1,
        };
      },
      { lockState: true },
    );
  }

  async function completeOutbox({ id, claimToken, now }) {
    const timestamp = instant(now);
    return transaction(async (client) => {
      const result = await client.query(
        `UPDATE waitlist_outbox SET state = 'sent', claim_token = NULL, lease_until = NULL,
         completed_at = $3, payload = '{}'::jsonb, last_error = NULL
         WHERE id = $1 AND claim_token = $2 AND state = 'sending'`,
        [id, claimToken, timestamp],
      );
      return result.rowCount === 1;
    });
  }

  async function failOutbox({
    id,
    claimToken,
    now,
    retryable = false,
    ambiguous = true,
    errorCode = "smtp_failure",
  }) {
    const timestamp = instant(now);
    if (
      typeof errorCode !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(errorCode)
    ) {
      throw new TypeError("Invalid error code");
    }
    return transaction(async (client) => {
      const jobs = await client.query(
        `SELECT attempts FROM waitlist_outbox
         WHERE id = $1 AND claim_token = $2 AND state = 'sending' FOR UPDATE`,
        [id, claimToken],
      );
      if (!jobs.rowCount) return false;
      const { attempts } = jobs.rows[0];
      const state =
        ambiguous !== false
          ? "uncertain"
          : retryable === true && attempts < MAX_ATTEMPTS
            ? "pending"
            : "failed";
      const nextAttempt = new Date(
        timestamp.getTime() + 60_000 * 2 ** (attempts - 1),
      );
      await client.query(
        `UPDATE waitlist_outbox SET state = $3, claim_token = NULL, lease_until = NULL,
         completed_at = $4, next_attempt_at = $5, last_error = $6,
         payload = CASE WHEN $3 = 'pending' THEN payload ELSE '{}'::jsonb END
         WHERE id = $1 AND claim_token = $2`,
        [
          id,
          claimToken,
          state,
          state === "pending" ? null : timestamp,
          nextAttempt,
          errorCode,
        ],
      );
      return true;
    });
  }

  async function unsubscribe({ unsubscribeHash, now }) {
    boundedString(unsubscribeHash, "unsubscribe hash");
    const timestamp = instant(now);
    return transaction(
      async (client) => {
        const result = await client.query(
          `UPDATE waitlist_subscribers SET suppressed_at = COALESCE(suppressed_at, $2)
         WHERE unsubscribe_hash = $1 RETURNING id`,
          [unsubscribeHash, timestamp],
        );
        if (!result.rowCount) return false;
        await client.query(
          `UPDATE waitlist_outbox SET state = 'cancelled', completed_at = $2, payload = '{}'::jsonb
         WHERE subscriber_id = $1 AND kind = 'welcome' AND state = 'pending'`,
          [result.rows[0].id, timestamp],
        );
        return true;
      },
      { lockState: true },
    );
  }

  async function maintain({ now } = {}) {
    const timestamp = instant(now);
    return transaction(async (client) => {
      // Budget dates are UTC buckets. Evaluate their age from UTC midnight,
      // independent of the database session's timezone.
      const budgets = await client.query(
        "DELETE FROM waitlist_budgets WHERE (bucket_date::timestamp AT TIME ZONE 'UTC') < $1",
        [new Date(timestamp.getTime() - 7 * DAY_MS)],
      );
      const attempts = await client.query(
        "DELETE FROM waitlist_send_attempts WHERE reserved_at < $1",
        [new Date(timestamp.getTime() - 8 * DAY_MS)],
      );
      return {
        budgetsDeleted: budgets.rowCount,
        sendAttemptsDeleted: attempts.rowCount,
      };
    });
  }

  return {
    consumeAttempt,
    register,
    claimOutbox,
    completeOutbox,
    failOutbox,
    unsubscribe,
    maintain,
  };
}
