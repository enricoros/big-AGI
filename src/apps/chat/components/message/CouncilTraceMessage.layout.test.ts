import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCouncilTraceAgentCardSx,
  getCouncilTraceLeaderRowSx,
  getCouncilTraceReviewerRowScrollerSx,
  getCouncilTraceReviewerRowSx,
  getCouncilTraceStatusTone,
} from './CouncilTraceMessage.layout';

test('leader row centers the leader card and caps its readable width', () => {
  assert.deepStrictEqual(getCouncilTraceLeaderRowSx(), {
    display: 'flex',
    justifyContent: 'center',
  });

  assert.deepStrictEqual(getCouncilTraceAgentCardSx('leader'), {
    display: 'grid',
    gap: 1,
    width: '100%',
    maxWidth: '46rem',
    minWidth: 0,
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.surface',
    p: 1,
  });
});

test('reviewer row stays side by side inside a horizontal overflow container with capped columns', () => {
  assert.deepStrictEqual(getCouncilTraceReviewerRowScrollerSx(), {
    overflowX: 'auto',
    pb: 0.5,
  });

  assert.deepStrictEqual(getCouncilTraceReviewerRowSx(3), {
    display: 'grid',
    gap: 1,
    alignItems: 'start',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(18rem, 22rem)',
    minWidth: 'max-content',
  });

  assert.deepStrictEqual(getCouncilTraceAgentCardSx('reviewer'), {
    display: 'grid',
    gap: 1,
    width: '22rem',
    maxWidth: '22rem',
    minWidth: '18rem',
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'background.surface',
    p: 1,
  });
});

test('council trace status tone maps accepted, interrupted, stopped, and exhausted states distinctly', () => {
  assert.equal(getCouncilTraceStatusTone('accepted'), 'success');
  assert.equal(getCouncilTraceStatusTone('interrupted'), 'warning');
  assert.equal(getCouncilTraceStatusTone('stopped'), 'danger');
  assert.equal(getCouncilTraceStatusTone('exhausted'), 'danger');
  assert.equal(getCouncilTraceStatusTone('reviewing'), 'primary');
  assert.equal(getCouncilTraceStatusTone('awaiting-leader-revision'), 'neutral');
});
