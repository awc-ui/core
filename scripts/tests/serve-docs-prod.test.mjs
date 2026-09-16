import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import { createDocsServer } from '../serve-docs-prod.mjs';

test('docs server serves only indexed regular files, including safe compressed siblings', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'awc-serve-security-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'dist');
  await mkdir(join(root, 'guide'), { recursive: true });
  await writeFile(join(directory, 'secret.txt'), 'secret');
  await writeFile(join(root, 'index.html'), 'home');
  await writeFile(join(root, '404.html'), 'not found');
  await writeFile(join(root, 'guide/index.html'), 'guide');
  await writeFile(join(root, 'about.html'), 'about');
  await writeFile(join(root, 'space name.txt'), 'space');
  const payload = 'safe content '.repeat(200);
  await writeFile(join(root, 'asset.js'), payload);
  await writeFile(join(root, 'asset.js.gz'), gzipSync(payload));
  await writeFile(join(root, 'other.js'), payload);
  await symlink(join(directory, 'secret.txt'), join(root, 'secret.txt'));
  await symlink(directory, join(root, 'outside'));
  await symlink(join(directory, 'secret.txt'), join(root, 'other.js.gz'));
  const { server } = createDocsServer({ directory: root, compress: true });
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const read = (path, { method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
  for (const [path, expected] of [['/', 'home'], ['/guide', 'guide'], ['/guide/', 'guide'], ['/about', 'about'], ['/space%20name.txt?x=1', 'space']]) {
    const response = await read(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.body.toString(), expected);
  }
  for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/%252e%252e/secret.txt', '/..%2fsecret.txt', '/secret.txt', '/outside/secret.txt', '/%00', '/%', '/%E0%A4%A', '/%5c..%5csecret.txt']) {
    const response = await read(path);
    assert.equal(response.status, 404, path);
    assert.equal(response.body.toString(), 'not found');
  }
  for (const path of ['/asset.js', '/other.js']) {
    const response = await read(path, { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(response.headers['content-encoding'], 'gzip');
    assert.equal(gunzipSync(response.body).toString(), payload);
  }
  const head = await read('/guide/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers['content-length'], '5');
  assert.equal((await read('/')).status, 200, 'malformed requests did not crash the server');
});
