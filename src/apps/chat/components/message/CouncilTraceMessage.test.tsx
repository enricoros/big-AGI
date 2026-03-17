import assert from 'node:assert/strict';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { CouncilTraceRenderItem } from '../ChatMessageList.councilTrace';

import { CouncilTraceMessage } from './CouncilTraceMessage';


const trace: CouncilTraceRenderItem = {
  phaseId: 'phase-1',
  placement: {
    mode: 'before-message',
    anchorMessageId: 'result-1',
  },
  reviewerCount: 2,
  totalRounds: 2,
  summaryStatus: 'accepted',
  rounds: [
    {
      roundIndex: 1,
      defaultExpanded: true,
      proposalId: 'proposal-2',
      proposalText: 'Final proposal text.',
      leaderParticipantId: 'leader',
      leaderParticipantName: 'Leader',
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          decision: 'accept',
          reason: null,
        },
        {
          participantId: 'writer',
          participantName: 'Writer',
          decision: 'accept',
          reason: null,
        },
      ],
      sharedReasons: null,
    },
    {
      roundIndex: 0,
      defaultExpanded: false,
      proposalId: 'proposal-1',
      proposalText: 'First proposal text.',
      leaderParticipantId: 'leader',
      leaderParticipantName: 'Leader',
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          decision: 'reject',
          reason: 'Missing the caveat.',
        },
        {
          participantId: 'writer',
          participantName: 'Writer',
          decision: 'accept',
          reason: null,
        },
      ],
      sharedReasons: {
        label: 'Shared with next round',
        reasons: ['Missing the caveat.'],
      },
    },
  ],
};

test('council trace renders as a collapsed audit card by default', () => {
  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={trace} />
    </ul>,
  );

  assert.match(markup, /Council trace/);
  assert.match(markup, /Accepted/);
  assert.match(markup, /Show workflow/);
  assert.doesNotMatch(markup, /Leader proposal/);
  assert.doesNotMatch(markup, /Missing the caveat\./);
});

test('expanded council trace renders round boards with proposal and reviewer decisions', () => {
  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={trace} defaultExpanded defaultExpandedRoundIndexes={[1, 0]} />
    </ul>,
  );

  assert.match(markup, /Hide workflow/);
  assert.match(markup, /Round 2/);
  assert.match(markup, /Leader proposal/);
  assert.match(markup, /Final proposal text\./);
  assert.match(markup, /Critic/);
  assert.match(markup, /Accept/);
  assert.match(markup, /Round 1/);
  assert.match(markup, /Shared with next round/);
  assert.match(markup, /Missing the caveat\./);
});
