import { spawn } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STANDALONE_SHOWCASES } from "../../../../scripts/lib/standalone-showcases.mjs";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));

function buildApp(id) {
  return new Promise((accept, reject) => {
    const child = spawn("pnpm", ["--filter", `@awc-ui/${id}`, "build"], {
      cwd: repo,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? accept()
        : reject(new Error(`${id} showcase build failed (${code}).`)),
    );
  });
}

/** Use each application's production build; the MDX page owns the parent URL. */
export default function workspaceShowcases() {
  return {
    name: "awc:workspace-showcases",
    hooks: {
      "astro:config:setup": async ({ config, command, logger }) => {
        if (command !== "build" && command !== "dev") return;
        for (const app of STANDALONE_SHOWCASES.filter(
          (app) => app.id !== "frame",
        )) {
          await buildApp(app.id);
          for (const framework of app.frameworks) {
            const route = `showcase/${app.id}/${framework}/`;
            const destination = fileURLToPath(new URL(route, config.publicDir));
            const source = resolve(repo, "apps", app.id, "dist", ...(app.frameworks.length > 1 ? [framework] : []));
            await rm(destination, { recursive: true, force: true });
            await mkdir(destination, { recursive: true });
            await cp(source, destination, { recursive: true });
            logger.info(`${app.title} staged at /${route}`);
          }
        }
      },
    },
  };
}
