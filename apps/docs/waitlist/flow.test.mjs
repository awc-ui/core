import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJoinHandler, hashToken } from "./handler.mjs";
import { createUnsubscribeHandler } from "./unsubscribe.mjs";
import { createWaitlistStore } from "./store.mjs";
import { deliverOne } from "./mail.mjs";
import { OFFER_VERSION, ORIGIN, OWNER, SENDER } from "./config.mjs";

test(
  "signup, durable jobs, local SMTP, unsubscribe and duplicate signup work together",
  {
    skip:
      !process.env.TEST_DATABASE_URL &&
      "Set TEST_DATABASE_URL to run the PostgreSQL + local SMTP flow",
    timeout: 60_000,
  },
  async () => {
    const [{ Pool }, { SMTPServer }, { default: nodemailer }] =
      await Promise.all([
        import("pg"),
        import("smtp-server"),
        import("nodemailer"),
      ]);
    const schema = `waitlist_flow_${randomBytes(8).toString("hex")}`;
    const admin = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      max: 1,
    });
    let schemaCreated = false;
    let pool;
    let server;
    let transport;
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      schemaCreated = true;
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
      const now = new Date("2026-10-02T12:00:00Z");
      const received = [];

      // This server binds only to loopback and captures messages; it never relays.
      server = new SMTPServer({
        authOptional: true,
        disabledCommands: ["STARTTLS"],
        onData(stream, session, done) {
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.once("error", done);
          stream.once("end", () => {
            received.push({
              sender: session.envelope.mailFrom.address,
              recipients: session.envelope.rcptTo.map(
                (recipient) => recipient.address,
              ),
              raw: Buffer.concat(chunks).toString("utf8"),
            });
            done();
          });
        },
      });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      transport = nodemailer.createTransport({
        host: "127.0.0.1",
        port: server.server.address().port,
        secure: false,
        ignoreTLS: true,
        connectionTimeout: 2000,
        greetingTimeout: 2000,
        socketTimeout: 3000,
      });

      const verifiedTokens = new Set();
      const join = createJoinHandler({
        config: {
          joinEnabled: true,
          turnstileSecret: "test-only-turnstile-secret",
          hmacSecret: "test-only-hmac-secret-with-32-bytes",
          closesAt: now.getTime() + 86400_000,
        },
        store,
        clock: () => now,
        verify: async ({ token, ip, secret }) => {
          assert.equal(ip, "192.0.2.10");
          assert.equal(secret, "test-only-turnstile-secret");
          assert.match(token, /^test-challenge-\d+$/);
          assert.equal(verifiedTokens.has(token), false);
          verifiedTokens.add(token);
          return true;
        },
      });
      const email = "waitlist+flow@example.test";
      const requestFor = (index) =>
        new Request(`${ORIGIN}/api/waitlist`, {
          method: "POST",
          headers: { Origin: ORIGIN, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: index % 2 ? " Waitlist+Flow@Example.TEST " : email,
            token: `test-challenge-${index}`,
            website: "",
          }),
        });

      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          join(requestFor(index), { ip: "192.0.2.10" }),
        ),
      );
      assert.ok(responses.every((response) => response.status === 200));
      for (const response of responses)
        assert.deepEqual(await response.json(), { ok: true });
      assert.equal(verifiedTokens.size, 20);
      const subscribers = (
        await pool.query("SELECT * FROM waitlist_subscribers")
      ).rows;
      assert.equal(subscribers.length, 1);
      assert.equal(subscribers[0].email, email);
      assert.equal(subscribers[0].offer_version, OFFER_VERSION);
      assert.equal(subscribers[0].suppressed_at, null);
      const jobs = (
        await pool.query(
          "SELECT kind, state FROM waitlist_outbox ORDER BY kind",
        )
      ).rows;
      assert.deepEqual(jobs, [
        { kind: "admin", state: "pending" },
        { kind: "welcome", state: "pending" },
      ]);

      for (let index = 0; index < 2; index++) {
        assert.deepEqual(
          await deliverOne({ store, transport, clock: () => now }),
          { status: "accepted" },
        );
      }
      assert.deepEqual(
        await deliverOne({ store, transport, clock: () => now }),
        { status: "idle" },
      );
      assert.equal(received.length, 2);
      assert.ok(received.every((message) => message.sender === SENDER));
      assert.deepEqual(
        received.flatMap((message) => message.recipients).sort(),
        [email, OWNER].sort(),
      );
      const welcome = received.find((message) =>
        message.recipients.includes(email),
      );
      const ownerMail = received.find((message) =>
        message.recipients.includes(OWNER),
      );
      const unfoldedHeaders = welcome.raw
        .split(/\r?\n\r?\n/, 1)[0]
        .replace(/\r?\n[ \t]+/g, " ");
      const token =
        /List-Unsubscribe:\s*<https:\/\/awc-ui\.dev\/api\/waitlist\/unsubscribe\?token=([A-Za-z0-9_-]{43})>/i.exec(
          unfoldedHeaders,
        )?.[1];
      assert.ok(
        token,
        "The delivered welcome must contain a usable unsubscribe token",
      );
      assert.equal(hashToken(token), subscribers[0].unsubscribe_hash);
      assert.ok(!ownerMail.raw.includes(token));
      assert.ok(
        (
          await pool.query("SELECT state, payload FROM waitlist_outbox")
        ).rows.every(
          (job) =>
            job.state === "sent" && Object.keys(job.payload).length === 0,
        ),
      );

      const unsubscribe = createUnsubscribeHandler({ store, clock: () => now });
      const confirmation = await unsubscribe(
        new Request(`${ORIGIN}/api/waitlist/unsubscribe?token=${token}`),
      );
      assert.equal(confirmation.status, 200);
      assert.match(await confirmation.text(), /method="post"/);
      assert.equal(
        (await pool.query("SELECT suppressed_at FROM waitlist_subscribers"))
          .rows[0].suppressed_at,
        null,
      );
      const result = await unsubscribe(
        new Request(`${ORIGIN}/api/waitlist/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
        }),
      );
      assert.equal(result.status, 200);
      assert.equal(
        (
          await pool.query("SELECT suppressed_at FROM waitlist_subscribers")
        ).rows[0].suppressed_at.toISOString(),
        now.toISOString(),
      );

      const duplicate = await join(requestFor(20), { ip: "192.0.2.10" });
      assert.equal(duplicate.status, 200);
      assert.deepEqual(await duplicate.json(), { ok: true });
      const retained = (await pool.query("SELECT * FROM waitlist_subscribers"))
        .rows;
      assert.equal(retained.length, 1);
      assert.equal(
        retained[0].unsubscribe_hash,
        subscribers[0].unsubscribe_hash,
      );
      assert.equal(retained[0].offer_version, OFFER_VERSION);
      assert.equal(retained[0].suppressed_at.toISOString(), now.toISOString());
      assert.deepEqual(
        await deliverOne({ store, transport, clock: () => now }),
        { status: "idle" },
      );
      assert.equal(
        received.length,
        2,
        "A duplicate signup after unsubscribe must not send again",
      );
      assert.equal(
        Number(
          (await pool.query("SELECT count(*) AS count FROM waitlist_outbox"))
            .rows[0].count,
        ),
        2,
      );
      assert.equal(
        Number(
          (
            await pool.query(
              "SELECT count(*) AS count FROM waitlist_send_attempts",
            )
          ).rows[0].count,
        ),
        2,
      );
      const budgets = (
        await pool.query(
          "SELECT kind, used FROM waitlist_budgets WHERE scope_key = 'global' ORDER BY kind",
        )
      ).rows;
      assert.deepEqual(budgets, [
        { kind: "attempt", used: 21 },
        { kind: "registration", used: 1 },
      ]);
    } finally {
      transport?.close();
      if (server?.server.listening)
        await new Promise((resolve) => server.close(resolve));
      if (pool) await pool.end();
      if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
