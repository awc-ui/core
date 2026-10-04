import assert from "node:assert/strict";
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
