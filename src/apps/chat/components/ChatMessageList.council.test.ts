import assert from 'node:assert/strict';
import test from 'node:test';

import { getCouncilGroupLabel, getNextAutoExpandedCouncilGroupKeys } from './ChatMessageList.council';


test('auto-expansion does not reset when the latest council group key is unchanged', () => {
  assert.equal(getNextAutoExpandedCouncilGroupKeys({
    previousLatestCouncilGroupKey: 'council-pass-phase-1-0',
    latestCouncilGroupKey: 'council-pass-phase-1-0',
    showCouncilDeliberation: true,
    hasCouncilTrace: false,
  }), null);
});

test('auto-expansion opens the newest group when a new council pass appears', () => {
  assert.deepEqual(getNextAutoExpandedCouncilGroupKeys({
    previousLatestCouncilGroupKey: 'council-pass-phase-1-0',
    latestCouncilGroupKey: 'council-pass-phase-1-1',
    showCouncilDeliberation: true,
    hasCouncilTrace: false,
  }), new Set(['council-pass-phase-1-1']));
});

test('auto-expansion stays inactive while deliberation is hidden or replaced by the council trace', () => {
  assert.equal(getNextAutoExpandedCouncilGroupKeys({
    previousLatestCouncilGroupKey: null,
    latestCouncilGroupKey: 'council-pass-phase-1-0',
    showCouncilDeliberation: false,
    hasCouncilTrace: false,
  }), null);

  assert.equal(getNextAutoExpandedCouncilGroupKeys({
    previousLatestCouncilGroupKey: null,
    latestCouncilGroupKey: 'council-pass-phase-1-0',
    showCouncilDeliberation: true,
    hasCouncilTrace: true,
  }), null);
});

test('council group labels use round naming', () => {
  assert.equal(getCouncilGroupLabel(0), 'Round 1');
  assert.equal(getCouncilGroupLabel(2), 'Round 3');
  assert.equal(getCouncilGroupLabel(null), '');
});
