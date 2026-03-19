import assert from 'node:assert/strict';
import test from 'node:test';

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { CouncilTraceRenderItem } from '../ChatMessageList.councilTrace';
import {
  create_FunctionCallResponse_ContentFragment,
  create_FunctionCallInvocation_ContentFragment,
  createModelAuxVoidFragment,
  createTextContentFragment,
} from '~/common/stores/chat/chat.fragments';
import { createDMessageFromFragments } from '~/common/stores/chat/chat.message';

import { ChatMessage } from './ChatMessage';
import { CouncilTraceMessage } from './CouncilTraceMessage';
import { ContentFragments } from './fragments-content/ContentFragments';


function createLazyDetailItems(items: CouncilTraceRenderItem['rounds'][number]['leaderCard']['detailItems']) {
  let accessed = false;
  return {
    get accessed() {
      return accessed;
    },
    get value() {
      accessed = true;
      return items;
    },
  };
}

function renderAssistantMessageMarkup(fragments: Parameters<typeof createDMessageFromFragments>[1]) {
  const message = createDMessageFromFragments('assistant', fragments);

  return renderToStaticMarkup(
    <ul>
      <ChatMessage
        message={message}
        fitScreen={false}
        isMobile={false}
      />
    </ul>,
  );
}

function renderExpandedAssistantContentMarkup(fragments: Parameters<typeof createDMessageFromFragments>[1]) {
  return renderToStaticMarkup(
    <ContentFragments
      contentFragments={fragments}
      showEmptyNotice={false}
      contentScaling={0}
      uiComplexityMode='normal'
      fitScreen={false}
      isMobile={false}
      messageRole='assistant'
      disableMarkdownText={false}
      textEditsState={null}
      onEditsApply={() => {}}
      onEditsCancel={() => {}}
      defaultExpandedAuxiliaryFragments
    />,
  );
}

function countChipLabel(markup: string, label: string): number {
  return (markup.match(new RegExp(`>${label}</span>`, 'g')) ?? []).length;
}

function countRenderedLabel(markup: string, label: string): number {
  return (markup.match(new RegExp(`>${label}<`, 'g')) ?? []).length;
}

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
      roundIndex: 0,
      defaultExpanded: false,
      proposalId: 'proposal-1',
      proposalText: 'First proposal text.',
      leaderParticipantId: 'leader',
      leaderParticipantName: 'Leader',
      leaderCard: {
        participantId: 'leader',
        participantName: 'Leader',
        role: 'leader',
        status: 'proposal-ready',
        excerpt: 'First pass note.',
        terminalLabel: 'Proposal ready',
        terminalText: 'First proposal text.',
        terminalReason: null,
        hasDetails: true,
        messageFragments: [
          createTextContentFragment('First proposal text.'),
        ],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'text-output', text: 'First pass note.' },
          { type: 'terminal', action: 'proposal', text: 'First proposal text.', reason: null },
        ],
      },
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          role: 'reviewer',
          status: 'rejected',
          excerpt: 'This is missing the caveat.',
          terminalLabel: 'Reject',
          terminalText: '',
          terminalReason: 'Missing the caveat.',
          hasDetails: true,
          messageFragments: [
            createTextContentFragment('This is missing the caveat.'),
          ],
          messagePendingIncomplete: false,
          detailItems: [
            { type: 'text-output', text: 'This is missing the caveat.' },
            { type: 'terminal', action: 'reject', text: '', reason: 'Missing the caveat.' },
          ],
          decision: 'reject',
          reason: 'Missing the caveat.',
        },
        {
          participantId: 'writer',
          participantName: 'Writer',
          role: 'reviewer',
          status: 'accepted',
          excerpt: null,
          terminalLabel: 'Accept',
          terminalText: '',
          terminalReason: null,
          hasDetails: true,
          messageFragments: [],
          messagePendingIncomplete: false,
          detailItems: [
            { type: 'terminal', action: 'accept', text: '', reason: null },
          ],
          decision: 'accept',
          reason: null,
        },
      ],
      sharedReasons: {
        label: 'Shared with next round',
        reasons: ['Missing the caveat.'],
      },
    },
    {
      roundIndex: 1,
      defaultExpanded: true,
      proposalId: 'proposal-2',
      proposalText: 'Final proposal text.',
      leaderParticipantId: 'leader',
      leaderParticipantName: 'Leader',
      leaderCard: {
        participantId: 'leader',
        participantName: 'Leader',
        role: 'leader',
        status: 'proposal-ready',
        excerpt: 'Working draft note.',
        terminalLabel: 'Proposal ready',
        terminalText: 'Final proposal text.',
        terminalReason: null,
        hasDetails: true,
        messageFragments: [
          createTextContentFragment('Final proposal text.'),
        ],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'text-output', text: 'Working draft note.' },
          { type: 'terminal', action: 'proposal', text: 'Final proposal text.', reason: null },
        ],
      },
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          role: 'reviewer',
          status: 'accepted',
          excerpt: 'Looks good.',
          terminalLabel: 'Accept',
          terminalText: '',
          terminalReason: null,
          hasDetails: true,
          messageFragments: [
            createTextContentFragment('Looks good.'),
          ],
          messagePendingIncomplete: false,
          detailItems: [
            { type: 'text-output', text: 'Looks good.' },
            { type: 'terminal', action: 'accept', text: '', reason: null },
          ],
          decision: 'accept',
          reason: null,
        },
        {
          participantId: 'writer',
          participantName: 'Writer',
          role: 'reviewer',
          status: 'accepted',
          excerpt: 'Approved.',
          terminalLabel: 'Accept',
          terminalText: '',
          terminalReason: null,
          hasDetails: true,
          messageFragments: [
            createTextContentFragment('Approved.'),
          ],
          messagePendingIncomplete: false,
          detailItems: [
            { type: 'text-output', text: 'Approved.' },
            { type: 'terminal', action: 'accept', text: '', reason: null },
          ],
          decision: 'accept',
          reason: null,
        },
      ],
      sharedReasons: null,
    },
  ],
};

test('council trace renders as a collapsed workflow card by default', () => {
  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={trace} />
    </ul>,
  );

  assert.match(markup, /Council trace/);
  assert.match(markup, /Accepted/);
  assert.match(markup, /Show workflow/);
  assert.doesNotMatch(markup, /Proposal ready/);
  assert.doesNotMatch(markup, /Working draft note\./);
});


test('expanded council trace renders a centered leader row above a reviewer row with compact cards', () => {
  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={trace} defaultExpanded defaultExpandedRoundIndexes={[1, 0]} />
    </ul>,
  );

  assert.match(markup, /Hide workflow/);
  assert.match(markup, /Expand all/);
  assert.match(markup, /Collapse all/);
  assert.match(markup, /Round 2/);
  assert.match(markup, /Leader/);
  assert.match(markup, /Proposal ready/);
  assert.match(markup, /Working draft note\./);
  assert.match(markup, /Critic/);
  assert.match(markup, /Writer/);
  assert.match(markup, /Reject/);
  assert.match(markup, /Shared with next round/);
});

test('expanded council trace shows older rounds above newer rounds while summarizing the newest round', () => {
  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={trace} defaultExpanded defaultExpandedRoundIndexes={[0, 1]} />
    </ul>,
  );

  assert.match(markup, /Round 2 accepted unanimously/);
  const roundOneOffset = markup.indexOf('Round 1');
  const roundTwoOffset = markup.lastIndexOf('Round 2');
  assert.ok(roundOneOffset >= 0);
  assert.ok(roundTwoOffset >= 0);
  assert.ok(roundOneOffset < roundTwoOffset);
});

test('expanded agent cards render full ordered transcript events inline', () => {
  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={trace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
        defaultExpandedAgentKeys={['0:leader', '0:critic']}
      />
    </ul>,
  );

  assert.doesNotMatch(markup, /Hide details/);
  assert.doesNotMatch(markup, /Show details/);
  assert.match(markup, /First pass note\./);
  assert.match(markup, /This is missing the caveat\./);
  assert.match(markup, /Missing the caveat\./);
});

test('collapsed workflow and collapsed agent cards do not access detail payloads', () => {
  const lazyDetailItems = createLazyDetailItems([
    { type: 'text-output', text: 'Heavy detail payload.' },
    { type: 'terminal', action: 'proposal', text: 'Heavy terminal payload.', reason: null },
  ]);
  const lazyTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      leaderCard: {
        ...trace.rounds[0].leaderCard,
        hasDetails: true,
        messageFragments: [
          createTextContentFragment('Heavy terminal payload.'),
        ],
        messagePendingIncomplete: false,
        get detailItems() {
          return lazyDetailItems.value;
        },
      },
      reviewerCards: trace.rounds[0].reviewerCards,
    }],
  };

  const collapsedMarkup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={lazyTrace} />
    </ul>,
  );
  assert.match(collapsedMarkup, /Show workflow/);
  assert.equal(lazyDetailItems.accessed, false);

  const expandedWorkflowMarkup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={lazyTrace} defaultExpanded defaultExpandedRoundIndexes={[1]} />
    </ul>,
  );
  assert.match(expandedWorkflowMarkup, /Hide workflow/);
  assert.equal(lazyDetailItems.accessed, false);
});

test('expanded council agent card reuses the standard message fragment UI for reasoning and tools', () => {
  const sharedFragments = [
    createModelAuxVoidFragment('reasoning', 'I should verify the caveat before finalizing.'),
    create_FunctionCallInvocation_ContentFragment('tool-1', 'web_search', '{"q":"retry caveat"}'),
    createTextContentFragment('First proposal text.'),
  ];
  const traceWithFragments: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      leaderCard: {
        ...trace.rounds[0].leaderCard,
        hasDetails: true,
        messageFragments: sharedFragments,
        messagePendingIncomplete: false,
      },
      reviewerCards: trace.rounds[0].reviewerCards,
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={traceWithFragments}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
        defaultExpandedAgentKeys={['0:leader']}
      />
    </ul>,
  );
  const assistantMarkup = renderExpandedAssistantContentMarkup(sharedFragments);
  const councilMarkdownBodyCount = (markup.match(/markdown-body/g) ?? []).length;
  const assistantMarkdownBodyCount = (assistantMarkup.match(/markdown-body/g) ?? []).length;

  assert.match(markup, /Show Reasoning/);
  assert.match(assistantMarkup, /Web Search/);
  assert.doesNotMatch(markup, /Web Search/);
  assert.doesNotMatch(markup, /I should verify the caveat before finalizing\./);
  assert.doesNotMatch(markup, /&quot;q&quot;:&quot;retry caveat&quot;/);
  assert.equal(markup.includes('aria-label="message body"'), assistantMarkup.includes('aria-label="message body"'));
  assert.equal(councilMarkdownBodyCount, assistantMarkdownBodyCount);
  assert.equal(markup.includes('Loading...'), assistantMarkup.includes('Loading...'));
});

test('assistant message renders hosted web search blocks inside the expanded reasoning container', () => {
  const sharedFragments = [
    createModelAuxVoidFragment('reasoning', '**Generating business ideas**\n\nNeed sources.'),
    create_FunctionCallInvocation_ContentFragment('ws-1', 'web_search', '{"q":"canary islands saas"}'),
    create_FunctionCallResponse_ContentFragment('ws-1', false, 'web_search', 'Hosted web search completed.', 'upstream'),
    createTextContentFragment('Final answer.'),
  ];

  const assistantMarkup = renderExpandedAssistantContentMarkup(sharedFragments);

  assert.equal(countChipLabel(assistantMarkup, 'Show Reasoning'), 1);
  assert.equal(countRenderedLabel(assistantMarkup, 'Web Search'), 1);
  assert.match(
    assistantMarkup,
    /Show Reasoning[\s\S]*?markdown-body[\s\S]*?Web Search[\s\S]*?Hosted web search completed\./,
  );
});

test('assistant message collapses one hosted web invocation-response pair into a single inline web search block', () => {
  const sharedFragments = [
    create_FunctionCallInvocation_ContentFragment('ws-1', 'web_search', '{"q":"canary islands saas"}'),
    create_FunctionCallResponse_ContentFragment('ws-1', false, 'web_search', 'Hosted web search completed.', 'upstream'),
  ];

  const assistantMarkup = renderExpandedAssistantContentMarkup(sharedFragments);

  assert.equal(countRenderedLabel(assistantMarkup, 'Web Search'), 1);
  assert.equal(countChipLabel(assistantMarkup, 'Hosted'), 1);
  assert.match(assistantMarkup, /Query[\s\S]*?canary islands saas/);
  assert.match(assistantMarkup, /Result[\s\S]*?Hosted web search completed\./);
});

test('assistant message interleaves hosted web search blocks within the reasoning flow order', () => {
  const sharedFragments = [
    createModelAuxVoidFragment('reasoning', 'First reasoning step.'),
    create_FunctionCallInvocation_ContentFragment('ws-1', 'web_search', '{"q":"first query"}'),
    create_FunctionCallResponse_ContentFragment('ws-1', false, 'web_search', 'First hosted response.', 'upstream'),
    createModelAuxVoidFragment('reasoning', 'Second reasoning step.'),
    create_FunctionCallInvocation_ContentFragment('ws-2', 'web_search', '{"q":"second query"}'),
    create_FunctionCallResponse_ContentFragment('ws-2', false, 'web_search', 'Second hosted response.', 'upstream'),
    createTextContentFragment('Final answer.'),
  ];

  const assistantMarkup = renderExpandedAssistantContentMarkup(sharedFragments);

  assert.match(
    assistantMarkup,
    /First reasoning step\.[\s\S]*?Web Search[\s\S]*?First hosted response\.[\s\S]*?Second reasoning step\.[\s\S]*?Web Search[\s\S]*?Second hosted response\./,
  );
});

test('browser render does not duplicate the leader excerpt when structured proposal content is shown inline', () => {
  const sharedFragments = [
    createModelAuxVoidFragment('reasoning', 'I should verify the caveat before finalizing.'),
    createTextContentFragment('First proposal text.'),
  ];
  const traceWithFragments: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      leaderCard: {
        ...trace.rounds[0].leaderCard,
        excerpt: 'First proposal text.',
        hasDetails: true,
        messageFragments: sharedFragments,
        messagePendingIncomplete: false,
      },
    }],
  };
  const traceWithoutDuplicateExcerpt: CouncilTraceRenderItem = {
    ...traceWithFragments,
    rounds: [{
      ...traceWithFragments.rounds[0],
      leaderCard: {
        ...traceWithFragments.rounds[0].leaderCard,
        excerpt: null,
      },
    }],
  };
  const previousWindow = globalThis.window;

  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {} as Window & typeof globalThis,
    });

    const markup = renderToStaticMarkup(
      <ul>
        <CouncilTraceMessage
          trace={traceWithFragments}
          defaultExpanded
          defaultExpandedRoundIndexes={[0]}
          defaultExpandedAgentKeys={['0:leader']}
        />
      </ul>,
    );
    const baselineMarkup = renderToStaticMarkup(
      <ul>
        <CouncilTraceMessage
          trace={traceWithoutDuplicateExcerpt}
          defaultExpanded
          defaultExpandedRoundIndexes={[0]}
          defaultExpandedAgentKeys={['0:leader']}
        />
      </ul>,
    );

    assert.equal((markup.match(/markdown-body/g) ?? []).length, (baselineMarkup.match(/markdown-body/g) ?? []).length);
  } finally {
    if (previousWindow === undefined)
      delete (globalThis as typeof globalThis & { window?: Window }).window;
    else
      Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  }
});

test('expanded leader trace keeps terminal proposal text visible when structured fragments only contain process', () => {
  const traceWithTerminalOnlyProposal: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      leaderCard: {
        ...trace.rounds[0].leaderCard,
        excerpt: null,
        hasDetails: true,
        messageFragments: [
          createModelAuxVoidFragment('reasoning', 'I should verify the caveat before finalizing.'),
        ],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'terminal', action: 'proposal', text: 'First proposal text.', reason: null },
        ],
      },
      proposalCard: {
        ...trace.rounds[0].leaderCard,
        excerpt: null,
        hasDetails: true,
        messageFragments: [
          createModelAuxVoidFragment('reasoning', 'I should verify the caveat before finalizing.'),
        ],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'terminal', action: 'proposal', text: 'First proposal text.', reason: null },
        ],
      },
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={traceWithTerminalOnlyProposal}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
        defaultExpandedAgentKeys={['0:leader']}
      />
    </ul>,
  );

  assert.match(markup, /Show Reasoning/);
  assert.doesNotMatch(markup, /I should verify the caveat before finalizing\./);
  assert.match(markup, /First proposal text\./);
  assert.doesNotMatch(markup, /No visible output\./);
});

test('expanded reviewer trace keeps terminal rejection reason visible when structured fragments only contain process', () => {
  const traceWithTerminalOnlyRejectReason: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      reviewerCards: [{
        participantId: 'critic',
        participantName: 'Critic',
        role: 'reviewer',
        status: 'rejected',
        excerpt: null,
        terminalLabel: 'Reject',
        terminalText: '',
        terminalReason: 'Missing the caveat.',
        hasDetails: true,
        messageFragments: [
          createModelAuxVoidFragment('reasoning', 'I should verify the caveat before rejecting.'),
          create_FunctionCallInvocation_ContentFragment('reject-critic', 'Reject', '{"reason":"Missing the caveat."}'),
        ],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'terminal', action: 'reject', text: '', reason: 'Missing the caveat.' },
        ],
        decision: 'reject',
        reason: 'Missing the caveat.',
      }],
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={traceWithTerminalOnlyRejectReason}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
        defaultExpandedAgentKeys={['0:critic']}
      />
    </ul>,
  );

  assert.match(markup, /Show Reasoning/);
  assert.doesNotMatch(markup, /I should verify the caveat before rejecting\./);
  assert.match(markup, /Reject/);
  assert.match(markup, /Missing the caveat\./);
  assert.doesNotMatch(markup, /No visible output\./);
});

test('expanded council trace renders separate proposal and reviewer reviews sections', () => {
  const phasedTrace = {
    phaseId: 'phase-structured-sections',
    placement: {
      mode: 'before-message',
      anchorMessageId: 'result-1',
    },
    reviewerCount: 2,
    totalRounds: 1,
    summaryStatus: 'reviewing',
    rounds: [
      {
        roundIndex: 0,
        defaultExpanded: true,
        phase: 'completed',
        proposalCard: {
          participantId: 'leader',
          participantName: 'Leader',
          role: 'leader',
          status: 'proposal-ready',
          excerpt: 'Leader proposal excerpt.',
          terminalLabel: 'Proposal ready',
          terminalText: 'Leader proposal text.',
          terminalReason: null,
          hasDetails: false,
          messageFragments: [],
          messagePendingIncomplete: false,
          detailItems: [],
        },
        reviewerPlanCards: [
          {
            participantId: 'critic',
            participantName: 'Critic',
            role: 'reviewer',
            status: 'proposal-ready',
            excerpt: 'Check the caveat.',
            terminalLabel: 'Analysis ready',
            terminalText: 'Check the caveat.',
            terminalReason: null,
            hasDetails: false,
            messageFragments: [],
            messagePendingIncomplete: false,
            detailItems: [],
          },
          {
            participantId: 'writer',
            participantName: 'Writer',
            role: 'reviewer',
            status: 'proposal-ready',
            excerpt: 'Check the wording.',
            terminalLabel: 'Analysis ready',
            terminalText: 'Check the wording.',
            terminalReason: null,
            hasDetails: false,
            messageFragments: [],
            messagePendingIncomplete: false,
            detailItems: [],
          },
        ],
        reviewerVoteCards: [
          {
            participantId: 'critic',
            participantName: 'Critic',
            role: 'reviewer',
            status: 'rejected',
            excerpt: 'Missing the caveat.',
            terminalLabel: 'Reject',
            terminalText: '',
            terminalReason: 'Missing the caveat.',
            hasDetails: false,
            messageFragments: [],
            messagePendingIncomplete: false,
            detailItems: [],
            decision: 'reject',
            reason: 'Missing the caveat.',
          },
          {
            participantId: 'writer',
            participantName: 'Writer',
            role: 'reviewer',
            status: 'accepted',
            excerpt: 'Accepted.',
            terminalLabel: 'Accept',
            terminalText: '',
            terminalReason: null,
            hasDetails: false,
            messageFragments: [],
            messagePendingIncomplete: false,
            detailItems: [],
            decision: 'accept',
            reason: null,
          },
        ],
        reviewerPlanProgress: { completed: 2, total: 2, isShared: true },
        reviewerVoteProgress: { completed: 2, total: 2, isShared: true },
        sharedReasons: {
          label: 'Shared with next round',
          reasons: ['Missing the caveat.'],
        },
      },
    ],
  } as unknown as CouncilTraceRenderItem;

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={phasedTrace} defaultExpanded defaultExpandedRoundIndexes={[0]} />
    </ul>,
  );

  assert.match(markup, /Proposal/);
  assert.match(markup, /Reviewer reviews/);
  assert.match(markup, /Missing the caveat\./);
});

test('expanded council trace shows partial reviewer reviews before the round closes', () => {
  const partialTrace = {
    ...trace,
    summaryStatus: 'reviewing',
    rounds: [
      {
        roundIndex: 0,
        defaultExpanded: true,
        phase: 'reviewer-votes',
        proposalCard: trace.rounds[0].leaderCard,
        leaderCard: trace.rounds[0].leaderCard,
        reviewerCards: [],
        reviewerPlanCards: [
          {
            participantId: 'critic',
            participantName: 'Critic',
            role: 'reviewer',
            status: 'proposal-ready',
            excerpt: 'Check the caveat first.',
            terminalLabel: 'Analysis ready',
            terminalText: 'Check the caveat first.',
            terminalReason: null,
            hasDetails: false,
            messageFragments: [],
            messagePendingIncomplete: false,
            detailItems: [],
          },
        ],
        reviewerVoteCards: [
          {
            participantId: 'critic',
            participantName: 'Critic',
            role: 'reviewer',
            status: 'rejected',
            excerpt: 'Need the caveat.',
            terminalLabel: 'Reject',
            terminalText: '',
            terminalReason: 'Need the caveat.',
            hasDetails: false,
            messageFragments: [],
            messagePendingIncomplete: false,
            detailItems: [],
            decision: 'reject',
            reason: 'Need the caveat.',
          },
        ],
        reviewerPlanProgress: { completed: 1, total: 2, isShared: false },
        reviewerVoteProgress: { completed: 1, total: 2, isShared: false },
        sharedReasons: null,
      },
    ],
  } as unknown as CouncilTraceRenderItem;

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage trace={partialTrace} defaultExpanded defaultExpandedRoundIndexes={[0]} />
    </ul>,
  );

  assert.match(markup, /1\/2 reviews complete/);
  assert.match(markup, /Need the caveat\./);
  assert.doesNotMatch(markup, /Hidden until all plans complete/);
  assert.doesNotMatch(markup, /Hidden until all votes complete/);
});

test('expanded council trace renders text fragments through the standard markdown path', () => {
  const markdownFragments = [
    createTextContentFragment('**Importante**\n\n| Idea | Nota |\n|---|---|\n| Uno | Dos |'),
  ];
  const markdownTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      proposalCard: {
        ...trace.rounds[0].leaderCard,
        hasDetails: true,
        messageFragments: markdownFragments,
        messagePendingIncomplete: false,
      },
      leaderCard: {
        ...trace.rounds[0].leaderCard,
        hasDetails: true,
        messageFragments: markdownFragments,
        messagePendingIncomplete: false,
      },
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={markdownTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
        defaultExpandedAgentKeys={['0:leader']}
      />
    </ul>,
  );
  const assistantMarkup = renderAssistantMessageMarkup(markdownFragments);

  assert.equal(markup.includes('aria-label="message body"'), assistantMarkup.includes('aria-label="message body"'));
  assert.equal(markup.includes('markdown-body'), assistantMarkup.includes('markdown-body'));
  assert.equal(markup.includes('Loading...'), assistantMarkup.includes('Loading...'));
  assert.equal(markup.includes('<table'), assistantMarkup.includes('<table'));
  assert.equal(markup.includes('<strong>Importante</strong>'), assistantMarkup.includes('<strong>Importante</strong>'));
});

test('cards hide the detail toggle when structured details only repeat the visible excerpt', () => {
  const repeatedExcerptTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      leaderCard: {
        ...trace.rounds[0].leaderCard,
        excerpt: 'Same visible text.',
        hasDetails: true,
        messageFragments: [
          createTextContentFragment('Same visible text.'),
        ],
        messagePendingIncomplete: false,
      },
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          role: 'reviewer',
          status: 'proposal-ready',
          excerpt: 'Check the caveat while still streaming.',
          terminalLabel: 'Analysis ready',
          terminalText: 'Check the caveat while still streaming.',
          terminalReason: null,
          hasDetails: true,
          messageFragments: [
            createTextContentFragment('Check the caveat while still streaming.'),
          ],
          messagePendingIncomplete: true,
          detailItems: [],
          decision: 'pending',
          reason: null,
        },
      ],
      sharedReasons: null,
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={repeatedExcerptTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
      />
    </ul>,
  );

  assert.doesNotMatch(markup, /Show details/);
  assert.equal((markup.match(/Same visible text\./g) ?? []).length, 1);
});

test('synthetic reviewer failures render a clean public failure label without internal reason text', () => {
  const failedReviewTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          role: 'reviewer',
          status: 'rejected',
          excerpt: 'The reviewer failed before submitting a verdict.',
          terminalLabel: 'Review failed',
          terminalText: '',
          terminalReason: null,
          hasDetails: false,
          messageFragments: [],
          messagePendingIncomplete: false,
          detailItems: [],
          decision: 'reject',
          reason: null,
        },
      ],
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={failedReviewTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
      />
    </ul>,
  );

  assert.match(markup, /Review failed/);
  assert.match(markup, /The reviewer failed before submitting a verdict\./);
  assert.doesNotMatch(markup, /review failed/);
  assert.doesNotMatch(markup, /No visible output\./);
});

test('synthetic reviewer failures do not render stale Accept tool details', () => {
  const failedReviewTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          role: 'reviewer',
          status: 'rejected',
          excerpt: 'The reviewer response did not call Accept() or Reject().',
          terminalLabel: 'Missing verdict',
          terminalText: '',
          terminalReason: null,
          hasDetails: false,
          messageFragments: [],
          messagePendingIncomplete: false,
          detailItems: [],
          decision: 'reject',
          reason: null,
        },
      ],
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={failedReviewTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
      />
    </ul>,
  );

  assert.match(markup, /Missing verdict/);
  assert.match(markup, /The reviewer response did not call Accept\(\) or Reject\(\)\./);
  assert.doesNotMatch(markup, /review analysis missing/);
  assert.doesNotMatch(markup, />Accept</);
  assert.doesNotMatch(markup, /Name<\/div><div>Accept<\/div>/);
});

test('ballot-only reviewer accepts render as regular accepts', () => {
  const acceptedReviewTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          role: 'reviewer',
          status: 'accepted',
          excerpt: 'Accept',
          terminalLabel: 'Accept',
          terminalText: '',
          terminalReason: null,
          hasDetails: false,
          messageFragments: [],
          messagePendingIncomplete: false,
          detailItems: [],
          decision: 'accept',
          reason: null,
        },
      ],
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={acceptedReviewTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
      />
    </ul>,
  );

  assert.match(markup, />Accept</);
  assert.doesNotMatch(markup, /Missing analysis/);
  assert.doesNotMatch(markup, /The reviewer called Accept\(\) without a substantive review\./);
});

test('reviewer vote details do not replay the reviewer plan when the vote message only echoes it', () => {
  const repeatedPlanVoteTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      sharedReasons: null,
      reviewerCards: [{
        participantId: 'critic',
        participantName: 'Critic',
        role: 'reviewer',
        status: 'rejected',
        excerpt: null,
        terminalLabel: 'Reject',
        terminalText: '',
        terminalReason: 'Missing the caveat.',
        hasDetails: true,
        messageFragments: [
          createTextContentFragment('Critic plan: verify the caveat is present.'),
          create_FunctionCallInvocation_ContentFragment('reject-critic', 'Reject', '{"reason":"Missing the caveat."}'),
        ],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'terminal', action: 'reject', text: '', reason: 'Missing the caveat.' },
        ],
        decision: 'reject',
        reason: 'Missing the caveat.',
      }],
      reviewerVoteCards: [{
        participantId: 'critic',
        participantName: 'Critic',
        role: 'reviewer',
        status: 'rejected',
        excerpt: null,
        terminalLabel: 'Reject',
        terminalText: '',
        terminalReason: 'Missing the caveat.',
        hasDetails: true,
        messageFragments: [
          create_FunctionCallInvocation_ContentFragment('reject-critic', 'Reject', '{"reason":"Missing the caveat."}'),
        ],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'terminal', action: 'reject', text: '', reason: 'Missing the caveat.' },
        ],
        decision: 'reject',
        reason: 'Missing the caveat.',
      }],
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={repeatedPlanVoteTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
        defaultExpandedAgentKeys={['0:critic']}
      />
    </ul>,
  );

  assert.equal((markup.match(/Critic plan: verify the caveat is present\./g) ?? []).length, 0);
  assert.match(markup, /Reject/);
  assert.match(markup, /Missing the caveat\./);
});

test('committed cards show persisted badges inline', () => {
  const committedTrace: CouncilTraceRenderItem = {
    ...trace,
    rounds: [{
      ...trace.rounds[0],
      reviewerCards: [{
        ...trace.rounds[0].reviewerCards[0],
      }],
    }],
  };

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={committedTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
      />
    </ul>,
  );

  assert.equal(countChipLabel(markup, 'Persisted'), 2);
  assert.doesNotMatch(markup, /Streaming/);
});

test('streaming cards show streaming badges inline while empty waiting cards show none', () => {
  const streamingTrace = {
    ...trace,
    summaryStatus: 'reviewing',
    rounds: [{
      roundIndex: 0,
      defaultExpanded: true,
      phase: 'reviewer-votes',
      proposalId: 'proposal-streaming',
      proposalText: 'Streaming proposal text.',
      leaderParticipantId: 'leader',
      leaderParticipantName: 'Leader',
      leaderCard: {
        participantId: 'leader',
        participantName: 'Leader',
        role: 'leader',
        status: 'proposal-ready',
        excerpt: 'Streaming proposal text.',
        terminalLabel: 'Proposal ready',
        terminalText: 'Streaming proposal text.',
        terminalReason: null,
        hasDetails: true,
        messageFragments: [
          createTextContentFragment('Streaming proposal text.'),
        ],
        messagePendingIncomplete: true,
        detailItems: [],
      },
      reviewerCards: [
        {
          participantId: 'critic',
          participantName: 'Critic',
          role: 'reviewer',
          status: 'proposal-ready',
          excerpt: 'Check the caveat while still streaming.',
          terminalLabel: 'Analysis ready',
          terminalText: 'Check the caveat while still streaming.',
          terminalReason: null,
          hasDetails: true,
          messageFragments: [
            createTextContentFragment('Check the caveat while still streaming.'),
          ],
          messagePendingIncomplete: true,
          detailItems: [],
          decision: 'pending',
          reason: null,
        },
      ],
      proposalCard: {
        participantId: 'leader',
        participantName: 'Leader',
        role: 'leader',
        status: 'proposal-ready',
        excerpt: 'Streaming proposal text.',
        terminalLabel: 'Proposal ready',
        terminalText: 'Streaming proposal text.',
        terminalReason: null,
        hasDetails: true,
        messageFragments: [
          createTextContentFragment('Streaming proposal text.'),
        ],
        messagePendingIncomplete: true,
        detailItems: [],
      },
      reviewerPlanCards: [],
      reviewerVoteCards: [
        {
          participantId: 'writer',
          participantName: 'Writer',
          role: 'reviewer',
          status: 'waiting',
          excerpt: null,
          terminalLabel: null,
          terminalText: '',
          terminalReason: null,
          hasDetails: false,
          messageFragments: [],
          messagePendingIncomplete: false,
          detailItems: [],
          decision: 'pending',
          reason: null,
        },
      ],
      reviewerPlanProgress: { completed: 1, total: 2, isShared: false },
      reviewerVoteProgress: { completed: 0, total: 2, isShared: false },
      sharedReasons: null,
    }],
  } as unknown as CouncilTraceRenderItem;

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={streamingTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
      />
    </ul>,
  );

  assert.match(markup, /Leader[\s\S]*Streaming/);
  assert.match(markup, /Critic[\s\S]*Streaming/);
  assert.doesNotMatch(markup, /Persisted/);
  assert.doesNotMatch(markup, /Writer.*Streaming/);
  assert.doesNotMatch(markup, /Writer.*Persisted/);
});

test('stopped leader-proposal rounds show proposal failure and hide reviewer reviews', () => {
  const stoppedTrace = {
    ...trace,
    summaryStatus: 'stopped',
    rounds: [{
      roundIndex: 0,
      defaultExpanded: true,
      phase: 'leader-proposal',
      leaderProposalFailed: true,
      proposalId: null,
      proposalText: null,
      leaderParticipantId: 'leader',
      leaderParticipantName: 'Leader',
      leaderCard: {
        participantId: 'leader',
        participantName: 'Leader',
        role: 'leader',
        status: 'failed',
        excerpt: 'Leader failed to produce a valid proposal.',
        terminalLabel: 'Proposal failed',
        terminalText: 'Leader failed to produce a valid proposal.',
        terminalReason: 'Leader failed to produce a valid proposal.',
        hasDetails: true,
        messageFragments: [],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'terminal', action: 'proposal', text: 'Leader failed to produce a valid proposal.', reason: 'Leader failed to produce a valid proposal.' },
        ],
      },
      reviewerCards: [],
      proposalCard: {
        participantId: 'leader',
        participantName: 'Leader',
        role: 'leader',
        status: 'failed',
        excerpt: 'Leader failed to produce a valid proposal.',
        terminalLabel: 'Proposal failed',
        terminalText: 'Leader failed to produce a valid proposal.',
        terminalReason: 'Leader failed to produce a valid proposal.',
        hasDetails: true,
        messageFragments: [],
        messagePendingIncomplete: false,
        detailItems: [
          { type: 'terminal', action: 'proposal', text: 'Leader failed to produce a valid proposal.', reason: 'Leader failed to produce a valid proposal.' },
        ],
      },
      reviewerPlanCards: [],
      reviewerVoteCards: [],
      reviewerPlanProgress: { completed: 0, total: 2, isShared: false },
      reviewerVoteProgress: { completed: 0, total: 2, isShared: false },
      sharedReasons: null,
    }],
  } as unknown as CouncilTraceRenderItem;

  const markup = renderToStaticMarkup(
    <ul>
      <CouncilTraceMessage
        trace={stoppedTrace}
        defaultExpanded
        defaultExpandedRoundIndexes={[0]}
      />
    </ul>,
  );

  assert.match(markup, /Stopped/);
  assert.match(markup, /Leader failed to produce a valid proposal/);
  assert.match(markup, /Proposal failed/);
  assert.doesNotMatch(markup, /Reviewer reviews/);
  assert.doesNotMatch(markup, /0\/2 reviews complete/);
});
