import test from "node:test";
import assert from "node:assert/strict";
import { stations } from "./model.mjs";
import {
  advanceSimulationTime,
  movementRoutes,
  pointAlongRoute,
  simulatedTrains,
  trainAtTime,
} from "./metro-movement.mjs";

test("every train route passes through its station coordinates in order", () => {
  for (const route of movementRoutes) {
    let previous = -1;
    for (const stop of route.stops) {
      assert.ok(stop.distance > previous);
      previous = stop.distance;
      const expected = stations.find((s) => s.id === stop.id);
      const actual = pointAlongRoute(route, stop.distance);
      assert.ok(
        Math.hypot(actual.x - expected.x, actual.y - expected.y) < 0.01,
        stop.name,
      );
    }
  }
});
test("trains dwell at every station, then continue toward the correct next stop", () => {
  for (const route of movementRoutes) {
    for (const phase of route.phases.filter((p) => p.dwelling)) {
      const early = trainAtTime(route, phase.start + 0.1);
      const late = trainAtTime(route, phase.end - 0.1);
      assert.equal(early.position, late.position);
      assert.equal(early.current.id, route.stops[phase.from].id);
      assert.equal(early.next.id, route.stops[phase.from + phase.direction].id);
      const departed = trainAtTime(route, phase.end + 0.1);
      assert.equal(departed.dwelling, false);
      assert.ok((departed.position - early.position) * phase.direction > 0);
    }
  }
});
test("a full journey reverses at both ends and loops without a position jump", () => {
  for (const route of movementRoutes) {
    const terminal = route.phases.find(
      (p) => p.dwelling && p.from === route.stops.length - 1,
    );
    const arrived = trainAtTime(route, terminal.start + 0.1);
    assert.equal(arrived.direction, -1);
    assert.equal(arrived.destination.id, route.stops[0].id);
    const returned = trainAtTime(route, route.duration + 0.1);
    assert.equal(returned.position, 0);
    assert.equal(returned.direction, 1);
    assert.deepEqual(returned, trainAtTime(route, 0.1));
  }
});
test("pause freezes the clock and speed changes preserve elapsed position", () => {
  assert.equal(advanceSimulationTime(15, 60000, 4, false), 15);
  assert.equal(advanceSimulationTime(15, 500, 1, true), 15.5);
  assert.equal(advanceSimulationTime(15.5, 500, 4, true), 17.5);
  assert.equal(advanceSimulationTime(15, -100, 1, true), 15);
});
test("six individually labeled trains have two distinct phases per line", () => {
  assert.equal(simulatedTrains.length, 6);
  assert.equal(new Set(simulatedTrains.map((t) => t.id)).size, 6);
  for (const route of movementRoutes) {
    const pair = simulatedTrains.filter((t) => t.line === route.id);
    assert.equal(pair.length, 2);
    assert.notEqual(
      trainAtTime(route, 0, pair[0].offset).position,
      trainAtTime(route, 0, pair[1].offset).position,
    );
  }
});
