#!/usr/bin/env node
/** Read-only preflight. A dry run cannot validate npm's OIDC trust configuration. */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PACKAGES = ['core', 'tokens', 'react', 'vue', 'angular', 'svelte', 'theme'].map(name => `@awc-ui/${name}`);

function atLeast(actual, minimum) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(actual);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if (parts[index] !== minimum[index]) return parts[index] > minimum[index];
  }
  return true;
}

export function validateRuntime(nodeVersion, npmVersion) {
  if (!atLeast(nodeVersion, [22, 14, 0])) throw new Error(`Trusted Publishing needs Node >=22.14.0; found ${nodeVersion}.`);
  if (!atLeast(npmVersion, [11, 5, 1])) throw new Error(`Trusted Publishing needs npm >=11.5.1; found ${npmVersion}.`);
}

export async function readPackageMetadata(name) {
  // Public metadata only: no npmrc, bearer token, or account request is used.
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Cannot verify ${name}'s public release tags (HTTP ${response.status}). Resolve this before publishing; new packages also need npm Trusted Publisher setup.`);
  const metadata = await response.json();
  if (!metadata['dist-tags'] || !metadata.versions || typeof metadata.versions !== 'object') throw new Error(`Invalid public metadata for ${name}; refusing to publish without a verified tag plan.`);
  return metadata;
}

export async function checkPublishingAuth({
  authentication = 'trusted', channel, version, promoteLatest = false,
  nodeVersion = process.versions.node, npmVersion,
  getMetadata = readPackageMetadata,
}) {
  if (!['token', 'trusted'].includes(authentication)) throw new Error(`Unknown authentication mode: ${authentication}`);
  if (!['snapshot', 'beta', 'prod'].includes(channel)) throw new Error(`Unknown release channel: ${channel}`);
  if (!version) throw new Error('Resolve the release version before the publishing preflight.');
  if (authentication === 'token') return 'Token publishing selected; existing publish and dist-tag steps are retained.';
  validateRuntime(nodeVersion, npmVersion);
  if (channel === 'beta' && promoteLatest) {
    throw new Error('Trusted Publishing cannot add both beta and latest: npm dist-tag does not support OIDC. Choose authentication=token for this release, or leave promote_latest=false and arrange a separate, explicitly authorized interactive promotion. Nothing has been published.');
  }
  const tag = channel === 'prod' ? 'latest' : channel;
  const issues = [];
  // Read all seven packages before allowing the first publish. This also
  // handles partial release reruns: pnpm skips versions already on npm.
  const metadata = await Promise.all(PACKAGES.map(async name => [name, await getMetadata(name)]));
  for (const [name, data] of metadata) {
    const tags = data['dist-tags'];
    if (channel === 'beta' && String(tags.latest ?? '').startsWith('0.0.0-snapshot.')) {
      issues.push(`${name}: latest=${tags.latest} needs the bootstrap repair. Choose authentication=token for this release, or first repair latest to an already-published release interactively.`);
    }
    if (Object.hasOwn(data.versions, version) && tags[tag] !== version) {
      issues.push(`${name}@${version} already exists, but ${tag}=${tags[tag] ?? '(missing)'}. pnpm will skip this version, so an interactive npm dist-tag add '${name}@${version}' '${tag}' is required before retrying Trusted Publishing.`);
    }
  }
  if (issues.length) throw new Error(`Trusted Publishing cannot complete this tag plan without separate credentials. Nothing has been published.\n${issues.join('\n')}`);
  return `Trusted Publishing preflight passed: ${PACKAGES.length} public packages checked; npm publish will assign ${tag} to ${version}. No separate dist-tag writes are required. This does not validate the npm account's trust configuration.`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const authentication = process.env.AUTHENTICATION || 'trusted';
    const message = await checkPublishingAuth({
      authentication,
      channel: process.env.CHANNEL,
      version: process.env.RELEASE_VERSION,
      promoteLatest: process.env.PROMOTE_LATEST === 'true',
      npmVersion: authentication === 'trusted' ? execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() : undefined,
    });
    console.log(message);
  } catch (error) {
    console.error(`Publishing preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}
