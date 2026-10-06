import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { test } from "node:test";

// Test the installed transitive package, including the pnpm patch, through a
// real consumer instead of relying on pnpm's internal store directory.
const rootRequire = createRequire(new URL("../package.json", import.meta.url));
const stylelintRequire = createRequire(rootRequire.resolve("stylelint"));
const micromatchRequire = createRequire(stylelintRequire.resolve("micromatch"));
const bracesPath = micromatchRequire.resolve("braces");
const braces = micromatchRequire("braces");

// Backport: https://github.com/micromatch/braces/pull/78. This limits recursive
// AST traversal; it does not make arbitrary regexes safe or limit expansion
// cardinality. As with existing maxLength validation, callers must handle
// SyntaxError for inputs outside the supported bounds.
const isDepthError = (error) => error instanceof SyntaxError && /nesting depth exceeds/.test(error.message);

function nestedAst(depth) {
  let ast = { type: "root", nodes: [] };
  for (let index = 0; index < depth; index++) {
    ast = { type: "root", nodes: [ast] };
  }
  return ast;
}

for (const operation of ["parse", "compile", "expand", "stringify", "default"]) {
  test(`deeply nested strings are rejected before stack exhaustion: ${operation}`, () => {
    const source = `
      const braces = require(process.argv[1]);
      const operation = process.argv[2];
      const pattern = "{".repeat(4000) + "x" + "}".repeat(4000);
      try {
        (operation === "default" ? braces : braces[operation])(pattern);
        process.stdout.write(JSON.stringify({ name: "accepted", message: "" }));
      } catch (error) {
        process.stdout.write(JSON.stringify({ name: error.name, message: error.message }));
      }
    `;
    const result = JSON.parse(execFileSync(process.execPath, ["--stack_size=512", "-e", source, bracesPath, operation], {
      encoding: "utf8",
      timeout: 5000,
    }));
    assert.equal(result.name, "SyntaxError");
    assert.match(result.message, /nesting depth exceeds/);
  });
}

for (const operation of ["compile", "expand", "stringify"]) {
  test(`caller-provided ASTs cannot bypass the depth limit: ${operation}`, () => {
    assert.throws(() => braces[operation](nestedAst(4000)), isDepthError);
  });

  test(`AST traversal accepts depth 100 and rejects 101: ${operation}`, () => {
    assert.deepEqual(braces[operation](nestedAst(100)), operation === "expand" ? [] : "");
    assert.throws(() => braces[operation](nestedAst(101)), isDepthError);
  });
}

test("parser bounds braces, parentheses and mixed nesting", () => {
  for (const [open, close] of [["{", "}"], ["(", ")"], ["{(", ")}"]]) {
    assert.throws(() => braces.parse(open.repeat(101) + "x" + close.repeat(101)), isDepthError);
  }
  assert.doesNotThrow(() => braces.parse("{".repeat(100) + "x" + "}".repeat(100)));
});

test("valid nested patterns remain supported", () => {
  const pattern = "{".repeat(99) + "x" + "}".repeat(99);
  assert.equal(braces.stringify(pattern), pattern);
  assert.deepEqual(braces.expand(pattern), [pattern]);
});

test("ordinary globs, ranges, escaping and parsed ASTs retain their output", () => {
  assert.equal(braces.compile("app/{reading,writing}/**/*.{js,jsx}"), "app/(reading|writing)/**/*.(js|jsx)");
  assert.deepEqual(braces.expand("page-{1..3}.js"), ["page-1.js", "page-2.js", "page-3.js"]);
  assert.deepEqual(braces.expand("a\\{b,c\\}"), ["a{b,c}"]);
  assert.equal(braces.compile(braces.parse("a/{b,c}/d")), "a/(b|c)/d");
});
