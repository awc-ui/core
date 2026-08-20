import { test as baseTest, expect } from '@playwright/experimental-ct-react';
import { addCoverageReport } from 'monocart-reporter';

export const test = baseTest.extend({
  autoTestFixture: [async ({ page }, use) => {
    await Promise.all([
      page.coverage.startJSCoverage({ resetOnNavigation: false }),
      page.coverage.startCSSCoverage({ resetOnNavigation: false }),
    ]);

    await use('autoTestFixture');

    const [jsCoverage, cssCoverage] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage(),
    ]);
    const coverageList = [...jsCoverage, ...cssCoverage];
    await addCoverageReport(coverageList, baseTest.info());
  }, { auto: true }],
});

export { expect };
