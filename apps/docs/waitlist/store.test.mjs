import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJoinHandler } from "./handler.mjs";
import { ORIGIN } from "./config.mjs";
import {
  createWaitlistStore,
  OFFER_VERSION,
  CONSENT_VERSION,
} from "./store.mjs";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const later = (milliseconds) => new Date(NOW.getTime() + milliseconds);
const joinConfig = {
  joinEnabled: true,
  turnstileSecret: "test-secret",
  hmacSecret: "test-only-hmac-secret".repeat(2),
  closesAt: null,
};
const joinRequest = (token, email = "early@example.test") =>
  new Request(`${ORIGIN}/api/waitlist`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ email, token, website: "" }),
  });
const signup = (suffix = "one", overrides = {}) => ({
  email: `${suffix}@example.test`,
  emailKey: `email-${suffix}`,
  ipKey: `ip-${suffix}`,
  unsubscribeHash: `hash-${suffix}`,
  unsubscribeToken: `token-${suffix}`,
  offerVersion: OFFER_VERSION,
  now: NOW,
  ...overrides,
});

test("rejects unsafe configuration before opening a connection", async () => {
  const store = createWaitlistStore({
    connect() {
      throw new Error("Unexpected connection");
    },
  });
  await assert.rejects(store.claimOutbox({ dailyLimit: 301 }), /Invalid limit/);
  await assert.rejects(
    store.consumeAttempt({ ipKey: "", now: NOW }),
    /Invalid IP key/,
  );
  await assert.rejects(
    store.register(signup("one", { offerVersion: "different" })),
    /Invalid offer version/,
  );
  await assert.rejects(
    store.register(signup("one", { unsubscribeToken: undefined })),
    /Invalid unsubscribe token/,
  );
  await assert.rejects(
    store.claimOutbox({ now: "not a date" }),
    /Invalid timestamp/,
  );
  await assert.rejects(
    store.failOutbox({ errorCode: "message containing private data" }),
    /Invalid error code/,
  );
});

// This suite uses independent PostgreSQL connections and real transaction locks.
// It deliberately does not substitute an in-memory mock for concurrency tests.
test(
  "PostgreSQL waitlist transactions",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to run SQL and concurrency integration tests",
    timeout: 60_000,
  },
  async (t) => {
    const { Pool } = await import("pg");
    const schema = `waitlist_test_${randomBytes(8).toString("hex")}`;
    const admin = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 1,
    });
    let pool;
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        options: `-c search_path=${schema}`,
        max: 12,
      });
      await pool.query(
        await readFile(
          new URL(
            "../netlify/database/migrations/202610020001_create_waitlist.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const store = createWaitlistStore(pool);
      const reset = () =>
        pool.query(
          "TRUNCATE waitlist_send_attempts, waitlist_outbox, waitlist_subscribers, waitlist_budgets",
        );
      const count = async (table) =>
        Number(
          (await pool.query(`SELECT count(*) AS count FROM ${table}`)).rows[0]
            .count,
        );

      await t.test(
        "concurrent duplicates create exactly one subscriber and two jobs",
        async () => {
          await reset();
          const results = await Promise.all(
            Array.from({ length: 20 }, (_, index) =>
              store.register(
                signup("same", {
                  unsubscribeHash: `hash-${index}`,
                  unsubscribeToken: `token-${index}`,
                }),
              ),
            ),
          );
          assert.equal(
            results.filter((result) => result.status === "registered").length,
            1,
          );
          assert.equal(
            results.filter((result) => result.status === "existing").length,
            19,
          );
          assert.equal(await count("waitlist_subscribers"), 1);
          assert.equal(await count("waitlist_outbox"), 2);
          const jobs = (
            await pool.query(
              "SELECT kind, payload FROM waitlist_outbox ORDER BY kind",
            )
          ).rows;
          assert.deepEqual(jobs[0], { kind: "admin", payload: {} });
          assert.equal(typeof jobs[1].payload.unsubscribeToken, "string");
          const budgets = (
            await pool.query("SELECT used FROM waitlist_budgets")
          ).rows;
          assert.ok(budgets.every((row) => row.used === 1));
        },
      );

      await t.test(
        "registration and attempt budgets cannot overspend concurrently",
        async () => {
          await reset();
          const limits = { dailyRegistrations: 3, dailyRegistrationsPerIp: 2 };
          const results = await Promise.all(
            Array.from({ length: 12 }, (_, index) =>
              store.register(signup(String(index), { limits })),
            ),
          );
          assert.equal(
            results.filter((result) => result.status === "registered").length,
            3,
          );
          assert.equal(await count("waitlist_outbox"), 6);

          await reset();
          const sameIp = await Promise.all(
            Array.from({ length: 10 }, (_, index) =>
              store.register(
                signup(String(index), {
                  ipKey: "same",
                  limits: { ...limits, dailyRegistrations: 20 },
                }),
              ),
            ),
          );
          assert.equal(
            sameIp.filter((result) => result.status === "registered").length,
            2,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT used FROM waitlist_budgets WHERE scope_key = 'global'",
              )
            ).rows[0].used,
            2,
          );

          await reset();
          const attempts = await Promise.all(
            Array.from({ length: 20 }, () =>
              store.consumeAttempt({
                ipKey: "same",
                now: NOW,
                limits: { dailyAttemptsPerIp: 3 },
              }),
            ),
          );
          assert.equal(attempts.filter(Boolean).length, 3);
          assert.deepEqual(
            (
              await pool.query(
                "SELECT kind, scope_key, used FROM waitlist_budgets",
              )
            ).rows,
            [{ kind: "attempt", scope_key: "ip:same", used: 3 }],
          );
        },
      );

      await t.test(
        "unverified requests cannot exhaust capacity for verified registrations",
        async () => {
          await reset();
          let verificationCalls = 0;
          let registrations = 0;
          const handler = createJoinHandler({
            config: joinConfig,
            store,
            clock: () => NOW,
            verify: async ({ token }) => {
              verificationCalls += 1;
              return token === "valid-token";
            },
            // Only observe scheduling; this test never invokes an SMTP sender.
            onRegistered: () => {
              registrations += 1;
            },
          });
          for (const token of ["", null, "x".repeat(2049)]) {
            assert.equal(
              (
                await handler(joinRequest(token), { ip: "203.0.113.1" })
              ).status,
              400,
            );
          }
          assert.equal(verificationCalls, 0);
          assert.equal(await count("waitlist_budgets"), 0);

          // The old shared attempt cap was exhausted by 1,000 failures from
          // only 34 IPs, each remaining within its own 30-attempt allowance.
          for (let first = 0; first < 1000; first += 34) {
            const responses = await Promise.all(
              Array.from({ length: Math.min(34, 1000 - first) }, (_, index) =>
                handler(joinRequest("invalid-token"), {
                  ip: `203.0.113.${index + 1}`,
                }),
              ),
            );
            assert.ok(responses.every((response) => response.status === 403));
          }
          assert.equal(verificationCalls, 1000);
          assert.equal(registrations, 0);
          assert.equal(await count("waitlist_subscribers"), 0);
          assert.equal(await count("waitlist_outbox"), 0);
          assert.equal(await count("waitlist_send_attempts"), 0);
          const budgets = (
            await pool.query(
              "SELECT kind, scope_key, used FROM waitlist_budgets",
            )
          ).rows;
          assert.equal(budgets.length, 34);
          assert.ok(
            budgets.every(
              (row) =>
                row.kind === "attempt" &&
                row.scope_key.startsWith("ip:") &&
                row.used <= 30,
            ),
          );
          assert.equal(
            budgets.reduce((sum, row) => sum + row.used, 0),
            1000,
          );

          // The abusive IP remains blocked before another verification call.
          assert.equal(
            (
              await handler(joinRequest("invalid-token"), {
                ip: "203.0.113.1",
              })
            ).status,
            429,
          );
          assert.equal(verificationCalls, 1000);

          const accepted = await handler(joinRequest("valid-token"), {
            ip: "198.51.100.50",
          });
          assert.equal(accepted.status, 200);
          assert.deepEqual(await accepted.json(), { ok: true });
          assert.equal(verificationCalls, 1001);
          assert.equal(registrations, 1);
          assert.equal(await count("waitlist_subscribers"), 1);
          assert.equal(await count("waitlist_outbox"), 2);
          assert.equal(await count("waitlist_send_attempts"), 0);
          assert.deepEqual(
            (
              await pool.query(
                "SELECT kind, state FROM waitlist_outbox ORDER BY kind",
              )
            ).rows,
            [
              { kind: "admin", state: "pending" },
              { kind: "welcome", state: "pending" },
            ],
          );
          const registrationBudgets = (
            await pool.query(
              "SELECT scope_key, used FROM waitlist_budgets WHERE kind = 'registration'",
            )
          ).rows;
          assert.equal(registrationBudgets.length, 2);
          assert.ok(registrationBudgets.every((row) => row.used === 1));
          assert.ok(
            registrationBudgets.some((row) => row.scope_key === "global"),
          );
        },
      );

      await t.test(
        "an exhausted legacy global attempt row cannot block a verified signup",
        async () => {
          await reset();
          await pool.query(
            `INSERT INTO waitlist_budgets (kind, bucket_date, scope_key, used)
             VALUES ('attempt', $1, 'global', 1000)`,
            [NOW.toISOString().slice(0, 10)],
          );
          const handler = createJoinHandler({
            config: joinConfig,
            store,
            clock: () => NOW,
            verify: async () => true,
          });
          assert.equal(
            (
              await handler(joinRequest("valid-token"), {
                ip: "198.51.100.50",
              })
            ).status,
            200,
          );
          assert.equal(await count("waitlist_subscribers"), 1);
          assert.equal(await count("waitlist_outbox"), 2);
          assert.equal(await count("waitlist_send_attempts"), 0);
          assert.equal(
            (
              await pool.query(
                "SELECT used FROM waitlist_budgets WHERE kind = 'attempt' AND scope_key = 'global'",
              )
            ).rows[0].used,
            1000,
          );
        },
      );

      await t.test(
        "failure after budget reservation rolls back subscriber, jobs and budgets",
        async () => {
          await reset();
          await store.register(signup("first"));
          await assert.rejects(
            store.register(signup("second", { unsubscribeHash: "hash-first" })),
            { code: "23505" },
          );
          assert.equal(await count("waitlist_subscribers"), 1);
          assert.equal(await count("waitlist_outbox"), 2);
          const budgets = (
            await pool.query("SELECT scope_key, used FROM waitlist_budgets")
          ).rows;
          assert.equal(budgets.length, 2);
          assert.ok(budgets.every((row) => row.used === 1));
          assert.ok(budgets.every((row) => row.scope_key !== "ip:ip-second"));
        },
      );

      await t.test(
        "queue limit includes both email jobs and reservations roll back on IP denial",
        async () => {
          await reset();
          const limits = { maxQueueDepth: 3 };
          assert.equal(
            (await store.register(signup("first", { limits }))).status,
            "registered",
          );
          assert.equal(
            (await store.register(signup("second", { limits }))).status,
            "limited",
          );
          assert.equal(await count("waitlist_outbox"), 2);
          assert.ok(
            (await pool.query("SELECT used FROM waitlist_budgets")).rows.every(
              (row) => row.used === 1,
            ),
          );
        },
      );

      await t.test(
        "concurrent claims are exclusive and SMTP reservations use a rolling 24 hours",
        async () => {
          await reset();
          for (let index = 0; index < 3; index++)
            await store.register(signup(String(index)));
          const results = await Promise.all(
            Array.from({ length: 10 }, () =>
              store.claimOutbox({ now: NOW, dailyLimit: 3 }),
            ),
          );
          const jobs = results.filter(Boolean);
          assert.equal(jobs.length, 3);
          assert.equal(new Set(jobs.map((job) => job.id)).size, 3);
          assert.equal(await count("waitlist_send_attempts"), 3);
          for (const job of jobs)
            assert.equal(
              await store.completeOutbox({ ...job, now: NOW }),
              true,
            );
          assert.equal(
            await store.claimOutbox({
              now: later(24 * 60 * 60 * 1000 - 1),
              dailyLimit: 3,
            }),
            null,
          );
          assert.ok(
            await store.claimOutbox({
              now: later(24 * 60 * 60 * 1000),
              dailyLimit: 3,
            }),
          );
          assert.equal(await count("waitlist_send_attempts"), 4);
        },
      );

      await t.test(
        "only explicit pre-acceptance failures retry, at most three times",
        async () => {
          await reset();
          await store.register(signup());
          let job = await store.claimOutbox({ now: NOW });
          const other = await store.claimOutbox({ now: NOW });
          await store.completeOutbox({ ...other, now: NOW });
          assert.equal(
            await store.failOutbox({
              ...job,
              now: NOW,
              retryable: true,
              ambiguous: false,
            }),
            true,
          );
          assert.equal(await store.claimOutbox({ now: later(59_999) }), null);
          const next = await store.claimOutbox({ now: later(60_000) });
          assert.equal(next.id, job.id);
          assert.equal(next.attempts, 2);
          assert.equal(
            await store.completeOutbox({ ...job, now: later(60_000) }),
            false,
          );
          job = next;
          await store.failOutbox({
            ...job,
            now: later(60_000),
            retryable: true,
            ambiguous: false,
          });
          job = await store.claimOutbox({ now: later(180_000) });
          assert.equal(job.attempts, 3);
          await store.failOutbox({
            ...job,
            now: later(180_000),
            retryable: true,
            ambiguous: false,
          });
          assert.equal(
            await store.claimOutbox({ now: later(1_000_000) }),
            null,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT state FROM waitlist_outbox WHERE id = $1",
                [job.id],
              )
            ).rows[0].state,
            "failed",
          );
          assert.equal(await count("waitlist_send_attempts"), 4);
        },
      );

      await t.test(
        "ambiguous SMTP failures and abandoned leases never retry automatically",
        async () => {
          await reset();
          await store.register(signup());
          const ambiguous = await store.claimOutbox({ now: NOW });
          const abandoned = await store.claimOutbox({ now: NOW });
          await store.failOutbox({ ...ambiguous, now: NOW, retryable: true });
          assert.equal(await store.claimOutbox({ now: later(120_000) }), null);
          assert.equal(
            await store.completeOutbox({ ...abandoned, now: later(120_000) }),
            false,
          );
          assert.ok(
            (
              await pool.query("SELECT state, payload FROM waitlist_outbox")
            ).rows.every(
              (row) =>
                row.state === "uncertain" &&
                Object.keys(row.payload).length === 0,
            ),
          );
          assert.equal(await count("waitlist_send_attempts"), 2);
        },
      );

      await t.test(
        "unsubscribe is idempotent and HMAC rotation never resets suppression",
        async () => {
          await reset();
          await store.register(signup());
          assert.equal(
            await store.unsubscribe({ unsubscribeHash: "hash-one", now: NOW }),
            true,
          );
          assert.equal(
            await store.unsubscribe({
              unsubscribeHash: "hash-one",
              now: later(1),
            }),
            true,
          );
          assert.equal(
            await store.unsubscribe({ unsubscribeHash: "unknown", now: NOW }),
            false,
          );
          assert.equal(
            (
              await store.register(
                signup("one", {
                  emailKey: "rotated-email-key",
                  unsubscribeHash: "replacement",
                  unsubscribeToken: "replacement",
                }),
              )
            ).status,
            "existing",
          );
          const subscriber = (
            await pool.query(
              "SELECT unsubscribe_hash, suppressed_at, consent_version FROM waitlist_subscribers",
            )
          ).rows[0];
          assert.equal(subscriber.unsubscribe_hash, "hash-one");
          assert.equal(subscriber.consent_version, CONSENT_VERSION);
          assert.equal(
            subscriber.suppressed_at.toISOString(),
            NOW.toISOString(),
          );
          const job = await store.claimOutbox({ now: NOW });
          assert.equal(job.kind, "admin");
          assert.equal(job.unsubscribeToken, undefined);
          await store.completeOutbox({ ...job, now: NOW });
          assert.equal(await store.claimOutbox({ now: NOW }), null);
          const welcome = (
            await pool.query(
              "SELECT state, payload FROM waitlist_outbox WHERE kind = 'welcome'",
            )
          ).rows[0];
          assert.deepEqual(welcome, { state: "cancelled", payload: {} });
        },
      );

      await t.test(
        "maintenance removes only expired budgets and old SMTP reservations",
        async () => {
          await reset();
          await store.register(signup("first"));
          await store.register(signup("second"));
          const claims = [];
          for (let index = 0; index < 4; index++)
            claims.push(await store.claimOutbox({ now: NOW }));
          const dayMs = 86400_000;
          await pool.query(
            "UPDATE waitlist_send_attempts SET reserved_at = $2 WHERE id = $1",
            [claims[0].claimToken, later(-8 * dayMs - 1)],
          );
          await pool.query(
            "UPDATE waitlist_send_attempts SET reserved_at = $2 WHERE id = $1",
            [claims[1].claimToken, later(-8 * dayMs)],
          );
          await pool.query(
            "UPDATE waitlist_send_attempts SET reserved_at = $2 WHERE id = $1",
            [claims[2].claimToken, later(-dayMs + 1)],
          );
          for (const daysAgo of [8, 7, 6]) {
            await pool.query(
              "INSERT INTO waitlist_budgets (kind, bucket_date, scope_key, used) VALUES ('attempt', $1, $2, 1)",
              [
                later(-daysAgo * dayMs)
                  .toISOString()
                  .slice(0, 10),
                `ip:retention-${daysAgo}`,
              ],
            );
          }
          const subscribers = (
            await pool.query("SELECT * FROM waitlist_subscribers ORDER BY id")
          ).rows;
          const outbox = (
            await pool.query("SELECT * FROM waitlist_outbox ORDER BY id")
          ).rows;
          assert.deepEqual(await store.maintain({ now: NOW }), {
            budgetsDeleted: 2,
            sendAttemptsDeleted: 1,
          });
          assert.deepEqual(
            (await pool.query("SELECT * FROM waitlist_subscribers ORDER BY id"))
              .rows,
            subscribers,
          );
          assert.deepEqual(
            (await pool.query("SELECT * FROM waitlist_outbox ORDER BY id"))
              .rows,
            outbox,
          );
          const retainedAttempts = (
            await pool.query(
              "SELECT id FROM waitlist_send_attempts ORDER BY id",
            )
          ).rows.map((row) => row.id);
          assert.deepEqual(
            retainedAttempts,
            claims
              .slice(1)
              .map((claim) => claim.claimToken)
              .sort(),
          );
          const budgetKeys = (
            await pool.query(
              "SELECT scope_key FROM waitlist_budgets ORDER BY scope_key",
            )
          ).rows.map((row) => row.scope_key);
          assert.deepEqual(budgetKeys, [
            "global",
            "ip:ip-first",
            "ip:ip-second",
            "ip:retention-6",
          ]);
          assert.deepEqual(await store.maintain({ now: NOW }), {
            budgetsDeleted: 0,
            sendAttemptsDeleted: 0,
          });
        },
      );

      await t.test(
        "old queued mail expires without spending SMTP budget",
        async () => {
          await reset();
          await store.register(signup());
          assert.equal(
            await store.claimOutbox({
              now: later(1001),
              maxPendingAgeMs: 1000,
            }),
            null,
          );
          assert.ok(
            (
              await pool.query("SELECT state, payload FROM waitlist_outbox")
            ).rows.every(
              (row) =>
                row.state === "expired" &&
                Object.keys(row.payload).length === 0,
            ),
          );
          assert.equal(await count("waitlist_send_attempts"), 0);
        },
      );
    } finally {
      if (pool) await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
