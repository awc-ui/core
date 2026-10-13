const coverageDirectories = [
  ['unit', 'packages/core/coverage-spec'],
  ['e2e', 'packages/core/coverage-e2e'],
  ['component', 'apps/storybook/coverage-stories'],
  ...['react', 'vue', 'svelte', 'angular'].map(framework => [framework === 'angular' ? 'e2e' : 'component', `apps/test-${framework}/coverage-native`]),
];

export const coverageReports = coverageDirectories.flatMap(([category, directory]) => [
  { category, path: `${directory}/lcov.info`, format: 'lcov' },
  { category, path: `${directory}/coverage-final.json`, format: 'istanbul' },
  { category, path: `${directory}/coverage-summary.json`, format: 'istanbul-summary' },
]);

export const executionReports = [
  ...['spec', 'e2e'].flatMap(kind => ['test-results.json', 'results.json'].map(name => ({
    category: kind === 'spec' ? 'unit' : 'e2e', path: `packages/core/coverage-${kind}/${name}`, framework: 'jest', base: 'packages/core',
  }))),
  ...['test-results.json', 'results.json'].map(name => ({ category: 'component', path: `apps/storybook/coverage-stories/${name}`, framework: 'vitest', base: 'apps/storybook' })),
  ...['react', 'vue', 'svelte', 'angular'].flatMap(framework => [
    `apps/test-${framework}/coverage-native/results.json`, `apps/test-${framework}/test-results/results.json`,
  ].map(file => ({ category: framework === 'angular' ? 'e2e' : 'component', path: file, framework: 'playwright', base: `apps/test-${framework}/e2e` }))),
];

/** Report paths are metadata, never arbitrary files to open or code to execute. */
export function reportSourcePath(value, base = 'packages/core') {
  if (typeof value !== 'string' || value.length > 4096 || value.includes('\0')) return null;
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalized.split('/').includes('..')) return null;
  const marker = /(?:^|\/)((?:packages\/core|apps\/(?:storybook|test-(?:react|vue|svelte|angular)))\/.+)$/.exec(normalized);
  const relative = marker?.[1] || (!normalized.startsWith('/') && !/^[a-z]:/i.test(normalized) ? `${base}/${normalized}` : '');
  return relative && !relative.split('/').some(part => part.startsWith('.')) ? relative : null;
}

function componentSource(value, tags) {
  const file = reportSourcePath(value);
  const tag = /^packages\/core\/src\/components\/(md-[a-z0-9-]+)\/.+\.tsx?$/.exec(file || '')?.[1];
  return tag && tags.has(tag) && !/\.(?:spec|e2e|d)\.tsx?$/.test(file) ? { file, tag } : null;
}
const validCount = value => Number.isSafeInteger(value) && value >= 0;
const percent = (covered, total) => total ? Math.round(covered * 10000 / total) / 100 : null;
export function coverageMetric(values) {
  const total = values.size, covered = [...values.values()].filter(hits => hits > 0).length;
  return { total, covered, percent: percent(covered, total) };
}
const emptyCoverage = () => ({ lines: new Map(), branches: new Map(), functions: new Map(), statements: new Map(), files: new Set() });
function addHit(map, key, hits) { if (validCount(hits)) map.set(key, Math.max(map.get(key) || 0, hits)); }

export function parseLCOV(text, tags) {
  const result = new Map(); let current;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const source = componentSource(line.slice(3), tags); current = null;
      if (!source) continue;
      current = { ...source, data: emptyCoverage() }; current.data.files.add(source.file);
    } else if (line === 'end_of_record') {
      if (current) {
        if (!result.has(current.tag)) result.set(current.tag, emptyCoverage());
        const data = result.get(current.tag); data.files.add(current.file);
        for (const name of ['lines', 'branches', 'functions']) for (const [key, hits] of current.data[name]) addHit(data[name], key, hits);
      }
      current = null;
    }
    else if (current) {
      const colon = line.indexOf(':'), prefix = line.slice(0, colon), value = line.slice(colon + 1);
      let key, hits;
      if (prefix === 'DA') { const parts = value.split(','); key = parts[0]; hits = Number(parts[1]); if (!/^[1-9]\d*$/.test(key)) continue; }
      else if (prefix === 'BRDA') { const parts = value.split(','); if (parts.length !== 4 || !parts.slice(0, 3).every(part => /^\d+$/.test(part))) continue; key = parts.slice(0, 3).join(','); hits = parts[3] === '-' ? 0 : Number(parts[3]); }
      else if (prefix === 'FNDA') { const comma = value.indexOf(','); if (comma < 1) continue; hits = Number(value.slice(0, comma)); key = value.slice(comma + 1); }
      else continue;
      if (!key) continue;
      addHit(current.data[prefix === 'DA' ? 'lines' : prefix === 'BRDA' ? 'branches' : 'functions'], `${current.file}:${key}`, hits);
    }
  }
  return new Map([...result].map(([tag, data]) => [tag, { lines: coverageMetric(data.lines), branches: coverageMetric(data.branches), functions: coverageMetric(data.functions), sourceFiles: [...data.files].sort() }]));
}

export function parseIstanbul(text, tags, summary = false) {
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return new Map();
  const result = new Map(), summaries = new Map();
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const source = componentSource(entry.path || key, tags);
    if (!source) continue;
    const keyedSource = componentSource(key, tags);
    if (keyedSource && keyedSource.file !== source.file) continue;
    if (summary) {
      const metrics = {};
      for (const name of ['lines', 'branches', 'functions', 'statements']) {
        const metric = entry[name];
        if (!metric || !validCount(metric.total) || !validCount(metric.covered) || metric.covered > metric.total) continue;
        metrics[name] = { total: metric.total, covered: metric.covered };
      }
      if (Object.keys(metrics).length) summaries.set(source.file, { tag: source.tag, metrics });
      continue;
    }
    if (!result.has(source.tag)) result.set(source.tag, emptyCoverage());
    const data = result.get(source.tag); data.files.add(source.file);
    for (const [id, hits] of Object.entries(entry.s || {})) {
      const line = entry.statementMap?.[id]?.start?.line;
      if (!Number.isSafeInteger(line) || line <= 0 || !validCount(hits)) continue;
      addHit(data.statements, `${source.file}:${id}`, hits);
      // Istanbul line coverage uses the maximum statement hit count at its start line.
      addHit(data.lines, `${source.file}:${line}`, hits);
    }
    for (const [id, hits] of Object.entries(entry.f || {})) {
      if (entry.fnMap && Object.hasOwn(entry.fnMap, id)) addHit(data.functions, `${source.file}:${id}`, hits);
    }
    for (const [id, hits] of Object.entries(entry.b || {})) {
      if (!Array.isArray(hits) || !Array.isArray(entry.branchMap?.[id]?.locations) || hits.length !== entry.branchMap[id].locations.length) continue;
      hits.forEach((count, index) => addHit(data.branches, `${source.file}:${id}:${index}`, count));
    }
  }
  if (summary) {
    for (const [file, { tag, metrics }] of summaries) {
      if (!result.has(tag)) result.set(tag, { sourceFiles: [] });
      const data = result.get(tag); data.sourceFiles.push(file);
      for (const [name, metric] of Object.entries(metrics)) {
        data[name] ||= { total: 0, covered: 0 };
        data[name].total += metric.total; data[name].covered += metric.covered;
        data[name].percent = percent(data[name].covered, data[name].total);
      }
    }
    return result;
  }
  return new Map([...result].map(([tag, data]) => [tag, { ...Object.fromEntries(['lines', 'branches', 'functions', 'statements'].map(name => [name, coverageMetric(data[name])])), sourceFiles: [...data.files].sort() }]));
}

function resultStatus(status) {
  if (status === 'passed') return 'passed';
  if (['failed', 'timedOut', 'interrupted'].includes(status)) return 'failed';
  if (['skipped', 'pending', 'todo', 'disabled'].includes(status)) return 'skipped';
  return 'unknown';
}

/** Preserve case-level outcomes; report-wide success never substitutes for them. */
export function parseExecutionReport(text, descriptor) {
  const report = JSON.parse(text), suites = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) return suites;
  if (descriptor.framework !== 'playwright') {
    for (const suite of Array.isArray(report.testResults) ? report.testResults : []) {
      const file = reportSourcePath(suite.name || suite.testFilePath, descriptor.base);
      if (!file || !Array.isArray(suite.assertionResults)) continue;
      suites.push({ file, failedSuite: suite.status === 'failed', tests: suite.assertionResults.filter(item => item && typeof item === 'object').map(item => ({
        name: typeof item.fullName === 'string' ? item.fullName : [...(Array.isArray(item.ancestorTitles) ? item.ancestorTitles : []), item.title || ''].join(' '),
        title: typeof item.title === 'string' ? item.title : '', status: resultStatus(item.status), flaky: false,
      })) });
    }
  } else {
    const reportedBase = reportSourcePath(report.config?.rootDir);
    const base = reportedBase || descriptor.base;
    function visit(suite, depth = 0, ancestors = []) {
      if (!suite || depth > 30) return;
      const titles = typeof suite.title === 'string' ? [...ancestors, suite.title] : ancestors;
      for (const spec of Array.isArray(suite.specs) ? suite.specs : []) {
        const file = reportSourcePath(spec.file || suite.file, base);
        if (!file || !Array.isArray(spec.tests)) continue;
        const tests = spec.tests.filter(item => item && typeof item === 'object' && Array.isArray(item.results) && item.results.length).map(item => {
          const last = Array.isArray(item.results) ? item.results.at(-1) : null;
          const outcome = !last ? 'unknown' : last.status === 'skipped' ? 'skipped' : ['expected', 'flaky'].includes(item.status) ? 'passed' : item.status === 'unexpected' ? 'failed' : item.status === 'skipped' ? 'skipped'
            : last?.status === item.expectedStatus && last.status !== 'skipped' ? 'passed' : resultStatus(last?.status);
          return { name: [...titles, spec.title || ''].join(' '), title: spec.title || '', status: outcome, flaky: item.status === 'flaky' };
        });
        if (tests.length) suites.push({ file, failedSuite: false, tests });
      }
      for (const child of Array.isArray(suite.suites) ? suite.suites : []) visit(child, depth + 1, titles);
    }
    for (const suite of Array.isArray(report.suites) ? report.suites : []) visit(suite);
  }
  return suites;
}

export function executionSummary(records) {
  const tests = records.flatMap(record => record.tests);
  const counts = { total: tests.length, passed: 0, failed: 0, skipped: 0, unknown: 0, flaky: 0 };
  for (const test of tests) { counts[test.status]++; if (test.flaky) counts.flaky++; }
  const failedSuites = records.filter(record => record.failedSuite).length;
  const status = counts.failed || failedSuites ? 'failed' : counts.unknown || !counts.total ? 'unknown' : counts.passed ? 'passed' : 'skipped';
  return { status, ...counts, failedSuites };
}
