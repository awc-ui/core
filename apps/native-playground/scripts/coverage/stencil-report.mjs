import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { completeSourceCoverage } from './complete-source-coverage.cjs';

/** Convert retained browser captures without rerunning tests or changing outcomes. */
export async function collectStencilReport({ repository, output, tags, name = 'Existing Stencil browser tests', reportDirectory = path.join(output, 'report') }) {
  const require = createRequire(path.join(repository, 'packages/core/package.json'));
  const { CoverageReport } = require('monocart-coverage-reports');
  const raw = path.join(output, 'raw');
  const files = (await fs.readdir(raw).catch(() => [])).filter(file => file.endsWith('.json')).sort();
  if (!files.length) throw new Error('No browser coverage was captured; no LCOV result is generated.');
  const observedEntries = [], observedUrls = new Set();
  const report = new CoverageReport({
    name, outputDir: reportDirectory,
    reports: ['v8', 'console-summary', 'lcovonly'], logging: 'error',
    ...completeSourceCoverage({ repository, runtime: path.join(output, 'www/build'), tags, observedEntries }),
  });
  for (const filename of files) {
    const entries = JSON.parse(await fs.readFile(path.join(raw, filename), 'utf8'));
    for (const entry of entries) {
      if (!entry.functions?.length || observedUrls.has(entry.url)) continue;
      observedEntries.push(entry);
      observedUrls.add(entry.url);
    }
    await report.add(entries);
  }
  await report.generate();
  return path.join(reportDirectory, 'lcov.info');
}
