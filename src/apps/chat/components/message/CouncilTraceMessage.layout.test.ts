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
  const leaderRowSx = getCouncilTraceLeaderRowSx();
  assert.equal(leaderRowSx.display, 'grid');
  assert.equal(leaderRowSx.gridTemplateColumns, 'minmax(0, 1fr)');
  assert.equal(leaderRowSx.justifyItems, 'center');

  const leaderCardSx = getCouncilTraceAgentCardSx('leader');
  assert.equal(leaderCardSx.display, 'grid');
  assert.equal(leaderCardSx.gap, 1);
  assert.equal(leaderCardSx.position, 'relative');
  assert.equal(leaderCardSx.width, '100%');
  assert.equal(leaderCardSx.maxWidth, '48rem');
  assert.equal(leaderCardSx.minWidth, 0);
  assert.equal(leaderCardSx.borderRadius, 'md');
  assert.equal(leaderCardSx.border, '1px solid');
  assert.equal(leaderCardSx.borderColor, 'var(--trace-card-accentBorder)');
  assert.equal(leaderCardSx.background, 'linear-gradient(180deg, var(--trace-card-accentBg) 0%, var(--joy-palette-background-surface) 44%)');
  assert.equal(leaderCardSx.boxShadow, 'sm');
  assert.equal(leaderCardSx.p, 1.1);
});

test('reviewer row stays side by side inside a horizontal overflow container with capped columns', () => {
  const scrollerSx = getCouncilTraceReviewerRowScrollerSx();
  assert.equal(scrollerSx.overflowX, 'auto');
  assert.deepStrictEqual(scrollerSx.mx, { xs: -0.25, md: 0 });
  assert.equal(scrollerSx.pb, 0.5);
  assert.equal(scrollerSx.scrollbarWidth, 'thin');

  const reviewerRowSx = getCouncilTraceReviewerRowSx(3);
  assert.equal(reviewerRowSx.display, 'grid');
  assert.equal(reviewerRowSx.gap, 1);
  assert.equal(reviewerRowSx.alignItems, 'start');
  assert.deepStrictEqual(reviewerRowSx.gridAutoFlow, { xs: 'row', md: 'column' });
  assert.deepStrictEqual(reviewerRowSx.gridTemplateColumns, { xs: 'minmax(0, 1fr)', md: 'none' });
  assert.deepStrictEqual(reviewerRowSx.gridAutoColumns, { md: 'minmax(18rem, 22rem)' });
  assert.deepStrictEqual(reviewerRowSx.minWidth, { xs: 0, md: 'max-content' });

  const reviewerCardSx = getCouncilTraceAgentCardSx('reviewer');
  assert.equal(reviewerCardSx.display, 'grid');
  assert.equal(reviewerCardSx.gap, 1);
  assert.equal(reviewerCardSx.position, 'relative');
  assert.equal(reviewerCardSx.width, '100%');
  assert.equal(reviewerCardSx.maxWidth, '22rem');
  assert.deepStrictEqual(reviewerCardSx.minWidth, { xs: 0, md: '18rem' });
  assert.equal(reviewerCardSx.borderRadius, 'md');
  assert.equal(reviewerCardSx.border, '1px solid');
  assert.equal(reviewerCardSx.borderColor, 'var(--trace-card-accentBorder)');
  assert.equal(reviewerCardSx.background, 'linear-gradient(180deg, var(--trace-card-accentBg) 0%, var(--joy-palette-background-surface) 44%)');
  assert.equal(reviewerCardSx.boxShadow, 'sm');
  assert.equal(reviewerCardSx.p, 1.1);
});

test('council trace status tone maps accepted, interrupted, stopped, and exhausted states distinctly', () => {
  assert.equal(getCouncilTraceStatusTone('accepted'), 'success');
  assert.equal(getCouncilTraceStatusTone('interrupted'), 'warning');
  assert.equal(getCouncilTraceStatusTone('stopped'), 'danger');
  assert.equal(getCouncilTraceStatusTone('exhausted'), 'danger');
  assert.equal(getCouncilTraceStatusTone('reviewing'), 'primary');
  assert.equal(getCouncilTraceStatusTone('awaiting-leader-revision'), 'neutral');
});
