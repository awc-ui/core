import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkPublishingAuth, PACKAGES, validateRuntime } from './check-publish-auth.mjs';

const release = {
  authentication: 'trusted', channel: 'beta', version: '1.0.0-beta.10',
  nodeVersion: '22.14.0', npmVersion: '11.19.1',
  getMetadata: async () => ({ 'dist-tags': { latest: '1.0.0-beta.9', beta: '1.0.0-beta.9' }, versions: { '1.0.0-beta.9': {} } }),
};

test('token mode retains promotion and does not require OIDC runtime or registry reads', async () => {
  assert.match(await checkPublishingAuth({ ...release, authentication: 'token', promoteLatest: true, nodeVersion: '20.0.0', npmVersion: '10.0.0', getMetadata: () => { throw new Error('must not fetch'); } }), /Token publishing/);
});

test('omitted authentication defaults to trusted and still enforces OIDC requirements', async () => {
  const { authentication, ...defaults } = release;
  assert.match(await checkPublishingAuth(defaults), /Trusted Publishing preflight passed/);
  await assert.rejects(checkPublishingAuth({ ...defaults, npmVersion: '10.0.0' }), /npm >=11.5.1/);
});

test('trusted runtime checks exact lower bounds and rejects prerelease/invalid versions', () => {
  validateRuntime('22.14.0', '11.5.1');
  validateRuntime('24.0.0', '11.19.1');
  for (const node of ['22.13.1', '20.19.0', '22.14.0-rc.1', 'unknown']) assert.throws(() => validateRuntime(node, '11.19.1'), /Node >=22.14.0/);
  for (const npm of ['11.5.0', '10.9.9', '11.5.1-rc.1', 'unknown']) assert.throws(() => validateRuntime('22.14.0', npm), /npm >=11.5.1/);
});

test('trusted beta promotion fails before any registry or publishing action', async () => {
  await assert.rejects(checkPublishingAuth({ ...release, promoteLatest: true, getMetadata: () => { throw new Error('must not fetch'); } }), /cannot add both beta and latest/);
});

test('trusted beta detects bootstrap latest repair across every package', async () => {
  const read = [];
  await assert.rejects(checkPublishingAuth({ ...release, getMetadata: async name => {
    read.push(name);
    return { 'dist-tags': { latest: name === '@awc-ui/theme' ? '0.0.0-snapshot.123.abc' : '1.0.0-beta.9' }, versions: {} };
  } }), /@awc-ui\/theme: latest=.*bootstrap repair/);
  assert.deepEqual(read, PACKAGES);
});

test('trusted prod directly sets latest, including promotion or a bootstrap latest', async () => {
  assert.match(await checkPublishingAuth({ ...release, channel: 'prod', version: '1.0.0', promoteLatest: true,
    getMetadata: async () => ({ 'dist-tags': { latest: '0.0.0-snapshot.123.abc' }, versions: {} }),
  }), /assign latest to 1.0.0/);
});

test('snapshot remains a single-tag publish even when the beta/prod-only promotion input is set', async () => {
  assert.match(await checkPublishingAuth({ ...release, channel: 'snapshot', version: '0.0.0-snapshot.123.abc', promoteLatest: true }), /assign snapshot/);
});

test('trusted reruns reject existing versions that pnpm would skip without moving the requested tag', async () => {
  for (const [channel, version, tag] of [['beta', '1.0.0-beta.10', 'beta'], ['prod', '1.0.0', 'latest']]) {
    await assert.rejects(checkPublishingAuth({ ...release, channel, version,
      getMetadata: async () => ({ 'dist-tags': { [tag]: '1.0.0-beta.9' }, versions: { [version]: {} } }),
    }), /already exists.*pnpm will skip/);
    assert.match(await checkPublishingAuth({ ...release, channel, version,
      getMetadata: async () => ({ 'dist-tags': { [tag]: version }, versions: { [version]: {} } }),
    }), /preflight passed/);
  }
});

test('unavailable registry metadata fails closed before publishing', async () => {
  await assert.rejects(checkPublishingAuth({ ...release, getMetadata: async () => { throw new Error('registry unavailable'); } }), /registry unavailable/);
});

test('invalid auth/channel inputs cannot silently choose a publishing branch', async () => {
  await assert.rejects(checkPublishingAuth({ ...release, authentication: 'typo' }), /Unknown authentication/);
  await assert.rejects(checkPublishingAuth({ ...release, channel: 'typo' }), /Unknown release channel/);
});

const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');
const step = name => {
  const body = workflow.split(/^      - /m).find(part => part.startsWith(`name: ${name}\n`));
  assert(body, `Workflow step missing: ${name}`);
  return body;
};

test('workflow defaults to trusted publishing, hosted runner, OIDC permission and pinned supported npm', () => {
  assert.match(workflow, /authentication:\n[\s\S]*?default: trusted\n/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /node-version: 22\n/);
  assert.match(workflow, /TRUSTED_NPM_VERSION: '11\.19\.1'/);
  const install = step('Install npm with Trusted Publishing support');
  assert.match(install, /if: inputs\.authentication == 'trusted'/);
  assert.match(install, /npm install --global "npm@\$TRUSTED_NPM_VERSION"/);
});

test('workflow preserves pnpm artifact handling and isolates token credentials from trusted publishing', () => {
  const token = step('Publish to npm (token)');
  const trusted = step('Publish to npm (Trusted Publishing)');
  assert.match(token, /if: inputs\.authentication == 'token'/);
  assert.match(token, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.match(trusted, /if: inputs\.authentication == 'trusted'/);
  assert.doesNotMatch(trusted, /secrets\.|NODE_AUTH_TOKEN:/);
  assert.match(trusted, /unset NODE_AUTH_TOKEN NPM_TOKEN NPM_AUTH_TOKEN/);
  assert.match(trusted, /export npm_config_npm_path="\$\(command -v npm\)"/);
  for (const body of [token, trusted]) {
    assert.match(body, /pnpm -r \$\{\{ env\.PUBLISH_FILTERS \}\} publish/);
    assert.match(body, /--tag \$\{\{ steps\.rv\.outputs\.tag \}\}/);
    assert.match(body, /--no-git-checks/);
    assert.match(body, /NPM_CONFIG_PROVENANCE: 'true'/);
    assert.doesNotMatch(body, /--force/);
  }
});

test('tag mutation steps require token mode, and preflight runs before versioning/build/publish', () => {
  for (const name of ['Heal bootstrap latest tag (beta/prod)', 'Promote latest dist-tag']) {
    const body = step(name);
    assert.match(body, /if: inputs\.authentication == 'token' &&/);
    assert.match(body, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
    assert.match(body, /npm dist-tag add/);
  }
  const gate = workflow.indexOf('name: Validate publishing authentication and tag plan');
  assert(gate > 0 && gate < workflow.indexOf('name: Stamp package versions'));
  assert(gate < workflow.indexOf('name: Build'));
  assert(gate < workflow.indexOf('name: Publish to npm (token)'));
  assert.match(step('Validate publishing authentication and tag plan'), /node scripts\/check-publish-auth\.mjs/);
  assert.match(step('Recheck trusted publishing tag plan'), /if: inputs\.authentication == 'trusted'/);
  assert(workflow.indexOf('name: Recheck trusted publishing tag plan') < workflow.indexOf('name: Publish to npm (token)'));
});
