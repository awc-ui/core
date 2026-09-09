import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTH_SESSION_KEY, CHALLENGE_TTL_MS, DEMO_CREDENTIALS, MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS, SESSION_TTL_MS, challengeStatus, checkCode,
  createChallenge, createSession, readSession, renewChallenge,
  validateLogin, validateSignup,
} from "./auth.js";

const now = 1_000_000;
const profile = { name: "Alex Morgan", email: "alex@roam.demo" };
const signup = { ...profile, password: "RoamDemo!2026", confirm: "RoamDemo!2026" };
const storage = (value) => ({ getItem(key) { assert.equal(key, AUTH_SESSION_KEY); return JSON.stringify(value); } });

test("login accepts only the explicit demo account and normalizes the email", () => {
  assert.equal(validateLogin({ email: " ALEX@ROAM.DEMO ", password: DEMO_CREDENTIALS.password }), true);
  assert.equal(validateLogin({ email: "someone@roam.demo", password: DEMO_CREDENTIALS.password }), false);
  assert.equal(validateLogin({ email: profile.email, password: "" }), false);
  assert.equal(validateLogin({ email: profile.email, password: `${DEMO_CREDENTIALS.password} ` }), false);
});

test("signup enforces useful name, email, password and matching confirmation boundaries", () => {
  assert.equal(validateSignup(signup), null);
  assert.equal(validateSignup({ ...signup, name: "A" }).field, "name");
  assert.equal(validateSignup({ ...signup, name: "A".repeat(81) }).field, "name");
  assert.equal(validateSignup({ ...signup, name: "A".repeat(80) }), null);
  for (const email of ["bad", "a@@b.com", "a@b", "a b@c.com", `${"x".repeat(250)}@test.demo`]) {
    assert.equal(validateSignup({ ...signup, email }).field, "email");
  }
  assert.equal(validateSignup({ ...signup, password: "a".repeat(11), confirm: "a".repeat(11) }).field, "password");
  assert.equal(validateSignup({ ...signup, password: "a".repeat(129), confirm: "a".repeat(129) }).field, "password");
  assert.equal(validateSignup({ ...signup, password: "a".repeat(128), confirm: "a".repeat(128) }), null);
  assert.equal(validateSignup({ ...signup, confirm: "does not match" }).field, "confirm");
});

test("a challenge keeps only profile metadata, never passwords or codes", () => {
  const challenge = createChallenge({ ...signup, code: "secret" }, now);
  assert.deepEqual(Object.keys(challenge).sort(), ["attempts", "email", "expiresAt", "issuedAt", "name", "resendAt"]);
  assert.equal(challenge.expiresAt, now + CHALLENGE_TTL_MS);
  assert.equal(challenge.resendAt, now + RESEND_COOLDOWN_MS);
  assert.equal(challengeStatus(challenge, now).ok, true);
});

test("verification is valid just before expiry, never at expiry or after a clock rollback", () => {
  const challenge = createChallenge(profile, now);
  assert.equal(checkCode(challenge, DEMO_CREDENTIALS.code, now + CHALLENGE_TTL_MS - 1).ok, true);
  assert.equal(checkCode(challenge, DEMO_CREDENTIALS.code, now + CHALLENGE_TTL_MS).reason, "expired");
  assert.equal(checkCode(challenge, DEMO_CREDENTIALS.code, now - 1).reason, "expired");
  assert.equal(checkCode(challenge, DEMO_CREDENTIALS.code, NaN).ok, false);
  assert.equal(challengeStatus({ ...challenge, expiresAt: now + CHALLENGE_TTL_MS + 1 }, now).reason, "expired");
});

test("five incorrect attempts lock the challenge even when followed by the correct code", () => {
  const challenge = createChallenge(profile, now);
  for (let index = 1; index <= MAX_ATTEMPTS; index += 1) {
    const result = checkCode(challenge, "000000", now);
    challenge.attempts = result.nextAttempts;
    assert.equal(challenge.attempts, index);
    assert.equal(result.reason, index < MAX_ATTEMPTS ? "incorrect" : "locked");
  }
  assert.equal(checkCode(challenge, DEMO_CREDENTIALS.code, now).reason, "locked");
  assert.equal(renewChallenge(challenge, now + RESEND_COOLDOWN_MS).reason, "locked");
});

test("resend observes the 30-second boundary and preserves the attempt budget", () => {
  const challenge = { ...createChallenge(profile, now), attempts: 4 };
  assert.equal(renewChallenge(challenge, now + RESEND_COOLDOWN_MS - 1).reason, "cooldown");
  const renewed = renewChallenge(challenge, now + RESEND_COOLDOWN_MS);
  assert.equal(renewed.ok, true);
  assert.equal(renewed.challenge.attempts, 4);
  assert.equal(renewed.challenge.expiresAt, now + RESEND_COOLDOWN_MS + CHALLENGE_TTL_MS);
  assert.equal(checkCode(renewed.challenge, "000000", now + RESEND_COOLDOWN_MS).reason, "locked");
  assert.equal(renewChallenge(challenge, now + CHALLENGE_TTL_MS).reason, "expired");
});

test("malformed or missing challenges never verify", () => {
  for (const challenge of [null, {}, { ...createChallenge(profile, now), attempts: -1 }, { ...createChallenge(profile, now), attempts: 0.5 }, { ...createChallenge(profile, now), issuedAt: NaN }]) {
    assert.equal(checkCode(challenge, DEMO_CREDENTIALS.code, now).ok, false);
  }
});

test("the session stores only the verified profile and ends precisely after eight hours", () => {
  const session = createSession({ ...signup, password: "never store", attempts: 3 }, now);
  assert.equal("password" in session, false);
  assert.equal("attempts" in session, false);
  assert.equal(session.demo, true);
  assert.equal(session.mfaVerified, true);
  assert.equal(readSession(storage(session), now + SESSION_TTL_MS - 1).name, profile.name);
  assert.equal(readSession(storage(session), now + SESSION_TTL_MS), null);
  assert.equal(readSession(storage(session), now - 1), null);
  assert.equal(readSession(storage(session), NaN), null);
});

test("session restore rejects tampering and strips unrecognized fields", () => {
  const session = createSession(profile, now);
  for (const patch of [{ demo: false }, { mfaVerified: false }, { name: "" }, { name: "x".repeat(81) }, { email: "invalid" }, { expiresAt: session.expiresAt + 1 }, { verifiedAt: "1000000" }]) {
    assert.equal(readSession(storage({ ...session, ...patch }), now), null);
  }
  const restored = readSession(storage({ ...session, password: "unexpected", isAdmin: true }), now);
  assert.equal("password" in restored, false);
  assert.equal("isAdmin" in restored, false);
  assert.equal(restored.role, "Traveler");
  assert.equal(readSession({ getItem() { return "bad JSON"; } }, now), null);
});
