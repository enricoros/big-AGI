import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCouncilTraceBoardGridSx,
  getCouncilTraceBoardScrollerSx,
  getCouncilTraceStatusTone,
} from './CouncilTraceMessage.layout';

test('reviewer-heavy rounds keep side-by-side cards inside a horizontal overflow container', () => {
  assert.deepStrictEqual(getCouncilTraceBoardScrollerSx(5), {
    overflowX: 'auto',
    pb: 0.5,
  });

  assert.deepStrictEqual(getCouncilTraceBoardGridSx(5), {
    display: 'grid',
    gap: 1,
    alignItems: 'start',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(16rem, 1fr)',
    minWidth: 'max-content',
  });
});

test('compact reviewer rounds keep the board inline without forced horizontal scrolling', () => {
  assert.deepStrictEqual(getCouncilTraceBoardScrollerSx(3), {
    overflowX: 'visible',
    pb: 0,
  });

  assert.deepStrictEqual(getCouncilTraceBoardGridSx(3), {
    display: 'grid',
    gap: 1,
    alignItems: 'start',
    gridTemplateColumns: {
      xs: '1fr',
      md: 'repeat(3, minmax(0, 1fr))',
    },
  });
});

test('council trace status tone maps accepted, interrupted, and exhausted states distinctly', () => {
  assert.equal(getCouncilTraceStatusTone('accepted'), 'success');
  assert.equal(getCouncilTraceStatusTone('interrupted'), 'warning');
  assert.equal(getCouncilTraceStatusTone('exhausted'), 'danger');
  assert.equal(getCouncilTraceStatusTone('reviewing'), 'primary');
  assert.equal(getCouncilTraceStatusTone('awaiting-leader-revision'), 'neutral');
});
