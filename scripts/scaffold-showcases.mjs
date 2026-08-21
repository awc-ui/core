// One-shot scaffolder for the showcase apps (run from the repo root).
// Copies each framework reference app's config (never node_modules or build
// output), renames the package, and creates the two static-HTML skeletons.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const MAP = [
  ['example-next', 'showcase-fieldstone'],
  ['example-next', 'showcase-lumen'],
  ['example-next', 'showcase-relaymesh'],
  ['example-sveltekit', 'showcase-pulseboard'],
  ['example-sveltekit', 'showcase-cairn'],
  ['example-astro', 'showcase-merrow'],
  ['example-angular-ssr', 'showcase-caduceus'],
  ['example-nuxt', 'showcase-tessellate'],
];

for (const [src, dst] of MAP) {
  execSync(
    `rsync -a --exclude node_modules --exclude .next --exclude .svelte-kit --exclude .nuxt --exclude .astro --exclude dist --exclude .angular --exclude .output --exclude .turbo apps/${src}/ apps/${dst}/`,
  );
  const pjPath = `apps/${dst}/package.json`;
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  pj.name = `@awc-ui/${dst}`;
  pj.description = `Showcase app (${dst.replace('showcase-', '')})`;
  fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n');
  console.log(dst, '<-', src);
}

for (const dst of ['showcase-hearthwise', 'showcase-copperplate']) {
  fs.mkdirSync(`apps/${dst}`, { recursive: true });
  fs.writeFileSync(
    `apps/${dst}/package.json`,
    JSON.stringify(
      {
        name: `@awc-ui/${dst}`,
        version: '0.1.0',
        private: true,
        description: `Showcase app (${dst.replace('showcase-', '')}) — plain HTML, no build step`,
        scripts: {
          dev: 'python3 -m http.server 4180',
          build: "echo 'static app: no build needed'",
        },
        dependencies: {
          '@awc-ui/core': 'workspace:*',
          '@awc-ui/tokens': 'workspace:*',
        },
      },
      null,
      2,
    ) + '\n',
  );
  console.log(dst, '<- static skeleton');
}
