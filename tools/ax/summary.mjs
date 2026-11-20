#!/usr/bin/env node
// Markdown summary of tools/ax reports: one row per component with each platform's status and the open finding kinds.
// node tools/ax/summary.mjs --out <reports dir> [--tags md-a,md-b] [--link-base ../../outputs/native-parity] [--layout flat|evidence]
// node tools/ax/summary.mjs --roles   (the per-platform role table, from normalize.mjs ROLE_TABLE)
//   flat (default): <out>/<tag>/report.json (run.mjs --out); evidence: <out>/<tag>/accessibility/report.json (published evidence).
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ROLE_TABLE } from './normalize.mjs';
import { LANDED, CASES } from './cases.mjs';

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

// S7-19-01 (9-42): a report with fewer cases than asked, a partly captured platform or no report at all is a FAIL, printed with both numbers; exit 1.
const failures = [], required = (args.require ?? '').split(',').filter(Boolean);
const lines = ['| Component | Cases | macOS | iOS | Android | Open findings |', '| --- | --- | --- | --- | --- | --- |'];
for (const tag of tags) {
  let report;
  try { report = JSON.parse(await readFile(reportPath(tag), 'utf8')); } catch (e) { if (args.tags) failures.push(`${tag}: report missing, empty or unreadable (${reportPath(tag)})`); continue; }
  const asked = (CASES[tag] ?? []).length;
  if (!report.rows?.length || (asked && report.rows.length !== asked)) failures.push(`${tag}: report has ${report.rows?.length ?? 0} of ${asked} cases`);
  const cell = platform => {
    if (LANDED[tag] && !LANDED[tag].includes(platform)) return 'not landed';
    const runs = report.rows.map(r => r.platforms?.[platform]).filter(Boolean);
    if (!runs.length || runs.every(v => v.status === 'not-run')) { if (required.includes(platform)) { failures.push(`${tag} ${platform}: 0 of ${report.rows.length} cases captured`); return 'FAIL not captured'; } return 'not run'; }
    const okRuns = runs.filter(v => v.status === 'pass' || v.status === 'findings').length;
    if (okRuns !== report.rows.length) failures.push(`${tag} ${platform}: ${okRuns} of ${report.rows.length} cases captured`);
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
if (!tags.length || lines.length === 2) failures.push(`no report found under ${out}`);
console.log(lines.join('\n'));
if (failures.length) { for (const f of failures) console.log(`FAIL ${f}`); console.log(`FAIL summary: ${failures.length} capture failure(s)`); process.exitCode = 1; }
