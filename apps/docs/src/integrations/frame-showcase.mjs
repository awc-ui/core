import { fileURLToPath } from 'node:url';
import { buildFrameworks } from '../../../frame/scripts/build-frameworks.mjs';

/** Stage the standalone demo before Astro reads public/ in dev or production. */
export default function frameShowcase() {
  return {
    name: 'awc:frame-showcase',
    hooks: {
      'astro:config:setup': async ({ config, command, logger }) => {
        if (command !== 'build' && command !== 'dev') return;
        const destination = new URL('showcase/frame/', config.publicDir);
        await buildFrameworks(fileURLToPath(destination));
        logger.info('Frame’s five framework builds staged at /showcase/frame/');
      },
    },
  };
}
