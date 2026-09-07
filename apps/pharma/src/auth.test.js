import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_SESSION_KEY,
  CHALLENGE_TTL_MS,
  DEMO_CREDENTIALS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  SESSION_TTL_MS,
  challengeStatus,
  checkCode,
  createChallenge,
  createSession,
  readSession,
  renewChallenge,
  validateLogin,
  validateSignup,
} from "./auth.js";

const now = 1_800_000_000_000;
const profile = { name: "Ada Ellis", email: "ada.ellis@research.demo" };
const signup = {
  ...profile,
  password: "FictionalPass!2026",
  confirm: "FictionalPass!2026",
  consent: "yes",
};
const storage = (value) => ({
  getItem(key) {
    assert.equal(key, AUTH_SESSION_KEY);
    return value;
  },
});

test("the public demo account signs in with normalized email, while the password stays exact", () => {
  assert.equal(
    validateLogin({
      email: " ALEX.MORGAN@VELA.DEMO ",
      password: DEMO_CREDENTIALS.password,
    }),
    true,
  );
  assert.equal(
    validateLogin({
      email: DEMO_CREDENTIALS.email,
      password: DEMO_CREDENTIALS.password.toLowerCase(),
    }),
    false,
  );
  assert.equal(
    validateLogin({
      email: "other@vela.demo",
      password: DEMO_CREDENTIALS.password,
    }),
    false,
  );
  assert.equal(validateLogin({}), false);
});

test("signup accepts a complete fictional profile", () => {
  assert.equal(validateSignup(signup), null);
  assert.equal(validateSignup({ ...signup, consent: true }), null);
});

for (const [label, change, field] of [
  ["blank name", { name: "  " }, "name"],
  ["overlong name", { name: "a".repeat(81) }, "name"],
  ["invalid email", { email: "not-an-email" }, "email"],
  ["short password", { password: "short", confirm: "short" }, "password"],
  ["mismatched confirmation", { confirm: "DifferentPass!2026" }, "confirm"],
  ["missing consent", { consent: undefined }, "consent"],
])
  test(`signup identifies ${label} before starting MFA`, () => {
    assert.equal(validateSignup({ ...signup, ...change }).field, field);
  });

test("a challenge only retains normalized profile and temporary verification state", () => {
  const challenge = createChallenge(
    { ...signup, name: " Ada Ellis ", email: " ADA.ELLIS@RESEARCH.DEMO " },
    now,
  );
  assert.equal(challenge.name, "Ada Ellis");
  assert.equal(challenge.email, profile.email);
  assert.equal(challenge.expiresAt, now + CHALLENGE_TTL_MS);
  assert.equal(challenge.resendAt, now + RESEND_COOLDOWN_MS);
  assert.equal(challenge.attempts, 0);
  assert.equal("password" in challenge, false);
  assert.equal("confirm" in challenge, false);
  assert.equal("consent" in challenge, false);
});

test("MFA cannot be opened without signing in or from an invalid challenge", () => {
  for (const invalid of [
    null,
    {},
    { ...createChallenge(profile, now), attempts: -1 },
    { ...createChallenge(profile, now), issuedAt: NaN },
  ]) {
    assert.equal(challengeStatus(invalid, now).reason, "missing");
    assert.equal(checkCode(invalid, DEMO_CREDENTIALS.code, now).ok, false);
  }
});

test("verification is accepted within the challenge window, and does not mutate the challenge", () => {
  const challenge = createChallenge(profile, now);
  const original = structuredClone(challenge);
  assert.equal(checkCode(challenge, "246 810", now + 1).ok, true);
  assert.equal(
    checkCode(challenge, DEMO_CREDENTIALS.code, now + CHALLENGE_TTL_MS - 1).ok,
    true,
  );
  assert.deepEqual(challenge, original);
});

test("verification expires exactly at its deadline, and rejects clocks before issue", () => {
  const challenge = createChallenge(profile, now);
  assert.equal(
    checkCode(challenge, DEMO_CREDENTIALS.code, now + CHALLENGE_TTL_MS).reason,
    "expired",
  );
  assert.equal(
    checkCode(challenge, DEMO_CREDENTIALS.code, now - 1).reason,
    "expired",
  );
  assert.equal(
    challengeStatus(
      { ...challenge, expiresAt: now + CHALLENGE_TTL_MS + 1 },
      now,
    ).reason,
    "expired",
  );
});

test("a wrong code consumes one attempt and the fifth failure locks verification", () => {
  const challenge = createChallenge(profile, now);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = checkCode(challenge, "000000", now);
    assert.equal(result.ok, false);
    assert.equal(result.nextAttempts, attempt);
    assert.equal(
      result.reason,
      attempt < MAX_ATTEMPTS ? "incorrect" : "locked",
    );
    challenge.attempts = result.nextAttempts;
  }
  assert.equal(
    checkCode(challenge, DEMO_CREDENTIALS.code, now).reason,
    "locked",
  );
});

test("a new code cannot be requested during the cooldown", () => {
  const challenge = createChallenge(profile, now);
  assert.equal(renewChallenge(challenge, now).reason, "cooldown");
  assert.equal(
    renewChallenge(challenge, now + RESEND_COOLDOWN_MS - 1).reason,
    "cooldown",
  );
});

test("resending renews the deadline without restoring failed attempts", () => {
  const challenge = { ...createChallenge(profile, now), attempts: 4 };
  const result = renewChallenge(challenge, now + RESEND_COOLDOWN_MS);
  assert.equal(result.ok, true);
  assert.equal(result.challenge.attempts, 4);
  assert.equal(
    result.challenge.expiresAt,
    now + RESEND_COOLDOWN_MS + CHALLENGE_TTL_MS,
  );
  assert.equal(result.challenge.resendAt, now + 2 * RESEND_COOLDOWN_MS);
  assert.equal(
    checkCode(result.challenge, "000000", now + RESEND_COOLDOWN_MS).reason,
    "locked",
  );
});

test("resending does not revive an expired or locked challenge", () => {
  const challenge = createChallenge(profile, now);
  assert.equal(
    renewChallenge(challenge, now + CHALLENGE_TTL_MS).reason,
    "expired",
  );
  assert.equal(
    renewChallenge(
      { ...challenge, attempts: MAX_ATTEMPTS },
      now + RESEND_COOLDOWN_MS,
    ).reason,
    "locked",
  );
});

test("a completed session persists only the permitted display profile and verified flags", () => {
  const session = createSession(signup, now);
  assert.deepEqual(
    Object.keys(session).sort(),
    [
      "name",
      "email",
      "role",
      "demo",
      "mfaVerified",
      "verifiedAt",
      "expiresAt",
    ].sort(),
  );
  assert.equal(session.role, "Research scientist");
  assert.equal(session.demo, true);
  assert.equal(session.mfaVerified, true);
  assert.equal(session.expiresAt, now + SESSION_TTL_MS);
  assert.deepEqual(readSession(storage(JSON.stringify(session)), now), session);
});

test("unverified profiles and malformed stored records never restore access", () => {
  const session = createSession(profile, now);
  for (const value of [
    null,
    "{bad-json",
    "null",
    JSON.stringify({ ...session, mfaVerified: false }),
    JSON.stringify({ ...session, demo: false }),
    JSON.stringify({ ...session, email: null }),
    JSON.stringify({ ...session, name: "" }),
  ]) {
    assert.equal(readSession(storage(value), now), null);
  }
});

test("restored sessions expire at eight hours and reject a future verification time", () => {
  const session = createSession(profile, now);
  assert.equal(
    readSession(storage(JSON.stringify(session)), now + SESSION_TTL_MS),
    null,
  );
  assert.equal(readSession(storage(JSON.stringify(session)), now - 1), null);
  assert.equal(
    readSession(
      storage(
        JSON.stringify({ ...session, expiresAt: now + SESSION_TTL_MS + 1 }),
      ),
      now,
    ),
    null,
  );
});

test("restoring a session does not extend a shorter expiry or restore unexpected fields", () => {
  const session = {
    ...createSession(profile, now),
    expiresAt: now + 1000,
    password: "do-not-restore",
    role: "Super administrator",
  };
  const restored = readSession(storage(JSON.stringify(session)), now);
  assert.equal(restored.expiresAt, now + 1000);
  assert.equal("password" in restored, false);
  assert.equal(restored.role, "Research scientist");
});

test("storage being unavailable does not throw", () => {
  assert.equal(
    readSession(
      {
        getItem() {
          throw new Error("blocked");
        },
      },
      now,
    ),
    null,
  );
});
