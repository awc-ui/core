import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHeroRuntimePreloads } from '../apps/docs/src/lib/runtime-preloads.ts';

const fixture = () => ({
  '/build/md3.esm.js': 'import{b}from"./p-runtime.js"; import("./p-unused.entry.js");',
  '/build/p-runtime.js': 'export const b = () => {};',
  '/build/p-controls.entry.js': 'import{b}from"./p-runtime.js";export{S as md_switch,B as md_button};',
  '/build/p-loading.entry.js': 'export{L as md_loading_indicator}from"./p-loading.js";',
  '/build/p-loading.js': 'import "./p-runtime.js"; export const L = {};',
  '/build/p-unused.entry.js': 'export{T as md_table};',
});

test('preloads grouped hero components and shared static dependencies once', () => {
  const urls = getHeroRuntimePreloads(fixture(), '<md-switch></md-switch><md-button>Save</md-button><md-switch></md-switch><md-loading-indicator></md-loading-indicator>');
  assert.deepEqual(urls, [
    '/awc-runtime/md3/md3.esm.js', '/awc-runtime/md3/p-runtime.js',
    '/awc-runtime/md3/p-controls.entry.js', '/awc-runtime/md3/p-loading.entry.js',
    '/awc-runtime/md3/p-loading.js',
  ]);
  assert.equal(urls.some((url) => url.includes('unused')), false);
});

test('follows new build hashes without changing the hero markup', () => {
  const modules = fixture();
  modules['/build/p-new-hash.entry.js'] = modules['/build/p-controls.entry.js'];
  delete modules['/build/p-controls.entry.js'];
  assert.ok(getHeroRuntimePreloads(modules, '<md-switch>').includes('/awc-runtime/md3/p-new-hash.entry.js'));
});

test('supports emitted bare exports and terminates shared import cycles', () => {
  const modules = fixture();
  modules['/build/p-controls.entry.js'] = 'import "./p-runtime.js"; export { md_switch };';
  modules['/build/p-runtime.js'] += 'import "./md3.esm.js";';
  assert.equal(getHeroRuntimePreloads(modules, '<md-switch>').length, 3);
});

test('fails the build rather than shipping missing hero entry or dependency URLs', () => {
  assert.throws(() => getHeroRuntimePreloads(fixture(), '<md-slider>'), /No built runtime entry.*md-slider/);
  const modules = fixture();
  delete modules['/build/p-runtime.js'];
  assert.throws(() => getHeroRuntimePreloads(modules, '<md-switch>'), /Missing critical runtime module.*p-runtime/);
});
