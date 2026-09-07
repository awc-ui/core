/** Demo-only authentication adapter. No network calls, durable accounts or real MFA.
 * Passwords for newly created demo accounts are salted and hashed in memory.
 * Replace the adapter with a server identity provider for production access control.
 */
export const DEMO_EMAIL = "operator@metropulse.demo";
export const DEMO_PASSWORD = "MetroDemo!2026";
export const DEMO_CODE = "246810";
export const DEMO_RECOVERY = "METR2026";
export class DemoAuth {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.accounts = new Map();
    this.challenge = null;
    this.generation = 0;
    this.demoRecoveryUsed = false;
  }
  async digest(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    return Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  issue(user, enroll = false) {
    this.challenge = {
      user,
      enroll,
      expires: this.now() + 300000,
      attempts: 0,
      lockedUntil: 0,
      id: ++this.generation,
    };
    return { ...this.challenge };
  }
  async signup({ name, email, password, confirm }) {
    const generation = ++this.generation;
    this.challenge = null;
    email = email.trim().toLowerCase();
    name = name.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error("Enter your name and a valid email address.");
    if (password.length < 12)
      throw Error("Use at least 12 characters for your demo password.");
    if (password !== confirm) throw Error("Your passwords do not match.");
    if (email === DEMO_EMAIL || this.accounts.has(email))
      throw Error("This demo account already exists. Sign in instead.");
    const salt = crypto.randomUUID();
    const digest = await this.digest(password, salt);
    if (generation !== this.generation)
      throw Error("This request was canceled.");
    const user = { name, email };
    this.accounts.set(email, { user, salt, digest, recoveryUsed: false });
    return this.issue(user, true);
  }
  async signin(email, password) {
    const generation = ++this.generation;
    this.challenge = null;
    email = email.trim().toLowerCase();
    const account = this.accounts.get(email);
    const valid =
      email === DEMO_EMAIL
        ? password === DEMO_PASSWORD
        : account &&
          (await this.digest(password, account.salt)) === account.digest;
    if (generation !== this.generation)
      throw Error("This request was canceled.");
    if (!valid)
      throw Error(
        "Email or password is incorrect. Use the demo account or create an account for this session.",
      );
    return this.issue(
      email === DEMO_EMAIL ? { name: "Alex Morgan", email } : account.user,
    );
  }
  verify(code, recovery = false) {
    const c = this.challenge;
    if (!c) throw Error("Sign in again to request a verification code.");
    if (this.now() >= c.expires) {
      this.cancel();
      throw Error("Your code has expired. Sign in again.");
    }
    if (c.lockedUntil > this.now())
      throw Error(
        `Too many attempts. Try again in ${Math.ceil((c.lockedUntil - this.now()) / 1000)} seconds.`,
      );
    if (c.lockedUntil) {
      c.attempts = 0;
      c.lockedUntil = 0;
    }
    const account = this.accounts.get(c.user.email);
    const used =
      c.user.email === DEMO_EMAIL
        ? this.demoRecoveryUsed
        : account?.recoveryUsed;
    const normalized = String(code).replace(/[\s-]/g, "").toUpperCase();
    if (
      recovery ? normalized !== DEMO_RECOVERY || used : normalized !== DEMO_CODE
    ) {
      c.attempts++;
      if (c.attempts >= 5) {
        c.lockedUntil = this.now() + 30000;
        throw Error("Too many attempts. Wait 30 seconds, then try again.");
      }
      throw Error(
        recovery
          ? "That recovery code is invalid or already used."
          : "That code is incorrect. Use the six-digit demo code shown below.",
      );
    }
    if (recovery) {
      if (account) account.recoveryUsed = true;
      else this.demoRecoveryUsed = true;
    }
    const user = c.user;
    this.cancel();
    return user;
  }
  resend() {
    if (!this.challenge) throw Error("Sign in again to request a code.");
    if (this.challenge.lockedUntil > this.now())
      throw Error("Wait for the attempt limit to reset.");
    this.challenge.expires = this.now() + 300000;
    return this.challenge.expires;
  }
  cancel() {
    this.generation++;
    this.challenge = null;
  }
}
