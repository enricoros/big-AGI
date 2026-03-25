import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPerfStatsRegistry,
  createWindowPerfController,
} from './perfRegistry';


test('perf stats registry aggregates sync samples and keeps top operations sorted by total time', () => {
  const registry = createPerfStatsRegistry(() => true, () => 0);
  let now = 0;
  const timingRegistry = createPerfStatsRegistry(() => true, () => now);

  registry.recordDuration('fast', 5);
  registry.recordDuration('slow', 20);
  registry.recordDuration('slow', 10);

  const snapshot = registry.snapshot();
  assert.deepEqual(snapshot.operations.map(operation => operation.name), ['slow', 'fast']);
  assert.equal(snapshot.operations[0]?.count, 2);
  assert.equal(snapshot.operations[0]?.totalMs, 30);
  assert.equal(snapshot.operations[0]?.maxMs, 20);
  assert.equal(snapshot.operations[1]?.minMs, 5);

  now = 10;
  timingRegistry.measureSync('derive', () => {
    now = 27;
  });
  const timedSnapshot = timingRegistry.snapshot();
  assert.equal(timedSnapshot.operations[0]?.name, 'derive');
  assert.equal(timedSnapshot.operations[0]?.totalMs, 17);
});

test('window perf controller toggles profiling and proxies reset and snapshot calls', () => {
  const state = { enabled: false };
  const registry = createPerfStatsRegistry(() => state.enabled, () => 0);
  registry.recordDuration('existing', 7);

  const controller = createWindowPerfController({
    getEnabled: () => state.enabled,
    setEnabled: (enabled) => { state.enabled = enabled; },
    registry,
  });

  assert.equal(controller.enabled(), false);
  controller.enable();
  assert.equal(state.enabled, true);
  assert.equal(controller.enabled(), true);
  assert.equal(controller.snapshot().operations[0]?.name, 'existing');

  controller.reset();
  assert.equal(controller.snapshot().operations.length, 0);

  controller.disable();
  assert.equal(state.enabled, false);
});
