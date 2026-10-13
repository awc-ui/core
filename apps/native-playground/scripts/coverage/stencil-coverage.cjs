const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { canonicalSourceMap } = require('./source-maps.cjs');
const root = path.resolve(__dirname, '../../../..');
const output = process.env.AWC_COVERAGE_E2E_OUTPUT || path.join(root, 'packages/core/coverage-e2e');
let sequence = 0;
// Jest reuses worker PIDs but reloads this setup module for every suite.
// A suite token prevents sequence zero from replacing an earlier suite's data.
const captureId = randomUUID();
const createPage = global.__NEW_TEST_PAGE__;
if (typeof createPage !== 'function') throw new Error('Coverage collection requires the Stencil E2E environment.');

global.__NEW_TEST_PAGE__ = async (...args) => {
  const page = await createPage(...args);
  await page.coverage.startJSCoverage({ resetOnNavigation: false, includeRawScriptCoverage: true });
  const close = page.close.bind(page);
  let collected = false;
  page.close = async (...closeArgs) => {
    if (!collected && !page.isClosed()) {
      collected = true;
      const entries = await page.coverage.stopJSCoverage();
      const converted = entries.map(entry => {
        let source = entry.text;
        const match = /\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/.exec(source);
        if (match && !match[1].startsWith('data:')) {
          const pathname = decodeURIComponent(new URL(match[1], entry.url).pathname);
          const filename = path.resolve(output, 'www', `.${pathname}`);
          if (filename.startsWith(path.join(output, 'www') + path.sep) && fs.existsSync(filename)) {
            const map = canonicalSourceMap(JSON.parse(fs.readFileSync(filename, 'utf8')), root, filename);
            source = source.replace(match[0], `//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}`);
          }
        }
        return { ...entry.rawScriptCoverage, url: entry.url, source };
      });
      fs.mkdirSync(path.join(output, 'raw'), { recursive: true });
      fs.writeFileSync(path.join(output, 'raw', `${process.pid}-${captureId}-${sequence++}.json`), JSON.stringify(converted));
    }
    return close(...closeArgs);
  };
  return page;
};
