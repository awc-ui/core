import test from "node:test";
import assert from "node:assert/strict";
import { SMTPServer } from "smtp-server";
import nodemailer from "nodemailer";
import { messageFor, classifySmtpError, deliverOne } from "./mail.mjs";
import { SENDER, OWNER, OFFER_VERSION } from "./config.mjs";

const job = {
  id: "1",
  claimToken: "claim",
  kind: "welcome",
  email: "test@example.com",
  unsubscribeToken: "a".repeat(43),
  offerVersion: OFFER_VERSION,
  createdAt: "2026-10-02T12:00:00Z",
};
function storeFor(value = job) {
  const events = [];
  return {
    events,
    claimOutbox: async () => {
      events.push(["claim"]);
      return value;
    },
    completeOutbox: async (value) => {
      events.push(["complete", value]);
      return true;
    },
    failOutbox: async (value) => {
      events.push(["fail", value]);
      return true;
    },
  };
}

test("message recipients and headers are fixed; welcome includes terms and a private unsubscribe link", () => {
  const welcome = messageFor(job);
  assert.equal(welcome.from.address, SENDER);
  assert.equal(welcome.to.address, job.email);
  assert.equal(welcome.disableUrlAccess, true);
  assert.equal(welcome.disableFileAccess, true);
  assert.match(welcome.text, /20% off your first annual Data Grid purchase/);
  assert.match(welcome.text, /30 days/);
  assert.match(welcome.text, /standard price/);
  assert.match(
    welcome.headers["List-Unsubscribe"],
    /https:\/\/awc-ui.dev\/api\/waitlist\/unsubscribe\?token=/,
  );
  const admin = messageFor({ ...job, kind: "admin" });
  assert.equal(admin.to, OWNER);
  assert.ok(!admin.text.includes(job.unsubscribeToken));
  assert.throws(() => messageFor({ ...job, offerVersion: "different" }));
});

test("uncertain SMTP failures do not become automatic retries", () => {
  for (const error of [
    { code: "ETIMEDOUT", command: "DATA" },
    { code: "ECONNRESET" },
    new Error("unknown"),
  ]) {
    assert.deepEqual(classifySmtpError(error), {
      retryable: false,
      ambiguous: true,
      errorCode: "smtp_uncertain",
    });
  }
  assert.equal(classifySmtpError({ responseCode: 451 }).retryable, true);
  assert.equal(classifySmtpError({ responseCode: 550 }).retryable, false);
  assert.equal(
    classifySmtpError({ code: "ECONNREFUSED", command: "CONN" }).retryable,
    true,
  );
});

test("SMTP acceptance followed by DB failure must not reset the sending lease or resend", async () => {
  const store = storeFor();
  store.completeOutbox = async () => {
    throw new Error("database down");
  };
  let sends = 0;
  await assert.rejects(
    deliverOne({
      store,
      transport: {
        sendMail: async () => {
          sends++;
          return { accepted: [job.email], rejected: [] };
        },
      },
    }),
  );
  assert.equal(sends, 1);
  assert.deepEqual(store.events, [["claim"]]);
});

test("welcome and admin delivery failures are recorded independently", async () => {
  for (const kind of ["welcome", "admin"]) {
    const store = storeFor({ ...job, kind });
    const result = await deliverOne({
      store,
      transport: {
        sendMail: async () => {
          throw Object.assign(new Error(), { responseCode: 450 });
        },
      },
    });
    assert.equal(result.status, "failed");
    assert.deepEqual(
      store.events.map((event) => event[0]),
      ["claim", "fail"],
    );
    assert.equal(store.events[1][1].ambiguous, false);
  }
});

test("real local SMTP transport receives welcome and owner mail without external delivery", async (t) => {
  const received = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onData(stream, session, done) {
      let body = "";
      stream.on("data", (chunk) => {
        body += chunk;
      });
      stream.on("end", () => {
        received.push({
          recipients: session.envelope.rcptTo.map((to) => to.address),
          body,
        });
        done();
      });
    },
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const transport = nodemailer.createTransport({
    host: "127.0.0.1",
    port: server.server.address().port,
    secure: false,
    ignoreTLS: true,
  });
  t.after(() => transport.close());
  for (const kind of ["welcome", "admin"]) {
    const store = storeFor({ ...job, kind });
    assert.equal((await deliverOne({ store, transport })).status, "accepted");
    assert.deepEqual(
      store.events.map((event) => event[0]),
      ["claim", "complete"],
    );
  }
  assert.deepEqual(
    received.map((mail) => mail.recipients),
    [[job.email], [OWNER]],
  );
  assert.match(received[0].body, /List-Unsubscribe:/);
  assert.match(received[0].body, /Message-ID: <waitlist-1@awc-ui.dev>/);
});
