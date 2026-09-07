import assert from 'node:assert/strict';
import {
  BALANCE_WINDOWS,
  balanceHistory,
  balanceHistoryCopy,
  isBalanceWindow,
} from '@awc-ui/showcase-kit/banking';

const expected = [
  { months: 3, start: '2026-06', change: 1701.73 },
  { months: 6, start: '2026-03', change: 7058.44 },
  { months: 12, start: '2025-09', change: 14169.55 },
];
assert.deepEqual(
  BALANCE_WINDOWS,
  expected.map((row) => row.months),
);
for (const row of expected) {
  const history = balanceHistory(row.months);
  assert.equal(history.points.length, row.months);
  assert.equal(history.points[0].month, row.start);
  assert.equal(history.points.at(-1).month, '2026-08');
  assert.equal(history.points.at(-1).balanceEur, 18204.17);
  assert.ok(Math.abs(history.change - row.change) < 0.001);
  assert.equal(history.total, 12);
}
for (const invalid of [0, -3, 3.5, 100, NaN]) {
  assert.equal(isBalanceWindow(invalid), false);
  assert.deepEqual(balanceHistory(invalid), balanceHistory(12));
}
assert.match(balanceHistoryCopy('ar').period, /[\u0600-\u06ff]/);
assert.notEqual(balanceHistoryCopy('ro').change, balanceHistoryCopy('en').change);
assert.deepEqual(balanceHistoryCopy('unsupported'), balanceHistoryCopy('en'));
console.log('Balance history: 3 window totals, invalid inputs, and all translated labels passed.');
