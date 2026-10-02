import { getConnectionString, getDatabase } from "@netlify/database";
import { readConfig } from "./config.mjs";
import { createWaitlistStore } from "./store.mjs";

let runtime;
export function getRuntime(context) {
  const config = readConfig(process.env, context);
  if (!config) return null;
  // The platform injects a deploy-scoped connection. Credentials never enter
  // GitHub, the browser, or previews. Refresh the pool when Netlify rotates them.
  const connectionString = getConnectionString();
  if (!runtime || runtime.connectionString !== connectionString) {
    if (runtime) void runtime.pool.end().catch(() => {});
    const { pool } = getDatabase();
    pool.on("error", () => console.error("waitlist_database_unavailable"));
    runtime = { connectionString, pool, store: createWaitlistStore(pool) };
  }
  return { store: runtime.store, config };
}
