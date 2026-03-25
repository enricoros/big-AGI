import assert from 'node:assert/strict';
import test from 'node:test';

import { getNextAutoExpandedRounds } from './CouncilTraceMessage.rounds';


test('council trace auto-collapse preserves rounds the user expanded manually', () => {
  assert.deepStrictEqual(
    [...getNextAutoExpandedRounds({
      previousExpandedRounds: new Set([0, 1]),
      latestRoundIndex: 2,
      autoCollapsePreviousRounds: true,
      autoExpandNewestRound: true,
      manuallyExpandedRounds: new Set([0]),
    })].sort((a, b) => a - b),
    [0, 2],
  );
});

test('council trace auto-collapse still removes non-manual previous rounds', () => {
  assert.deepStrictEqual(
    [...getNextAutoExpandedRounds({
      previousExpandedRounds: new Set([0, 1]),
      latestRoundIndex: 2,
      autoCollapsePreviousRounds: true,
      autoExpandNewestRound: true,
      manuallyExpandedRounds: new Set(),
    })].sort((a, b) => a - b),
    [2],
  );
});
