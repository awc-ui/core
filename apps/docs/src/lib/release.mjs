import corePackage from '../../../../packages/core/package.json' with { type: 'json' };

export const npmUrl = 'https://www.npmjs.com/package/@awc-ui/core';
export const githubUrl = 'https://github.com/awc-ui/core';

let release;

// Resolve once per build, never in the visitor's browser. Offline previews
// retain the repository version without claiming it is npm's latest tag.
export function getRelease() {
  return release ??= (async () => {
    try {
      const response = await fetch('https://registry.npmjs.org/-/package/@awc-ui%2fcore/dist-tags', {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`npm returned ${response.status}`);
      const tags = await response.json();
      if (typeof tags.latest !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(tags.latest)) {
        throw new Error('npm did not return a valid latest version');
      }
      return { version: tags.latest, tag: 'latest' };
    } catch (error) {
      console.warn(`[awc:release] Using repository version ${corePackage.version}: ${error.message}`);
      return { version: corePackage.version, tag: null };
    }
  })();
}
