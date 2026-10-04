#!/usr/bin/env node
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRepository = fileURLToPath(new URL("../", import.meta.url));

/**
 * `netlify deploy --no-build` uploads the internal migration directory but does
 * not run Build's db_migrations_copy step. Match that step's directory format.
 * This prepares files only; Netlify applies them before publishing the deploy.
 */
export async function stageWaitlistMigrations(repository = defaultRepository) {
  const source = join(repository, "apps/docs/netlify/database/migrations");
  const destination = join(
    repository,
    "apps/docs/.netlify/internal/db/migrations",
  );
  const entries = await readdir(source, { withFileTypes: true });
  if (entries.length === 0)
    throw new Error("The waitlist database needs at least one migration.");
  const migrations = [];
  const prefixes = new Set();
  // Validate/read the whole source before replacing the generated directory.
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const match = /^(\d+)_([a-z0-9][a-z0-9_-]*)\.sql$/.exec(entry.name);
    if (!entry.isFile() || !match || prefixes.has(match[1])) {
      throw new Error(
        `Invalid or duplicate waitlist migration filename: ${entry.name}`,
      );
    }
    prefixes.add(match[1]);
    const sql = await readFile(join(source, entry.name), "utf8");
    if (sql.trim().length === 0)
      throw new Error(`Empty waitlist migration: ${entry.name}`);
    // Netlify's runner wraps each SQL file AND its tracking-row insert in a
    // transaction. A manual COMMIT in the file breaks that atomic boundary.
    const statements = sql.replace(/--[^\n]*/g, "");
    if (
      /(?:^|;)\s*(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK(?:\s+(?:WORK|TRANSACTION))?)\s*(?:;|$)/im.test(
        statements,
      )
    ) {
      throw new Error(
        `Waitlist migrations must not manage their own transaction: ${entry.name}`,
      );
    }
    migrations.push({ name: entry.name.slice(0, -4), sql });
  }
  await rm(destination, { force: true, recursive: true });
  for (const migration of migrations) {
    const directory = join(destination, migration.name);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "migration.sql"), migration.sql);
  }
  return migrations.map((migration) => migration.name);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const migrations = await stageWaitlistMigrations();
    console.log(
      `Staged ${migrations.length} waitlist database migration(s) for Netlify publication.`,
    );
  } catch (error) {
    console.error(`[waitlist:migrations] ${error.message}`);
    process.exitCode = 1;
  }
}
