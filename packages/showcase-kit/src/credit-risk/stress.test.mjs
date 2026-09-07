import test from 'node:test';
import assert from 'node:assert/strict';
import { getStressScenarios } from '../../dist/data/index.mjs';
import {
  stressBriefing,
  stressScenarioCsv,
  stressScenarioDownload,
} from '../../dist/credit-risk/index.mjs';

test('scenario CSV exports every sector and the exact fixture totals', () => {
  for (const scenario of getStressScenarios()) {
    const csv = stressScenarioCsv(scenario);
    const rows = csv
      .trim()
      .split('\r\n')
      .map((line) => line.split(',').map((cell) => cell.slice(1, -1)));
    assert.equal(rows.length, scenario.bySector.length + 2);
    assert.deepEqual(rows[1].slice(0, 3), [scenario.id, scenario.bySector[0].sectorId, 'EUR']);
    assert.equal(Number(rows.at(-1)[4]), scenario.totals.expectedLoss);
    assert.equal(Number(rows.at(-1)[5]), scenario.totals.expectedLossDelta);
    assert.equal(Number(rows.at(-1)[8]), scenario.totals.weightedAvgPd);
    assert.ok(rows.every((row) => row.length === rows[0].length));
    const download = stressScenarioDownload(scenario);
    assert.equal(decodeURIComponent(download.href.split(',').slice(1).join(',')), csv);
    assert.ok(download.filename.includes(scenario.id));
  }
});

test('briefings localize all three scenarios and reflect changing losses', () => {
  const scenarios = getStressScenarios();
  for (const locale of ['en', 'ro', 'ar']) {
    const briefings = scenarios.map((scenario) => stressBriefing(scenario, locale));
    assert.equal(briefings[0].items.length, 3);
    assert.equal(new Set(briefings.map((brief) => brief.items[0].value)).size, scenarios.length);
    for (const brief of briefings) {
      assert.ok(brief.items.every((item) => item.label && item.value && item.detail));
      if (locale === 'ar') assert.match(brief.title + brief.exportLabel, /[\u0600-\u06ff]/);
    }
  }
});
