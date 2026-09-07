import assert from 'node:assert/strict';
import { isRebalanceFilter, rebalanceQueue } from '@awc-ui/showcase-kit/wealth';

const all = rebalanceQueue();
const breach = rebalanceQueue('breach');
const drifted = rebalanceQueue('drifted');
assert.equal(all.length, 7);
assert.deepEqual(
  breach.map((row) => row.household.id),
  ['hh-06', 'hh-04'],
);
assert.equal(drifted.length, 5);
assert.ok(breach.every((row) => row.breachCount > 0 && row.worst.status === 'breach'));
assert.ok(drifted.every((row) => row.breachCount === 0 && row.worst.status === 'drifted'));
const ids = [...breach, ...drifted].map((row) => row.household.id);
assert.equal(new Set(ids).size, all.length);
assert.deepEqual(new Set(ids), new Set(all.map((row) => row.household.id)));
for (const queue of [all, breach, drifted]) {
  assert.ok(queue.every((row, i) => i === 0 || row.worst.absDrift <= queue[i - 1].worst.absDrift));
}
assert.deepEqual(rebalanceQueue(), all);
assert.equal(isRebalanceFilter('breach'), true);
assert.equal(isRebalanceFilter('unknown'), false);
console.log(
  'Rebalancing queues: 7 mandates partition into 2 urgent and 5 drifted without duplicates; priority order preserved.',
);
