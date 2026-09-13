import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const bin = fileURLToPath(new URL('../bin/awc-ui-mcp.mjs', import.meta.url));
const bundle = JSON.parse(await readFile(new URL('../dist/catalog.json', import.meta.url), 'utf8'));
const value = (response) => JSON.parse(response.content[0].text);

test('published MCP protocol exposes accurate offline Core documentation', { timeout: 15000 }, async (t) => {
  // An unrelated cwd and a minimal environment ensure no implicit repo lookup.
  const client = new Client({ name: 'awc-integration-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [process.env.AWC_MCP_TEST_BIN || bin], cwd: '/tmp', env: {}, stderr: 'pipe' });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => { await client.close(); assert.equal(stderr, ''); });
  await client.connect(transport);

  await t.test('discovery advertises only read-only tools', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['get_component', 'get_guide', 'list_guides', 'search_components']);
    assert.ok(tools.every(({ annotations }) => annotations.readOnlyHint && !annotations.destructiveHint && !annotations.openWorldHint));
  });
  await t.test('search ranks exact tags and paginates the complete catalog', async () => {
    const match = value(await client.callTool({ name: 'search_components', arguments: { query: 'button', limit: 2 } }));
    assert.equal(match.components[0].tag, 'md-button');
    assert.equal(match.nextOffset, 2);
    const tags = [];
    let offset = 0;
    do {
      const result = value(await client.callTool({ name: 'search_components', arguments: { offset, limit: 17 } }));
      assert.equal(result.coreVersion, bundle.coreVersion);
      tags.push(...result.components.map(({ tag }) => tag));
      offset = result.nextOffset;
    } while (offset !== null);
    assert.deepEqual(tags, bundle.components.map(({ tag }) => tag));
    assert.equal(value(await client.callTool({ name: 'search_components', arguments: { query: 'no-such-component-xyz' } })).total, 0);
  });
  await t.test('manual and API tools match the source bundle', async () => {
    const expected = bundle.components.find(({ tag }) => tag === 'md-text-field');
    const result = value(await client.callTool({ name: 'get_component', arguments: { tag: expected.tag } }));
    assert.equal(result.manual, expected.manual);
    assert.deepEqual(result.api, expected.api);
    const apiOnly = value(await client.callTool({ name: 'get_component', arguments: { tag: expected.tag, format: 'api' } }));
    assert.equal(apiOnly.manual, undefined);
    assert.ok(apiOnly.api.events.length > 0);
  });
  await t.test('resource listing, templates and reads are usable', async () => {
    const { resources } = await client.listResources();
    assert.ok(resources.some(({ uri }) => uri === 'awc://catalog'));
    assert.equal(resources.length, bundle.components.length * 2 + bundle.guides.length + 1);
    const { resourceTemplates } = await client.listResourceTemplates();
    assert.equal(resourceTemplates.length, 3);
    const manual = await client.readResource({ uri: 'awc://components/md-button/manual' });
    assert.equal(manual.contents[0].text, bundle.components.find(({ tag }) => tag === 'md-button').manual);
    const api = await client.readResource({ uri: 'awc://components/md-button/api' });
    assert.equal(JSON.parse(api.contents[0].text).tagName, 'md-button');
  });
  await t.test('framework guides and prompts are discoverable', async () => {
    const guides = value(await client.callTool({ name: 'list_guides', arguments: {} })).guides;
    for (const { id, uri } of guides) {
      const result = value(await client.callTool({ name: 'get_guide', arguments: { id } }));
      const resource = await client.readResource({ uri });
      assert.equal(result.text, resource.contents[0].text);
      assert.ok(result.text.length > 100);
    }
    const { prompts } = await client.listPrompts();
    assert.equal(prompts.length, 2);
    for (const { name } of prompts) {
      const prompt = await client.getPrompt({ name, arguments: { task: 'Fix the search layout', framework: 'React' } });
      assert.match(prompt.messages[0].content.text, /Fix the search layout/);
      assert.match(prompt.messages[0].content.text, /React/);
    }
  });
  await t.test('invalid requests cannot read files or silently return other components', async () => {
    for (const args of [{ tag: '../package.json' }, { tag: 'md-does-not-exist' }, { tag: 'md-button', format: 'raw' }]) {
      const response = await client.callTool({ name: 'get_component', arguments: args });
      assert.equal(response.isError, true);
    }
    assert.equal((await client.callTool({ name: 'search_components', arguments: { limit: 999999 } })).isError, true);
    assert.equal((await client.callTool({ name: 'get_guide', arguments: { id: '../../package.json' } })).isError, true);
    await assert.rejects(client.readResource({ uri: 'awc://components/md-does-not-exist/manual' }));
    await assert.rejects(client.readResource({ uri: 'file:///etc/passwd' }));
  });
});
