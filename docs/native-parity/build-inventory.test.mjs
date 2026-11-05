import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory, dependencyClosure, initialLedger } from './build-inventory.mjs';

test('dependency closure handles cycles, excludes the subject and retains supporting children', () => {
  const edges = new Map([['parent', ['child']], ['child', ['parent', 'helper']], ['helper', []]]);
  assert.deepEqual(dependencyClosure('parent', edges), ['child', 'helper']);
});

test('inventory follows actual navigation and cannot promote support claims to parity evidence', async () => {
  const inventory = await buildInventory({ capturedAt: '2026-10-20T00:00:00.000Z' });
  assert.equal(inventory.scope.visibleCount, inventory.scope.visibleTags.length);
  assert.equal(new Set(inventory.scope.visibleTags).size, inventory.scope.visibleCount);
  assert.equal(inventory.scope.sourceTagCount, inventory.components.length);
  assert.equal(inventory.scope.supportingTags.length + inventory.scope.visibleCount, inventory.scope.sourceTagCount);
  assert.equal(inventory.summary.acceptedComponents, 0);
  assert.ok(inventory.scope.supportingTags.every(item => item.requiredByVisibleScope));
  for (const component of inventory.components) {
    assert.equal(component.audit.current, 'pending');
    assert.equal(component.audit.gates.iosRuntime, 'pending');
    assert.equal(component.audit.gates.independentFinalAudit, 'pending');
    assert.deepEqual(component.audit.gates.exceptions, []);
    for (const platform of ['ios', 'android']) {
      const support = component.native[platform].currentDeclaredSupport;
      for (const family of ['Properties', 'Events', 'Methods', 'Slots']) {
        const key = family.toLowerCase(), supported = new Set(support[key]);
        assert.deepEqual(support[`unsupported${family}`], component.contract[key].map(item => item.name).filter(name => !supported.has(name)));
      }
    }
  }
  const button = inventory.components.find(item => item.tag === 'md-button');
  assert.equal(button.contract.actualCssHooks.length, 28);
  assert.ok(button.contract.actualCssHooks.includes('--md-button-min-width'));
  assert.equal(button.audit.priorEvidence[0].status, 'prior-task-reported');
  assert.match(initialLedger(inventory), /iOS simulator\/device runtime remains unverified/);
});
