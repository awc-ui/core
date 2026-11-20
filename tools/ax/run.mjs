#!/usr/bin/env node
// tools/ax — accessibility parity runner. See README.md.
// node tools/ax/run.mjs --tags md-checkbox,md-switch [--platforms macos,web,ios,android,compare] [--out DIR]
//   [--ios-device UDID] [--android-serial emulator-5556] [--android-project DIR] [--cases id,id]
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES, LANDED } from './cases.mjs';
import { macHost, captureMac, liveBinary } from './macos.mjs';
import os from 'node:os';
import { webServer, launchChrome, captureWeb, nodeToHTML } from './web.mjs';
import { normalizeWeb, normalizeMac, macRole, normalizeIOS, normalizeAndroid, ws } from './normalize.mjs';
import { compareCase } from './compare.mjs';
import { spanFindings } from './spans.mjs';
import { decodePNG } from './png.mjs';
import { contrastFindings } from './contrast.mjs';
import { EXPECTATIONS } from './expectations.mjs';
import { webPresentation } from './presentation.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? 'true' : all[i + 1]]] : acc), []));
const root = path.resolve(args.root ?? path.join(here, '../..'));
const out = path.resolve(args.out ?? path.join(root, 'outputs/native-parity/_ax'));
const tags = (args.tags ?? Object.keys(CASES).join(',')).split(',').filter(Boolean);
const platforms = (args.platforms ?? 'macos,web,ios,android,compare').split(',');
const only = args.cases ? new Set(args.cases.split(',')) : null;
const log = (...a) => console.log(...a);
// S7-19-01 (story 9-42): every requested capture that is missing, empty or short is a FAIL row with its reason, and the run ends non-zero.
const failures = [];
const fail = (platform, reason) => { failures.push(`${platform}: ${reason}`); log(`FAIL ${platform} ${reason}`); };
const NATIVE = ['macos', 'ios', 'android'];
const explicit = args.platforms !== undefined;   // a platform named on the command line must deliver; the default list may skip ios/android without a device
const whyNoFile = p => !existsSync(p) ? 'capture file missing' : '';
const why = async p => { if (!existsSync(p)) return 'capture file missing'; try { if ((await readFile(p, 'utf8')).trim() === '') return 'capture file empty (0 bytes)'; } catch {} return 'capture file unreadable'; };
const casesFor = tag => (CASES[tag] ?? []).filter(c => !only || only.has(c.id));
const landedOn = platform => tag => (LANDED[tag] ?? ['macos', 'ios', 'android']).includes(platform);
const file = (tag, id, platform) => path.join(out, tag, `${id}.${platform}.json`);
const readJSON = async p => { if (!existsSync(p)) return null; try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } };   // absent or unfinished: no capture
const png = (tag, id, platform) => path.join(out, tag, `${id}.${platform}.png`);
const save = async (p, v) => { await mkdir(path.dirname(p), { recursive: true }); await writeFile(p, JSON.stringify(v, null, 1)); };
const request = (tag, c) => ({ tag, properties: c.properties ?? {}, width: c.width ?? 640, dark: false, ...(c.height ? { height: c.height } : {}), ...(c.slots ? { slots: c.slots } : {}), ...(c.rowSpanFixture ? { rowSpanFixture: true } : {}), ...(c.direction ? { direction: c.direction } : {}), ...(c.text ? { text: c.text } : {}) });

async function runMac() {
  const bin = liveBinary(root);
  if (!existsSync(bin)) { fail('macos', `preview binary missing: ${bin} (build AWCLivePreview in the tree first)`); return; }
  let asked = 0, got = 0;
  // The SwiftUI host configures one root per process (as the Laboratory does per preview session): one host per case.
  for (const tag of tags.filter(landedOn('macos'))) for (const c of casesFor(tag)) {
    const host = macHost(root); asked++;
    const r = await captureMac(host, request(tag, c), { tabs: c.tabs ?? 0, update: c.update ?? null, settle: c.settle ?? 0.6 });
    host.close();
    if (r.png) { await mkdir(path.join(out, tag), { recursive: true }); await writeFile(png(tag, c.id, 'macos'), r.png); delete r.png; }
    await save(file(tag, c.id, 'macos'), { tag, case: c.id, request: request(tag, c), ...r });
    log(`macos ${tag}/${c.id} ${r.error ? 'ERROR ' + JSON.stringify(r.error).slice(0, 200) : 'ok'}${r.configureMs !== undefined ? ` configure=${r.configureMs}ms load1=${os.loadavg()[0].toFixed(0)}` : ''}`);
    if (r.error) fail('macos', `${tag}/${c.id}: ${JSON.stringify(r.error).slice(0, 160)}`); else if (!r.node) fail('macos', `${tag}/${c.id}: capture has no effective node`); else got++;
  }
  if (asked === 0) fail('macos', '0 cases asked: no requested tag has a landed macOS case');
  else if (got !== asked) fail('macos', `${got} of ${asked} cases captured`);
}

async function runWeb() {
  const server = await webServer(root); const { browser, version } = await launchChrome(root);
  try {
    for (const tag of tags) for (const c of casesFor(tag)) {
      const mac = await readJSON(file(tag, c.id, 'macos'));
      if (!mac?.node) { log(`web ${tag}/${c.id} skipped: no macOS effective node`); fail('web', `${tag}/${c.id}: skipped, no macOS effective node (${await why(file(tag, c.id, 'macos'))})`); continue; }
      const props = {}; const html = webPresentation(tag, nodeToHTML(mac.node, props), mac.node);
      const r = await captureWeb({ server, browser, version }, { html, props, tag: mac.node.tag, dir: c.direction ?? 'ltr', tabs: c.tabs ?? 0, width: c.width ?? 640, settle: (c.settle ?? 0.35) * 1000 });
      if (r.png) { await mkdir(path.join(out, tag), { recursive: true }); await writeFile(png(tag, c.id, 'web'), r.png); delete r.png; }
      await save(file(tag, c.id, 'web'), { tag, case: c.id, html, props, ...r });
      log(`web ${tag}/${c.id} ok`);
    }
  } finally { await browser.close(); server.close(); }
}

function runIOS() {
  const udid = args['ios-device'] ?? process.env.AWC_AX_IOS_DEVICE; if (!udid) { log('ios skipped: --ios-device UDID'); if (explicit) fail('ios', 'requested but no simulator: --ios-device UDID missing'); return Promise.resolve(); }
  return (async () => {
    const list = [];
    for (const tag of tags.filter(landedOn('ios'))) for (const c of casesFor(tag)) {
      const mac = await readJSON(file(tag, c.id, 'macos'));
      if (mac?.node) list.push({ id: `${tag}/${c.id}`, node: mac.node, width: c.width ?? 640, height: c.height ?? 240, direction: c.direction ?? 'ltr', tabs: c.tabs ?? 0, settle: c.settle ?? 0.6 });
    }
    if (!list.length) { fail('ios', '0 cases asked: no case has a macOS effective node (run macos first)'); return; }
    const stamp = `${process.pid}-${Date.now()}`, input = `/tmp/awc-ax/ios-cases-${stamp}.json`, output = `/tmp/awc-ax/ios-out-${stamp}.json`;
    await mkdir('/tmp/awc-ax', { recursive: true }); await writeFile(input, JSON.stringify(list));
    const script = path.join(root, 'apps/native-ios-parity/scripts/run-fixture.sh');
    const env = { ...process.env, AWC_IOS_DEVICE: udid, AWC_IOS_STAGE: process.env.AWC_IOS_STAGE ?? `/tmp/awc-ios/stage-ax-${udid.slice(0, 8)}`, AWC_IOS_RUN_TIMEOUT: String(120 + list.length * 20) };
    if (!existsSync(script)) { fail('ios', `harness script missing: ${script}`); return; }
    const r = spawnSync('bash', [script, path.join(here, 'ios/AccessibilityProbe.swift'), `AWC_AX_CASES_FILE=${input}`, `AWC_AX_OUTPUT=${output}`], { env, encoding: 'utf8', maxBuffer: 64 << 20 });
    log(r.stdout.split('\n').filter(l => /PASS|FAIL|error|exit/.test(l)).slice(-12).join('\n'));
    const res = await readJSON(output);
    if (!res) { log('ios: no output'); fail('ios', `0 of ${list.length} cases captured: ${await why(output)} (harness exit ${r.status}${r.error ? ', ' + r.error.code : ''})`); return; }
    if (!Array.isArray(res.results) || res.results.length !== list.length) fail('ios', `${res.results?.length ?? 0} of ${list.length} cases captured`);
    for (const e of res.results ?? []) {
      if (e.error) fail('ios', `${e.id}: ${String(e.error).slice(0, 160)}`);
      const [tag, id] = e.id.split('/');
      if (e.image?.file && existsSync(e.image.file)) { await mkdir(path.join(out, tag), { recursive: true }); await copyFile(e.image.file, png(tag, id, 'ios')); await rm(e.image.file, { force: true }); e.image = { scale: e.image.scale, offset: [0, 0], cssPerUnit: 1 }; }
      await save(file(tag, id, 'ios'), { tag, case: id, ...e }); log(`ios ${tag}/${id} ${e.error ? 'ERROR ' + e.error : 'ok'}`);
    }
  })();
}

async function runAndroid() {
  const serial = args['android-serial'] ?? process.env.AWC_SERIAL ?? 'emulator-5556';
  const project = path.resolve(args['android-project'] ?? process.env.AWC_ANDROID_PROJ ?? path.join(root, 'apps/native-android-playground'));
  const list = [];
  // The shared fixture: the macOS host's effective node (as Web and iOS render it) — its properties and children.
  const shared = async (tag, c) => { const mac = await readJSON(file(tag, c.id, 'macos')), r = (({ rowSpanFixture, ...q }) => q)(request(tag, c));
    if (!mac?.node) return r;
    const { id, ...props } = mac.node.properties ?? {};
    const properties = { ...props, ...(c.properties ?? {}) };
    // The Android host renders a segmented set from its `segmentedContext` (parent properties and the three segments' selection).
    const segments = (mac.node.children ?? []).filter(k => k.tag === 'md-segmented-button');
    if (tag === 'md-segmented-button-set' && segments.length === 3)
      return { ...r, properties, segmentedContext: { mode: 'set', multiselect: properties.multiselect === true, density: Number(properties.density ?? 0), selection: segments.map(k => k.properties?.selected === true) } };
    return { ...r, properties, children: mac.node.children ?? [] }; };
  for (const tag of tags.filter(landedOn('android'))) for (const c of casesFor(tag)) list.push({ id: `${tag}/${c.id}`, request: await shared(tag, c), tabs: c.tabs ?? 0, settleMs: Math.round((c.settle ?? 0.7) * 1000), ...(c.update ? { update: c.update } : {}) });
  if (!list.length) { fail('android', '0 cases asked: no requested tag has a landed Android case'); return; }
  const assets = path.join(project, 'src/androidTest/assets/ax'); await mkdir(assets, { recursive: true });
  await writeFile(path.join(assets, 'cases.json'), JSON.stringify(list));
  const runner = process.env.AWC_A_TEST ?? path.resolve(root, '../claude-runner/tools/A-test.sh');
  const adb = path.join(process.env.ANDROID_HOME ?? path.resolve(root, '../android-sdk'), 'platform-tools/adb');
  if (!existsSync(runner)) { fail('android', `runner missing: ${runner} (set AWC_A_TEST)`); return; }
  if (!existsSync(adb)) { fail('android', `adb missing: ${adb} (set ANDROID_HOME)`); return; }
  const logs = path.join(out, '_android'); await mkdir(logs, { recursive: true });
  const remote = '/sdcard/Android/data/dev.awc.playground/files/ax/out.json', local = path.join(logs, 'out.json');
  spawnSync(adb, ['-s', serial, 'shell', 'rm', '-rf', remote, path.posix.join(path.posix.dirname(remote), 'img')], { encoding: 'utf8' });   // never read a previous run's output
  await writeFile(local, '');
  const r = spawnSync('bash', [runner, logs, 'ax', 'dev.awc.playground.AccessibilityProbeTest'], { env: { ...process.env, AWC_SERIAL: serial, AWC_ANDROID_PROJ: project, TEST_TIMEOUT: String(420 + list.length * 12) }, encoding: 'utf8', maxBuffer: 64 << 20 });
  log(r.stdout.split('\n').slice(-8).join('\n'));
  spawnSync(adb, ['-s', serial, 'pull', remote, local], { encoding: 'utf8' });
  spawnSync(adb, ['-s', serial, 'pull', path.posix.join(path.posix.dirname(remote), 'img'), logs], { encoding: 'utf8' });
  const res = await readJSON(local); if (!res) { log('android: no output'); fail('android', `0 of ${list.length} cases captured: ${await why(local)} (runner exit ${r.status}${r.error ? ', ' + r.error.code : ''})`); return; }
  if (!Array.isArray(res.results) || res.results.length !== list.length) fail('android', `${res.results?.length ?? 0} of ${list.length} cases captured`);
  for (const e of res.results ?? []) {
    if (e.error) fail('android', `${e.id}: ${String(e.error).slice(0, 160)}`);
    const [tag, id] = e.id.split('/'), shot = e.image?.name ? path.join(logs, 'img', e.image.name) : null;
    if (shot && existsSync(shot)) { await mkdir(path.join(out, tag), { recursive: true }); await copyFile(shot, png(tag, id, 'android')); e.image = { scale: 1, offset: e.image.offset ?? [0, 0], cssPerUnit: 1 / (e.image.density || 1), source: e.image.source }; }
    await save(file(tag, id, 'android'), { tag, case: id, ...e }); log(`android ${tag}/${id} ${e.error ? 'ERROR ' + e.error : 'ok'}`);
  }
}

// ---- comparison ---------------------------------------------------------------------------------------------
const loadImage = async (raw, tag, id, platform) => { const f = png(tag, id, platform); if (!raw?.image || !existsSync(f)) return null; try { return decodePNG(await readFile(f)); } catch { return null; } };
const focusOf = {
  web: f => f.outside ? null : { role: f.role === 'button' && f.props?.pressed !== undefined ? 'togglebutton' : f.role, name: ws(f.name) },
  // A focused AXStaticText is a listbox option (WebKit's encoding, decision 3).
  macos: f => { const k = f?.keyboardFocus; if (!k) return null; const n = normalizeMac([{ role: k.role ?? 'AXUnknown', subrole: k.subrole, description: k.description ?? '', children: [] }]).elements[0]; return { role: k.role === 'AXStaticText' ? 'option' : n?.role ?? macRole(k.role) ?? k.role ?? '?', name: ws(k.description ?? '') }; },
  // A focused semantic-group container without traits (md-tab-panel's Tab stop, gate-7 R6-20) is a group stop.
  ios: f => { const d = f?.focusSystem ?? f?.firstResponder; if (!d) return null; if (d.containerType === 'semanticGroup' && !(d.traits ?? []).length) return { role: 'group', name: ws(d.label ?? '') }; const els = normalizeIOS([d]).elements, n = els.find(e => e.role !== 'heading') ?? els[0]; return { role: n?.role ?? 'text', name: ws(d.label ?? '') }; },
  // The focused node with its subtree from the capture (TalkBack labels and Compose role carriers live in descendants).
  android: (f, raw) => { if (!f) return null; let node = null;
    const find = n => { if (!n || node) return; if (f.virtualId !== undefined && n.virtualId === f.virtualId) node = n; (n.children ?? []).forEach(find); };
    for (const w of raw?.windows ?? []) find(w.root);
    const n = normalizeAndroid([{ root: node ?? { ...f, children: [] } }]).elements.find(e => e.role !== 'heading') ?? null;
    return { role: n?.role ?? (f.class === 'android.view.View' ? 'group' : f.class), name: n?.name ?? ws(f.contentDescription || f.text || '') }; },
};
const INTERACTIVE = new Set(['button', 'togglebutton', 'checkbox', 'switch', 'radio', 'tab', 'link', 'menuitem', 'slider', 'textbox', 'searchbox', 'combobox', 'spinbutton', 'option']);

function lint(platform, n, raw) {
  const out = [];
  for (const e of n.elements) {
    if (INTERACTIVE.has(e.role) && !e.name) out.push({ kind: 'lint', detail: `${platform}: ${e.role} without an accessible name` });
    const min = platform === 'ios' ? 44 : platform === 'android' ? 48 * (raw.density ?? 2.625) : 0;   // the preview display's density
    if (min && INTERACTIVE.has(e.role) && e.frame && (e.frame[2] < min - 0.5 || e.frame[3] < min - 0.5) && !e.states.disabled) out.push({ kind: 'target', detail: `${platform}: ${e.role} "${e.name}" target ${e.frame[2].toFixed(0)}×${e.frame[3].toFixed(0)} below ${platform === 'ios' ? '44pt' : '48dp'}` });
  }
  const atfResults = Array.isArray(raw.atf) ? raw.atf : raw.atf?.results ?? [];
  if (platform === 'android' && raw.atf?.error) out.push({ kind: 'atf', detail: `ATF did not run: ${raw.atf.error}` });
  if (platform === 'android') for (const a of atfResults) out.push({ kind: 'atf', detail: `ATF ${a.type} ${a.check}: ${a.message} [${a.element?.class ?? ''} "${a.element?.text || a.element?.contentDescription || ''}"]` });
  return out;
}

function expectationFor(tag, id, platform, f) {
  return EXPECTATIONS.find(x => (!x.tag || x.tag === tag || (x.tag instanceof RegExp && x.tag.test(tag))) && (!x.case || x.case.test(id)) && (!x.platform || x.platform === platform) && (!x.kind || x.kind === f.kind) && (!x.match || x.match.test(f.detail)));
}

async function runCompare() {
  const summary = [];
  for (const tag of tags) {
    const rows = [];
    if (!casesFor(tag).length) fail('compare', `${tag}: no cases defined`);
    // Requested on the command line (--platforms or --expect), or already captured for some case of this tag: then every case must have it.
    const have = new Set(); for (const p of NATIVE) for (const c of casesFor(tag)) if (await readJSON(file(tag, c.id, p))) { have.add(p); break; }
    const expectP = (args.expect ?? '').split(',').filter(Boolean);
    const asked = NATIVE.filter(p => landedOn(p)(tag) && (platforms.includes(p) || expectP.includes(p) || have.has(p)));
    for (const c of casesFor(tag)) {
      const webRaw = await readJSON(file(tag, c.id, 'web'));
      if (!webRaw?.tree) { rows.push({ case: c.id, error: 'no web capture' }); fail('compare', `${tag}/${c.id}: no web capture (${await why(file(tag, c.id, 'web'))})`); continue; }
      const webN = normalizeWeb(webRaw.tree);
      const webFocus = (webRaw.focus ?? []).map(focusOf.web).filter(Boolean);
      const webImg = await loadImage(webRaw, tag, c.id, 'web');
      // Web's own contrast (reported for the Web source; native findings quote the Web ratio alongside).
      const webContrast = contrastFindings('web', { img: webImg, image: webRaw.image, raw: webRaw, normalized: webN }, null, webN.elements.map(e => [e, e]), { inactive: !!c.inactive });
      const row = { case: c.id, web: { elements: webN.elements.map(e => `${e.role}:${e.name}`), texts: webN.texts, focus: webFocus.map(f => `${f.role}:${f.name}`),
        contrast: { measured: webContrast.measured, findings: webContrast.findings.map(f => f.detail) } }, platforms: {} };
      for (const platform of ['macos', 'ios', 'android']) {
        const raw = await readJSON(file(tag, c.id, platform));
        if (!raw) { row.platforms[platform] = { status: 'not-run' }; if (asked.includes(platform)) fail(platform, `${tag}/${c.id}: ${await why(file(tag, c.id, platform))}`); continue; }
        if (raw.error) { row.platforms[platform] = { status: 'error', error: raw.error }; if (asked.includes(platform)) fail(platform, `${tag}/${c.id}: ${JSON.stringify(raw.error).slice(0, 160)}`); continue; }
        const n = platform === 'macos' ? normalizeMac(raw.tree) : platform === 'ios' ? normalizeIOS(raw.elements) : normalizeAndroid(raw.windows);
        const nativeFocus = (raw.focus ?? []).map(f => focusOf[platform](f, raw));
        // A native walk that ends where focus leaves the component is not a mismatch: compare up to Web's stops + 1.
        const cmp = compareCase(platform, webN, n, { webFocus: c.tabs ? webFocus : [], nativeFocus: c.tabs ? nativeFocus : [] });
        // Live regions (Web status/alert/aria-live): native platforms announce instead. With an update step the change must be announced.
        const live = webN.elements.some(e => e.live || ['status', 'alert'].includes(e.role));
        const announced = platform === 'macos' ? [...(raw.announcements ?? []), ...(raw.afterUpdate?.announcements ?? [])]
          : platform === 'android' ? (raw.afterUpdate?.events ?? raw.events ?? []).filter(e => e.type === 'TYPE_ANNOUNCEMENT' || (e.type === 'TYPE_WINDOW_CONTENT_CHANGED' && (e.via !== 'window' || e.changes & 8))) : null;
        if (live && c.update && platform === 'macos' && !(raw.afterUpdate?.announcements ?? []).length) cmp.findings.push({ kind: 'announce', detail: `macos: the update ${JSON.stringify(c.update)} changed a live region but nothing was announced` });
        // Politeness: Web alert/assertive interrupts (NSAccessibilityPriorityHigh = 90); status/polite must not.
        const assertive = webN.elements.some(e => e.role === 'alert' || e.live === 'assertive');
        if (live && platform === 'macos') for (const a of announced) if (typeof a.priority === 'number' && a.priority >= 0 && (assertive ? a.priority < 90 : a.priority >= 90))
          cmp.findings.push({ kind: 'announce', detail: `macos: "${a.text}" announced at priority ${a.priority}; Web is ${assertive ? 'assertive (high, 90)' : 'polite (below high)'}` });
        if (live && c.update && platform === 'android' && !announced.length && !n.elements.some(e => e.live)) cmp.findings.push({ kind: 'announce', detail: 'android: no announcement or live-region change for the update' });
        // Contrast from the captured pixels (WCAG 1.4.3 / 1.4.11), each measurement also taken on Web's pixels.
        const con = contrastFindings(platform, { img: await loadImage(raw, tag, c.id, platform), image: raw.image, raw, normalized: n },
          { img: webImg, image: webRaw.image, raw: webRaw, normalized: webN }, cmp.matched, { inactive: !!c.inactive });
        cmp.findings.push(...con.findings);
        cmp.findings.push(...spanFindings(platform, raw, webRaw, !!c.rowSpanFixture));   // R5-12 (9-11): rowSpan reaches the cell semantics
        const findings = [...cmp.findings, ...lint(platform, n, raw)].map(f => { const x = expectationFor(tag, c.id, platform, f); return x ? { ...f, status: 'expected', reason: x.reason } : f.kind === 'target' ? { ...f, status: 'info' } : { ...f, status: 'open' }; });
        row.platforms[platform] = { status: findings.some(f => f.status === 'open') ? 'findings' : 'pass', matched: cmp.pairs, webElements: cmp.web, nativeElements: cmp.native,
          elements: n.elements.map(e => `${e.role}:${e.name}${Object.keys(e.states).length ? ' ' + JSON.stringify(e.states) : ''}`), texts: n.texts, ...(announced ? { announcements: announced.map(a => (a.text ?? a.type) + (typeof a.priority === 'number' && a.priority >= 0 ? ` (priority ${a.priority})` : '')) } : {}), focus: nativeFocus.map(f => f ? `${f.role}:${f.name}` : '∅'), findings,
          contrastMeasured: con.measured,
          ...(platform === 'android' ? { atf: Array.isArray(raw.atf) ? raw.atf.length : { elements: raw.atf?.elements, results: raw.atf?.results?.length ?? 0 }, childOrder: raw.childOrder, events: raw.events ?? [] } : {}) };
      }
      rows.push(row);
    }
    const report = { tag, at: new Date().toISOString(), rows };
    await save(path.join(out, tag, 'report.json'), report);
    await writeFile(path.join(out, tag, 'report.md'), markdown(report));
    const open = rows.flatMap(r => Object.entries(r.platforms ?? {}).flatMap(([p, v]) => (v.findings ?? []).filter(f => f.status === 'open').map(f => ({ p, ...f }))));
    const captured = Object.fromEntries(NATIVE.map(p => [p, rows.filter(r => ['pass', 'findings'].includes(r.platforms?.[p]?.status)).length]));
    summary.push({ tag, cases: rows.length, open: open.length, expected: rows.flatMap(r => Object.values(r.platforms ?? {}).flatMap(v => (v.findings ?? []).filter(f => f.status === 'expected'))).length,
      captured, notRun: [...new Set(rows.flatMap(r => Object.entries(r.platforms ?? {}).filter(([, v]) => v.status !== 'pass' && v.status !== 'findings').map(([p, v]) => `${p}:${v.status}`)))] });
    const any = Object.values(captured).reduce((a, b) => a + b, 0);
    if (!any) { fail('compare', `${tag}: 0 of ${rows.length} cases captured on any native platform`); log(`compare ${tag}: ${rows.length} cases, NOT RUN (no native capture)`); }
    else log(`compare ${tag}: ${rows.length} cases, ${open.length} open findings (captured ${NATIVE.map(p => `${p} ${captured[p]}/${rows.length}`).join(', ')})`);
  }
  await save(path.join(out, `summary-${tags.length === 1 ? tags[0] : 'run'}.json`), summary);
}
function markdown(r) {
  const lines = [`# ${r.tag} — accessibility parity`, '', `Generated ${r.at} by tools/ax. Web = Chrome AX tree of the same effective node.`, ''];
  for (const row of r.rows) {
    lines.push(`## ${row.case}`, '');
    if (row.error) { lines.push(`- ${row.error}`, ''); continue; }
    lines.push(`- Web: ${row.web.elements.join(' · ') || '(no semantic elements)'}${row.web.texts.length ? ` · text: ${row.web.texts.join(' / ')}` : ''}${row.web.focus.length ? ` · Tab: ${row.web.focus.join(' → ')}` : ''}`);
    if (row.web.contrast?.findings?.length) lines.push(`  - Web contrast (reported for the Web source): ${row.web.contrast.findings.join('; ')}`);
    for (const [p, v] of Object.entries(row.platforms)) {
      lines.push(`- ${p} (${v.status}): ${(v.elements ?? []).join(' · ') || v.error || ''}${v.texts?.length ? ` · text: ${v.texts.join(' / ')}` : ''}${v.focus?.length ? ` · Tab: ${v.focus.join(' → ')}` : ''}${v.announcements?.length ? ` · announced: ${v.announcements.join(' / ')}` : ''}`);
      for (const f of v.findings ?? []) lines.push(`  - ${f.status === 'open' ? '**open**' : 'expected'} ${f.kind}: ${f.detail}${f.reason ? ` — ${f.reason}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

if (platforms.includes('macos')) await runMac();
if (platforms.includes('web')) await runWeb();
if (platforms.includes('ios')) await runIOS();
if (platforms.includes('android')) await runAndroid();
if (platforms.includes('compare')) await runCompare();
if (failures.length) { log(`FAIL tools/ax: ${failures.length} capture failure(s)`); process.exitCode = 1; } else log('PASS tools/ax: every requested capture is complete');
