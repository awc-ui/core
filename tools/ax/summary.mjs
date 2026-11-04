#!/usr/bin/env node
// Markdown summary of tools/ax reports: one row per component with each platform's status and the open finding kinds.
// node tools/ax/summary.mjs --out <reports dir> [--tags md-a,md-b] [--link-base ../../outputs/native-parity] [--layout flat|evidence]
// node tools/ax/summary.mjs --roles   (the per-platform role table, from normalize.mjs ROLE_TABLE)
//   flat (default): <out>/<tag>/report.json (run.mjs --out); evidence: <out>/<tag>/accessibility/report.json (published evidence).
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ROLE_TABLE } from './normalize.mjs';
import { LANDED } from './cases.mjs';

const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = i + 1 >= argv.length || argv[i + 1].startsWith('--') ? 'true' : argv[++i];
if (args.roles) {
  console.log(['| Web role | macOS (NSAccessibility) | iOS (UIAccessibility) | Android (AccessibilityNodeInfo) |', '| --- | --- | --- | --- |',
    ...Object.entries(ROLE_TABLE).map(([role, p]) => `| \`${role}\` | ${p.macos} | ${p.ios} | ${p.android} |`)].join('\n'));
  process.exit(0);
}
const out = path.resolve(args.out ?? 'outputs/native-parity/_ax');
const evidence = args.layout === 'evidence';
const reportPath = tag => evidence ? path.join(out, tag, 'accessibility', 'report.json') : path.join(out, tag, 'report.json');
const tags = args.tags ? args.tags.split(',')
  : (await readdir(out, { withFileTypes: true })).filter(d => d.isDirectory() && d.name.startsWith('md-')).map(d => d.name).sort();

const lines = ['| Component | Cases | macOS | iOS | Android | Open findings |', '| --- | --- | --- | --- | --- | --- |'];
for (const tag of tags) {
  let report;
  try { report = JSON.parse(await readFile(reportPath(tag), 'utf8')); } catch { continue; }
  const cell = platform => {
    if (LANDED[tag] && !LANDED[tag].includes(platform)) return 'not landed';
    const runs = report.rows.map(r => r.platforms?.[platform]).filter(Boolean);
    if (!runs.length || runs.every(v => v.status === 'not-run')) return 'not run';
    const count = status => runs.flatMap(v => (v.findings ?? []).filter(f => f.status === status)).length;
    const errors = runs.filter(v => v.status === 'error' || v.status === 'not-run').length;
    return [count('open') ? `${count('open')} open` : 'pass', count('expected') ? `${count('expected')} accepted` : '', errors ? `${errors} case(s) not captured` : '']
      .filter(Boolean).join(', ');
  };
  const kinds = {};
  for (const row of report.rows) for (const [platform, v] of Object.entries(row.platforms ?? {}))
    for (const f of v.findings ?? []) if (f.status === 'open') kinds[`${platform} ${f.kind}`] = (kinds[`${platform} ${f.kind}`] ?? 0) + 1;
  const name = args['link-base'] ? `[\`${tag}\`](${args['link-base']}/${tag}/accessibility/report.md)` : `\`${tag}\``;
  lines.push(`| ${name} | ${report.rows.length} | ${cell('macos')} | ${cell('ios')} | ${cell('android')} | ${Object.entries(kinds).map(([k, n]) => `${k} ×${n}`).join('; ') || '—'} |`);
}
console.log(lines.join('\n'));
