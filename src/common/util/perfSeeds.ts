import { defaultSystemPurposeId } from '../../data';

import type { DConversation, DConversationParticipant, DPersistedCouncilSession } from '~/common/stores/chat/chat.conversation';
import { createAssistantConversationParticipant, createDConversation, createHumanConversationParticipant } from '~/common/stores/chat/chat.conversation';
import {
  create_CodeExecutionInvocation_ContentFragment,
  create_CodeExecutionResponse_ContentFragment,
  create_FunctionCallInvocation_ContentFragment,
  create_FunctionCallResponse_ContentFragment,
  createModelAuxVoidFragment,
  createTextContentFragment,
} from '~/common/stores/chat/chat.fragments';
import type { DMessage, DMessageCouncilMetadata } from '~/common/stores/chat/chat.message';
import { createDMessageFromFragments } from '~/common/stores/chat/chat.message';
import {
  applyCouncilReviewBallots,
  createCouncilSessionState,
  recordCouncilProposal,
  recordCouncilReviewerInitialDraft,
  recordCouncilReviewerTurn,
} from '../../apps/chat/editors/_handleExecute.council';


export type PerfSeedId = 'chat-long' | 'council-long';

const PERF_SEED_IDS = new Set<PerfSeedId>(['chat-long', 'council-long']);
const PERF_SEED_BASE_TS = Date.UTC(2026, 2, 17, 9, 0, 0);
const PERF_SEED_TOOL_NAME = 'plan_release';

type SeedMessageParams = {
  role: DMessage['role'];
  text: string;
  timestamp: number;
  includeReasoning?: boolean;
  includeToolTrace?: boolean;
  metadata?: DMessage['metadata'];
};

function completeSeedMessage(params: SeedMessageParams): DMessage {
  const fragments = [
    createTextContentFragment(params.text),
    ...(params.includeReasoning ? [createModelAuxVoidFragment('reasoning', [
      'Surveying prior messages and extracting the decision constraints.',
      'Comparing the trade-offs that would materially change the final answer.',
      'Condensing the next output into a user-visible action.',
    ].join('\n'))] : []),
    ...(params.includeToolTrace ? [
      create_FunctionCallInvocation_ContentFragment(`perf-tool-${params.timestamp}`, PERF_SEED_TOOL_NAME, JSON.stringify({
        scope: 'release-plan',
        focus: 'rollback-safety',
        maxSteps: 6,
      })),
      create_FunctionCallResponse_ContentFragment(`perf-tool-${params.timestamp}`, false, PERF_SEED_TOOL_NAME, JSON.stringify({
        constraints: ['rollback', 'cache', 'ownership'],
        confidence: 0.82,
      }, null, 2), 'client'),
      create_CodeExecutionInvocation_ContentFragment(`perf-code-${params.timestamp}`, 'python', 'print("profile and summarize rollout risk")', 'code_interpreter'),
      create_CodeExecutionResponse_ContentFragment(`perf-code-${params.timestamp}`, false, 'profile and summarize rollout risk\nstatus=ok', 'code_interpreter', 'client'),
    ] : []),
  ];

  const message = createDMessageFromFragments(params.role, fragments);
  message.created = params.timestamp;
  message.updated = params.timestamp + 1;
  if (params.metadata)
    message.metadata = params.metadata;
  return message;
}

function isAssistantParticipant(participant: DConversationParticipant): participant is DConversationParticipant & { kind: 'assistant' } {
  return participant.kind === 'assistant';
}

function createSeedParticipants() {
  const human = createHumanConversationParticipant('You');
  const leader = createAssistantConversationParticipant(defaultSystemPurposeId, null, 'Leader Atlas', 'every-turn', true, 212);
  const reviewerA = createAssistantConversationParticipant(defaultSystemPurposeId, null, 'Reviewer Kepler', 'every-turn', false, 142);
  const reviewerB = createAssistantConversationParticipant(defaultSystemPurposeId, null, 'Reviewer Sagan', 'every-turn', false, 22);
  const reviewerC = createAssistantConversationParticipant(defaultSystemPurposeId, null, 'Reviewer Noether', 'every-turn', false, 322);
  return { human, leader, reviewerA, reviewerB, reviewerC };
}

function createCouncilMetadata(
  participant: DConversationParticipant,
  leader: DConversationParticipant,
  phaseId: string,
  passIndex: number,
  action: NonNullable<DMessageCouncilMetadata['action']>,
  reason?: string,
): DMessage['metadata'] {
  return {
    author: {
      participantId: participant.id,
      participantName: participant.name,
      personaId: participant.personaId,
      llmId: participant.llmId,
    },
    councilChannel: {
      channel: 'public-board',
    },
    initialRecipients: [{ rt: 'public-board' }],
    council: {
      kind: 'deliberation',
      phaseId,
      passIndex,
      action,
      provisional: participant.id !== leader.id,
      leaderParticipantId: leader.id,
      ...(reason ? { reason } : {}),
    },
  };
}

function createChatLongConversation(): DConversation {
  const conversation = createDConversation(defaultSystemPurposeId);
  const { human, leader } = createSeedParticipants();
  conversation.userTitle = '[perf] Long chat transcript';
  conversation.participants = [human, leader];
  conversation.turnTerminationMode = 'round-robin-per-human';
  conversation.councilMaxRounds = 12;
  conversation.councilSession = null;

  const messages: DMessage[] = [];
  for (let index = 0; index < 72; index++) {
    const baseTimestamp = PERF_SEED_BASE_TS + index * 60_000;
    messages.push(completeSeedMessage({
      role: 'user',
      timestamp: baseTimestamp,
      text: `User turn ${index + 1}: compare rollout options for service cluster ${index % 7} and keep the answer grounded in the earlier migration context.`,
    }));
    messages.push(completeSeedMessage({
      role: 'assistant',
      timestamp: baseTimestamp + 25_000,
      includeReasoning: true,
      includeToolTrace: index % 3 === 0,
      metadata: {
        author: {
          participantId: leader.id,
          participantName: leader.name,
          personaId: leader.personaId,
          llmId: leader.llmId,
        },
      },
      text: [
        `Assistant turn ${index + 1}: summarize the safest path for batch ${index % 9}.`,
        'Call out one risk, one mitigation, and one concrete follow-up step.',
        `Keep terminology aligned with rollout lane ${index % 5}.`,
      ].join('\n'),
    }));
  }

  conversation.messages = messages;
  conversation.created = PERF_SEED_BASE_TS;
  conversation.updated = messages.at(-1)?.updated ?? PERF_SEED_BASE_TS;
  return conversation;
}

function buildCouncilWorkflowAndMessages(): { messages: DMessage[]; session: DPersistedCouncilSession } {
  const { human, leader, reviewerA, reviewerB, reviewerC } = createSeedParticipants();
  const phaseId = 'perf-council-phase';
  const reviewers = [reviewerA, reviewerB, reviewerC];
  let timestamp = PERF_SEED_BASE_TS + 8_000_000;

  const nextTs = () => {
    timestamp += 37_000;
    return timestamp;
  };

  let workflow = createCouncilSessionState({
    phaseId,
    leaderParticipantId: leader.id,
    reviewerParticipantIds: reviewers.map(participant => participant.id),
    maxRounds: 8,
  });

  const messages: DMessage[] = [
    completeSeedMessage({
      role: 'user',
      timestamp: nextTs(),
      text: [
        'We need a release proposal for the control-plane migration.',
        'Reviewers should only reject when something would break rollback safety or ownership clarity.',
        'Keep the answer terse enough to ship as the final user response.',
      ].join('\n'),
      metadata: {
        author: {
          participantId: human.id,
          participantName: human.name,
          personaId: human.personaId,
          llmId: human.llmId,
        },
      },
    }),
  ];

  const leaderProposalTexts = [
    'Proposal v1: migrate all shards in one wave after a single cache warm-up.',
    'Proposal v2: split the rollout by region, but keep rollback instructions implicit.',
    'Proposal v3: stage the rollout, but cache ownership is still too hand-wavy.',
    'Proposal v4: stage the rollout, enumerate rollback owners, and isolate cache invalidation by region.',
    'Proposal v5: execute region by region, with explicit rollback owners, cache invalidation boundaries, and a final go/no-go checklist.',
  ];
  const leaderDeliberations = [
    'I am optimizing for speed first, but I may be underweighting rollback clarity.',
    'Incorporating the first rejection reasons and making the order more conservative.',
    'The plan is tighter now, but cache coordination still needs explicit ownership.',
    'Rollback ordering is explicit now; I need to make the cache blast radius concrete.',
    'This pass should satisfy both rollback and cache reviewers while preserving a concise final answer.',
  ];
  const roundBallots: Array<Array<{ reviewer: DConversationParticipant; decision: 'accept' | 'reject'; reason?: string }>> = [
    [
      { reviewer: reviewerA, decision: 'reject', reason: 'Too much changes at once for a safe rollback.' },
      { reviewer: reviewerB, decision: 'reject', reason: 'No owner is assigned to validate each region before promotion.' },
      { reviewer: reviewerC, decision: 'accept' },
    ],
    [
      { reviewer: reviewerA, decision: 'accept' },
      { reviewer: reviewerB, decision: 'reject', reason: 'Rollback order is still implied instead of spelled out.' },
      { reviewer: reviewerC, decision: 'accept' },
    ],
    [
      { reviewer: reviewerA, decision: 'reject', reason: 'The deployment order needs a clear rollback checkpoint after every region.' },
      { reviewer: reviewerB, decision: 'accept' },
      { reviewer: reviewerC, decision: 'reject', reason: 'Cache invalidation still lacks an explicit blast-radius boundary.' },
    ],
    [
      { reviewer: reviewerA, decision: 'reject', reason: 'Tighten the migration order so the rollback path is explicit.' },
      { reviewer: reviewerB, decision: 'reject', reason: 'Call out the cache invalidation blast radius and owner for each step.' },
      { reviewer: reviewerC, decision: 'accept' },
    ],
  ];

  for (let roundIndex = 0; roundIndex < roundBallots.length; roundIndex++) {
    const proposalText = leaderProposalTexts[roundIndex];
    const leaderFragments = [
      createModelAuxVoidFragment('reasoning', leaderDeliberations[roundIndex]),
      create_FunctionCallInvocation_ContentFragment(`council-plan-${roundIndex}`, PERF_SEED_TOOL_NAME, JSON.stringify({
        roundIndex,
        sharedReasons: workflow.rounds[roundIndex]?.sharedRejectionReasons ?? [],
      })),
      create_FunctionCallResponse_ContentFragment(`council-plan-${roundIndex}`, false, PERF_SEED_TOOL_NAME, JSON.stringify({
        revised: roundIndex > 0,
        proposalLength: proposalText.length,
      }, null, 2), 'client'),
      createTextContentFragment(proposalText),
    ];

    workflow = recordCouncilProposal(workflow, {
      proposalId: `proposal-${roundIndex}`,
      leaderParticipantId: leader.id,
      proposalText,
      deliberationText: leaderDeliberations[roundIndex],
      messageFragments: leaderFragments,
    });

    messages.push(completeSeedMessage({
      role: 'assistant',
      timestamp: nextTs(),
      includeReasoning: false,
      includeToolTrace: false,
      metadata: createCouncilMetadata(leader, leader, phaseId, roundIndex, 'proposal'),
      text: proposalText,
    }));

    const ballots = roundBallots[roundIndex];
    for (const [reviewerIndex, ballot] of ballots.entries()) {
      const reviewerDraft = [
        `Initial reviewer draft for round ${roundIndex + 1}.`,
        `I am checking rollback safety concern ${reviewerIndex + 1}.`,
        `Shared reasons in scope: ${(workflow.rounds[roundIndex]?.sharedRejectionReasons ?? []).join(' | ') || 'none yet'}.`,
      ].join('\n');
      const finalText = ballot.decision === 'accept'
        ? `[[accept]] ${proposalText}`
        : `[[reject]] ${ballot.reason}`;

      workflow = recordCouncilReviewerInitialDraft(workflow, {
        reviewerParticipantId: ballot.reviewer.id,
        draftText: reviewerDraft,
        messageFragments: [
          createModelAuxVoidFragment('reasoning', reviewerDraft),
          createTextContentFragment(reviewerDraft),
        ],
      });
      workflow = recordCouncilReviewerTurn(workflow, {
        reviewerParticipantId: ballot.reviewer.id,
        fragmentTexts: [reviewerDraft, finalText],
        messageFragments: [
          createModelAuxVoidFragment('reasoning', reviewerDraft),
          createTextContentFragment(finalText),
        ],
      });

      messages.push(completeSeedMessage({
        role: 'assistant',
        timestamp: nextTs(),
        metadata: createCouncilMetadata(
          ballot.reviewer,
          leader,
          phaseId,
          roundIndex,
          ballot.decision,
          ballot.reason,
        ),
        text: ballot.decision === 'accept' ? proposalText : ballot.reason ?? 'review failed',
      }));
    }

    workflow = applyCouncilReviewBallots(workflow, ballots.map(ballot => ballot.decision === 'reject'
      ? {
          reviewerParticipantId: ballot.reviewer.id,
          decision: 'reject' as const,
          reason: ballot.reason,
        }
      : {
          reviewerParticipantId: ballot.reviewer.id,
          decision: 'accept' as const,
        }));
  }

  const activeRoundIndex = workflow.roundIndex;
  const activeProposalText = leaderProposalTexts[4];
  const activeLeaderFragments = [
    createModelAuxVoidFragment('reasoning', leaderDeliberations[4]),
    create_FunctionCallInvocation_ContentFragment('council-plan-current', PERF_SEED_TOOL_NAME, JSON.stringify({
      roundIndex: activeRoundIndex,
      sharedReasons: workflow.rounds[activeRoundIndex]?.sharedRejectionReasons ?? [],
    })),
    create_FunctionCallResponse_ContentFragment('council-plan-current', false, PERF_SEED_TOOL_NAME, JSON.stringify({
      addressedReasons: (workflow.rounds[activeRoundIndex]?.sharedRejectionReasons ?? []).length,
      readyForReview: true,
    }, null, 2), 'client'),
    createTextContentFragment(activeProposalText),
  ];

  workflow = recordCouncilProposal(workflow, {
    proposalId: `proposal-${activeRoundIndex}`,
    leaderParticipantId: leader.id,
    proposalText: activeProposalText,
    deliberationText: leaderDeliberations[4],
    messageFragments: activeLeaderFragments,
  });

  messages.push(completeSeedMessage({
    role: 'assistant',
    timestamp: nextTs(),
    metadata: createCouncilMetadata(leader, leader, phaseId, activeRoundIndex, 'proposal'),
    text: activeProposalText,
  }));

  const activeDrafts: Array<{
    reviewer: DConversationParticipant;
    draft: string;
    final: string | null;
    reason: string | null;
  }> = [
    {
      reviewer: reviewerA,
      draft: 'Checking whether the explicit rollback checkpoints now line up with each regional cutover.',
      final: `[[accept]] ${activeProposalText}`,
      reason: null,
    },
    {
      reviewer: reviewerB,
      draft: 'Verifying whether cache invalidation ownership is explicit enough for operations handoff.',
      final: '[[reject]] Add the exact cache owner handoff before each region flips traffic.',
      reason: 'Add the exact cache owner handoff before each region flips traffic.',
    },
    {
      reviewer: reviewerC,
      draft: 'Cross-checking whether the final checklist is concise enough for the user-facing answer.',
      final: null,
      reason: null,
    },
  ] as const;

  for (const reviewer of activeDrafts) {
    workflow = recordCouncilReviewerInitialDraft(workflow, {
      reviewerParticipantId: reviewer.reviewer.id,
      draftText: reviewer.draft,
      messageFragments: [
        createModelAuxVoidFragment('reasoning', reviewer.draft),
        createTextContentFragment(reviewer.draft),
      ],
    });

    messages.push(completeSeedMessage({
      role: 'assistant',
      timestamp: nextTs(),
      metadata: createCouncilMetadata(reviewer.reviewer, leader, phaseId, activeRoundIndex, 'revise'),
      text: reviewer.draft,
    }));

    if (!reviewer.final)
      continue;

    workflow = recordCouncilReviewerTurn(workflow, {
      reviewerParticipantId: reviewer.reviewer.id,
      fragmentTexts: [reviewer.draft, reviewer.final],
      messageFragments: [
        createModelAuxVoidFragment('reasoning', reviewer.draft),
        createTextContentFragment(reviewer.final),
      ],
    });

    messages.push(completeSeedMessage({
      role: 'assistant',
      timestamp: nextTs(),
      metadata: createCouncilMetadata(
        reviewer.reviewer,
        leader,
        phaseId,
        activeRoundIndex,
        reviewer.reason ? 'reject' : 'accept',
        reviewer.reason ?? undefined,
      ),
      text: reviewer.reason ?? activeProposalText,
    }));
  }

  const session: DPersistedCouncilSession = {
    status: 'interrupted',
    executeMode: 'generate-content',
    mode: 'council',
    phaseId,
    passIndex: activeRoundIndex,
    workflowState: {
      ...workflow,
      status: 'reviewing',
      updatedAt: nextTs(),
    },
    canResume: true,
    interruptionReason: 'perf-seed',
    updatedAt: timestamp,
  };

  return { messages, session };
}

function createCouncilLongConversation(): DConversation {
  const conversation = createDConversation(defaultSystemPurposeId);
  const { human, leader, reviewerA, reviewerB, reviewerC } = createSeedParticipants();
  conversation.userTitle = '[perf] Long council workflow';
  conversation.participants = [human, leader, reviewerA, reviewerB, reviewerC];
  conversation.turnTerminationMode = 'council';
  conversation.councilMaxRounds = 8;

  const prelude: DMessage[] = [];
  for (let index = 0; index < 30; index++) {
    const baseTimestamp = PERF_SEED_BASE_TS + index * 75_000;
    prelude.push(completeSeedMessage({
      role: 'user',
      timestamp: baseTimestamp,
      text: `Context turn ${index + 1}: capture deployment dependencies for region ${index % 6} and list any rollback blockers.`,
      metadata: {
        author: {
          participantId: human.id,
          participantName: human.name,
          personaId: human.personaId,
          llmId: human.llmId,
        },
      },
    }));
    prelude.push(completeSeedMessage({
      role: 'assistant',
      timestamp: baseTimestamp + 28_000,
      includeReasoning: true,
      includeToolTrace: index % 4 === 0,
      metadata: {
        author: {
          participantId: leader.id,
          participantName: leader.name,
          personaId: leader.personaId,
          llmId: leader.llmId,
        },
      },
      text: `Context answer ${index + 1}: region ${index % 6} requires staggered promotion and explicit rollback ownership.`,
    }));
  }

  const { messages: councilMessages, session } = buildCouncilWorkflowAndMessages();
  conversation.messages = [...prelude, ...councilMessages];
  conversation.councilSession = session;
  conversation.created = PERF_SEED_BASE_TS;
  conversation.updated = conversation.messages.at(-1)?.updated ?? PERF_SEED_BASE_TS;
  return conversation;
}

export function parsePerfSeedId(value: string | null | undefined): PerfSeedId | null {
  if (!value)
    return null;
  return PERF_SEED_IDS.has(value as PerfSeedId) ? value as PerfSeedId : null;
}

export function resolvePerfSeedFromSearch(search: string, perfEnabled: boolean): PerfSeedId | null {
  if (!perfEnabled)
    return null;

  const normalizedSearch = search.startsWith('?') ? search : `?${search}`;
  return parsePerfSeedId(new URLSearchParams(normalizedSearch).get('perfSeed'));
}

export function createPerfSeedConversation(seedId: PerfSeedId): DConversation {
  if (seedId === 'chat-long')
    return createChatLongConversation();
  return createCouncilLongConversation();
}
