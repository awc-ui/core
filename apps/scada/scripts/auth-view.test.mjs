import test from "node:test";
import assert from "node:assert/strict";
import { authView } from "../src/auth.js";
test("login, signup and MFA render with the shared brand contract and one main landmark", () => {
  for (const route of ["login", "signup", "mfa"]) {
    const html = authView(
      route,
      { pending: { name: "Ada <Operator>" } },
      () => "<div>Sentinel</div>",
    );
    assert.ok(html.includes("<div>Sentinel</div>"));
    assert.equal((html.match(/<main /g) || []).length, 1);
    assert.equal((html.match(/<\/main>/g) || []).length, 1);
    assert.ok(html.includes('name="code"') || html.includes('name="email"'));
    assert.ok(!html.includes("Ada <Operator>"));
  }
});
