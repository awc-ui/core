import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stageWaitlistMigrations } from "./stage-waitlist-migrations.mjs";

async function fixture(t) {
  const repository = await mkdtemp(join(tmpdir(), "awc-migration-test-"));
  t.after(() => rm(repository, { force: true, recursive: true }));
  const source = join(repository, "apps/docs/netlify/database/migrations");
  const destination = join(
    repository,
    "apps/docs/.netlify/internal/db/migrations",
  );
  await mkdir(source, { recursive: true });
  return { repository, source, destination };
}

test("preserves every applied production migration byte-for-byte when staging", async (t) => {
  const { repository, source, destination } = await fixture(t);
  // Recovered from Netlify's applied production history on 2026-11-25.
  // Applied migrations are immutable; append new migrations instead of editing these.
  const appliedMigrations = {
    "202610020001_create_waitlist":
      "404ac7104d32f4c3f52443aeb969bf3920faa565a7e66c7634075b71c8a3c359",
    "202610060001_advertising_measurement":
      "ea67b6bd222ad3aba682b223970891b4405e7249ff8ab525cf781b2fa5add767",
    "202610070001_advertising_providers":
      "e84c20c6817159b93f1b8ac0d7010bb9eec46f430bc40cd5ae2c31096ea15dcb",
    "202610170001_linkedin_measurement":
      "33c733d46b8e57e448414bdfb5b07ee0a013efd6e6386c2a33fed6150e3d3ddb",
  };
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  for (const [name, digest] of Object.entries(appliedMigrations)) {
    const sql = await readFile(
      new URL(`../apps/docs/netlify/database/migrations/${name}.sql`, import.meta.url),
    );
    assert.equal(sha256(sql), digest, `Applied migration changed: ${name}`);
    await writeFile(join(source, `${name}.sql`), sql);
  }
  assert.deepEqual(
    await stageWaitlistMigrations(repository),
    Object.keys(appliedMigrations),
  );
  for (const [name, digest] of Object.entries(appliedMigrations)) {
    assert.equal(
      sha256(await readFile(join(destination, name, "migration.sql"))),
      digest,
      `Staged migration changed: ${name}`,
    );
  }
});

test("stages exact SQL in Netlify internal format and removes stale generated migrations", async (t) => {
  const { repository, source, destination } = await fixture(t);
  const sql = "CREATE TABLE example (id uuid PRIMARY KEY);\n";
  await writeFile(join(source, "202610020001_create_waitlist.sql"), sql);
  await mkdir(join(destination, "stale"), { recursive: true });
  await writeFile(join(destination, "stale/migration.sql"), "old SQL");
  assert.deepEqual(await stageWaitlistMigrations(repository), [
    "202610020001_create_waitlist",
  ]);
  assert.deepEqual(await readdir(destination), [
    "202610020001_create_waitlist",
  ]);
  assert.equal(
    await readFile(
      join(destination, "202610020001_create_waitlist/migration.sql"),
      "utf8",
    ),
    sql,
  );
});

test("empty, malformed, duplicate-order, and symlink migrations fail before staging", async (t) => {
  const { repository, source } = await fixture(t);
  await assert.rejects(stageWaitlistMigrations(repository), /at least one/);
  await writeFile(join(source, "bad.sql"), "SELECT 1;");
  await assert.rejects(stageWaitlistMigrations(repository), /Invalid/);
  await rm(join(source, "bad.sql"));
  await writeFile(join(source, "001_initial.sql"), " ");
  await assert.rejects(stageWaitlistMigrations(repository), /Empty/);
  await writeFile(join(source, "001_initial.sql"), "SELECT 1;");
  await writeFile(join(source, "001_duplicate.sql"), "SELECT 2;");
  await assert.rejects(stageWaitlistMigrations(repository), /duplicate/);
  await rm(join(source, "001_duplicate.sql"));
  await symlink(join(source, "001_initial.sql"), join(source, "002_link.sql"));
  await assert.rejects(stageWaitlistMigrations(repository), /Invalid/);
});

test("rejects migration transaction wrappers that would bypass Netlify's rollback", async (t) => {
  const { repository, source } = await fixture(t);
  for (const statement of [
    "BEGIN;",
    "START TRANSACTION;",
    "COMMIT;",
    "ROLLBACK;",
    "COMMIT WORK;",
  ]) {
    await writeFile(
      join(source, "001_initial.sql"),
      `-- migration\n${statement}\nSELECT 1;`,
    );
    await assert.rejects(
      stageWaitlistMigrations(repository),
      /must not manage their own transaction/,
    );
  }
});
