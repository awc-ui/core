/**
 * Spec-suite coverage, run through jest DIRECTLY.
 *
 * `stencil test --spec --coverage` wedges (0% CPU, no output, never recovers)
 * and ignores test-path patterns. Driving jest with the Stencil preset does
 * work — the preset supplies its own testRegex, so pass path patterns as CLI
 * positionals rather than adding testMatch here.
 *
 * Coverage is collected in V8 format so it can be MERGED with the story and
 * e2e sweeps (see scripts/merge-coverage.mjs) rather than reported as a third
 * unrelated number.
 */
module.exports = {
  preset: '@stencil/core/testing',
  rootDir: __dirname,
  moduleNameMapper: {
    '^echarts(/.*)?$': '<rootDir>/test/__mocks__/echarts-stub.ts',
  },
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage-spec',
  coverageReporters: ['json', 'lcovonly', 'text-summary'],
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    'src/utils/**/*.ts',
    '!src/**/*.spec.*',
    '!src/**/*.e2e.*',
    '!src/**/*.d.ts',
  ],
  /**
   * Only real spec files. The Stencil preset ships a loose testRegex that also
   * matched `charts/engine/hit-test.ts` (a SOURCE file) and
   * `md-accordion/test-utils/axe-spec.ts` (a helper), reporting both as suites
   * that "must contain at least one test" — two phantom failures in every run.
   */
  testRegex: '\\.spec\\.(ts|tsx)$',
  testMatch: undefined,
  maxWorkers: 2,
  /**
   * Several suites wait on real animation durations (panel close 250ms, bloom
   * 500ms). Alone md-date-picker takes 96s; sharing two workers it takes 184s,
   * and at jest's 5s default the slowest of those waits starts timing out from
   * contention alone. Raised so a timeout means "hung", not "busy machine".
   */
  testTimeout: 20000,
};
