import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_CODE,
  RECOVERY_CODE,
  CHALLENGE_TTL_MS,
  validateSignup,
  validateLogin,
  createChallenge,
  challengeStatus,
  checkChallenge,
  clearAuth,
  authView,
  handleAuthAction,
} from "../src/auth.js";

const valid = {
  name: "  Sample Clinician  ",
  email: "care@example.test",
  password: "TwelveChars!42",
  confirm: "TwelveChars!42",
  consent: "yes",
};
const now = 1_000_000;
const pending = () => createChallenge(valid, now);

test("signup rejects missing name, invalid email, short passwords, mismatch, and absent consent", () => {
  assert.equal(validateSignup(valid), null);
  for (const [field, value] of [
    ["name", "  "],
    ["email", "bad email"],
    ["password", "short"],
    ["confirm", "not the same"],
    ["consent", false],
  ]) {
    assert.equal(validateSignup({ ...valid, [field]: value }).field, field);
  }
  assert.equal(
    validateSignup({ ...valid, name: "a".repeat(81) }).field,
    "name",
  );
});

test("login requires exact sample password with a normalized sample email", () => {
  assert.equal(
    validateLogin({
      email: ` ${DEMO_EMAIL.toUpperCase()} `,
      password: DEMO_PASSWORD,
    }),
    true,
  );
  assert.equal(validateLogin({ email: DEMO_EMAIL, password: "wrong" }), false);
  assert.equal(
    validateLogin({ email: "other@example.test", password: DEMO_PASSWORD }),
    false,
  );
});

test("challenge does not contain the submitted password and has a five-minute lifetime", () => {
  assert.deepEqual(pending(), {
    name: "Sample Clinician",
    email: valid.email,
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
    attempts: 0,
  });
  assert.equal("password" in pending(), false);
  assert.equal("confirm" in pending(), false);
});

test("correct code needs a live sign-in challenge and expires exactly at its boundary", () => {
  assert.equal(checkChallenge(null, DEMO_CODE, { now }).reason, "missing");
  assert.equal(checkChallenge(pending(), DEMO_CODE, { now }).ok, true);
  assert.equal(
    checkChallenge(pending(), DEMO_CODE, { now: now + CHALLENGE_TTL_MS - 1 })
      .ok,
    true,
  );
  assert.equal(
    checkChallenge(pending(), DEMO_CODE, { now: now + CHALLENGE_TTL_MS })
      .reason,
    "expired",
  );
  assert.equal(
    challengeStatus({ ...pending(), attempts: NaN }, now).reason,
    "missing",
  );
  assert.equal(
    challengeStatus({ ...pending(), expiresAt: Infinity }, now).reason,
    "missing",
  );
  assert.equal(
    challengeStatus(
      { ...pending(), expiresAt: now + CHALLENGE_TTL_MS + 1 },
      now,
    ).reason,
    "expired",
  );
});

test("five failures exhaust the shared verification budget and reject a later correct code", () => {
  const challenge = pending();
  for (let i = 1; i <= 5; i += 1) {
    const result = checkChallenge(challenge, "000000", {
      now,
      recovery: i % 2 === 0,
    });
    assert.equal(result.ok, false);
    assert.equal(result.nextAttempts, i);
    assert.equal(challenge.attempts, i - 1, "pure check must not mutate");
    challenge.attempts = result.nextAttempts;
    assert.equal(result.reason, i === 5 ? "locked" : "incorrect");
  }
  assert.equal(checkChallenge(challenge, DEMO_CODE, { now }).reason, "locked");
  assert.equal(
    checkChallenge(challenge, RECOVERY_CODE, { now, recovery: true }).reason,
    "locked",
  );
});

test("recovery is one-use and never bypasses sign-in, expiration, or attempt limits", () => {
  assert.equal(
    checkChallenge(pending(), RECOVERY_CODE, { now, recovery: true }).ok,
    true,
  );
  assert.equal(
    checkChallenge(pending(), RECOVERY_CODE, {
      now,
      recovery: true,
      recoveryUsed: true,
    }).reason,
    "used",
  );
  assert.equal(
    checkChallenge(null, RECOVERY_CODE, { now, recovery: true }).reason,
    "missing",
  );
  assert.equal(
    checkChallenge(pending(), RECOVERY_CODE, {
      now: now + CHALLENGE_TTL_MS,
      recovery: true,
    }).reason,
    "expired",
  );
  const state = {
    auth: { pending: pending(), profile: valid, recoveryUsed: true },
  };
  clearAuth(state);
  assert.equal(state.auth.pending, null);
  assert.equal(state.auth.profile, null);
  assert.equal(state.auth.recoveryUsed, true);
});

test("direct MFA and recovery routes render the sign-in form when no challenge exists", () => {
  for (const route of ["mfa", "recovery"]) {
    const html = authView(route, {});
    assert.match(html, /id="login-form"/);
    assert.doesNotMatch(html, /id="(?:mfa|recovery)-form"/);
  }
});

test("profile content is escaped in verification markup", () => {
  const html = authView("mfa", {
    auth: {
      pending: createChallenge({
        name: "<img src=x onerror=alert(1)>",
        email: "x@example.test",
      }),
    },
  });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test("back and signout clear pending access while switching verification methods preserves it", () => {
  for (const action of [
    "auth-back",
    "auth-login",
    "auth-signout",
    "auth-signup",
  ]) {
    const state = { auth: { pending: createChallenge(valid), profile: valid } };
    let destination;
    assert.equal(
      handleAuthAction(action, state, {
        navigate: (route) => {
          destination = route;
        },
        toast() {},
      }),
      true,
    );
    assert.equal(state.auth.pending, null);
    assert.equal(destination, action === "auth-signup" ? "signup" : "login");
  }
  const state = { auth: { pending: createChallenge(valid) } };
  let destination;
  handleAuthAction("auth-recovery", state, {
    navigate: (route) => {
      destination = route;
    },
    toast() {},
  });
  assert.equal(destination, "recovery");
  assert.ok(state.auth.pending);
});
