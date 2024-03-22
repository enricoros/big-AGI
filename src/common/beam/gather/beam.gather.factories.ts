import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import MediationOutlinedIcon from '@mui/icons-material/MediationOutlined';
import TableViewRoundedIcon from '@mui/icons-material/TableViewRounded';

import { createDMessage } from '~/common/state/store-chats';

import type { BFusion, TFusionFactoryId } from './beam.gather';
import { GATHER_PLACEHOLDER } from '../beam.config';


function _initCommonBFusion(factoryId: TFusionFactoryId, isEditable: boolean): Omit<BFusion, 'instructions'> {
  return {
    // const
    fusionId: uuidv4(),
    factoryId,
    isEditable,
    // instructions: [...] will be set later
    // variables
    llmId: null,
    currentInstructionIndex: 0,
    status: 'idle',
    outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
  };
}


export interface FusionFactorySpec {
  id: TFusionFactoryId;
  isDev?: boolean;
  label: string;
  description: string;
  Icon?: React.FunctionComponent;
  factory: () => BFusion;
}


export const FUSION_FACTORIES: FusionFactorySpec[] = [
  {
    id: 'guided',
    label: 'Guided',
    Icon: CheckBoxOutlinedIcon,
    // description: 'This approach employs a two-stage, interactive process where an AI first generates a checklist of insights from a conversation for user selection, then synthesizes those selections into a tailored, comprehensive response, integrating user preferences with AI analysis and creativity.',
    description: 'A brainstorming session with AI, where you first pick your favorite ideas from a list it generates, and then the AI combines those picks into a tailored solution.',
    factory: () => ({
      ..._initCommonBFusion('guided', false),
      instructions: [
        {
          type: 'chat-generate',
          name: 'Generate Checklist',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: `You are an intelligent agent tasked with analyzing a set of AI-generated alternatives to identify key insights, solutions, or ideas. Your goal is to distill these alternatives into a concise checklist of options that can address the user's query. Consider the conversation's context, the user's last message, and the diversity of perspectives offered by the Beam alternatives. Generate a clear and actionable checklist that the user can review and select from.`,
          userPrompt: 'Given the conversation history and the {{N}} alternatives provided, identify and list the key insights, themes, or solutions as distinct options in a checklist format. Each item should be clearly articulated to allow for easy selection by the user. Ensure the checklist is comprehensive, covering the breadth of ideas presented in the alternatives, yet concise enough to facilitate clear decision-making.',
          outputType: 'user-checklist',
        },
        {
          type: 'chat-generate',
          name: 'Checklist-guided Merge',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: 'You are a master synthesizer, now equipped with specific insights selected by the user from a checklist you previously helped generate. Your task is to integrate these selected insights into a single, cohesive response. This synthesis should address the user\'s original query comprehensively, incorporating the best elements of the user\'s chosen options. Aim for clarity, coherence, and actionability in your final output.',
          userPrompt: 'Given the user\'s selected options from the checklist, synthesize these into a single, cohesive, comprehensive response that addresses the original query. Ensure the synthesis is coherent, integrating the selected insights in a manner that provides clear, actionable advice or solutions. The final output should reflect a deep understanding of the user\'s preferences and the conversation\'s context.',
          outputType: 'display-message',
        },
      ],
    }),
  },
  {
    id: 'fuse',
    label: 'Fuse',
    Icon: MediationOutlinedIcon,
    description: 'AI combines conversation details and various AI-generated ideas into one clear, comprehensive answer, making sense of diverse insights for you.',
    factory: () => ({
      ..._initCommonBFusion('fuse', false),
      instructions: [
        {
          type: 'chat-generate',
          name: 'Syntesizing Fusion',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: `
You are an expert AI text synthesizer, your task is to analyze the following inputs and generate a single, comprehensive response that addresses the core objectives or questions.

Consider the conversation history, the last user message, and the diverse perspectives presented in the {{N}} response alternatives.

Your response should integrate the most relevant insights from these inputs into a cohesive and actionable answer.

Synthesize the perfect response that merges the key insights and provides clear guidance or answers based on the collective intelligence of the alternatives.`.trim(),
          userPrompt: 'Synthesize the perfect response that merges the key insights and provides clear guidance or answers based on the collective intelligence of the alternatives.',
          // evalPrompt: `Evaluate the synthesized response provided by the AI synthesizer. Consider its relevance to the original query, the coherence of the integration of different perspectives, and its completeness in addressing the objectives or questions raised throughout the conversation.`.trim(),
          outputType: 'display-message',
        },
      ],
    }),
  },
  {
    id: 'eval',
    label: 'Eval',
    Icon: TableViewRoundedIcon,
    description: 'Analyzes and ranks AI responses, offering a clear, comparative overview to support your choice of answer.',
    isDev: true,
    factory: () => ({
      ..._initCommonBFusion('eval', false),
      instructions: [
        {
          type: 'chat-generate',
          name: 'Evaluation',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: `
You are an advanced analytical tool designed to process and evaluate a set of AI-generated responses related to a user\'s query.

Your objective is to organize these responses in a way that aids decision-making. You will first identify key criteria essential for evaluating the responses based on relevance, quality, and applicability.

Then, you will analyze each response against these criteria.

Finally, you will synthesize your findings into a table, providing a clear overview of how each response measures up. Start by identifying up to 8 orthogonal criteria for evaluation.`.trim(),
          userPrompt: `
Now that you have reviewed the N alternatives, proceed with the following steps:

1. **Analyze Responses:** Evaluate each response individually against the criteria you identified. Assess how well each response meets each criterion, noting strengths and weaknesses.

2. **Generate Table:** Organize your analysis into a table. The table should have rows for each response and columns for each of the criteria, plus an initial column for the response identifiers. Fill in the table with your assessment of how each response aligns with the criteria.

**Table Format:**

| Response | Criterion 1 | Criterion 2 | ... | Criterion 8 |
|----------|-------------|-------------|-----|-------------|
| Response 1 | ... | ... | ... | ... |
| Response 2 | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |
| Response N | ... | ... | ... | ... |

Complete this table to offer a structured and detailed comparison of the options available, providing an at-a-glance overview that will significantly aid in the decision-making process.`.trim(),
          outputType: 'display-message',
        },
      ],
    }),
  },
  {
    id: 'custom',
    label: 'Custom',
    // Icon: BuildCircleOutlinedIcon,
    description: 'Define your own fusion prompt.',
    factory: () => ({
      ..._initCommonBFusion('custom', true),
      instructions: [
        {
          type: 'chat-generate',
          name: 'Executing Your Merge Strategy',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: `
Your task is to synthesize a cohesive and relevant response based on the following messages: the original system message, the full conversation history up to the user query, the user query, and a set of {{N}} answers generated independently.
These alternatives explore different solutions and perspectives and are presented in random order. Your output should integrate insights from these alternatives, aligned with the conversation's context and objectives, into a single, coherent response that addresses the user's needs and questions as expressed throughout the conversation.`.trim(),
          // userPrompt: 'Answer again using the best elements from the {{N}} answers above. Be truthful, honest, reliable.',
          // userPrompt: 'Based on the {{N}} alternatives provided, synthesize a single, comprehensive response that effectively addresses the query or problem at hand.',
          userPrompt: 'Based on the {{N}} alternatives provided, synthesize a single, comprehensive response.',
          outputType: 'display-message',
        },
      ],
    }),
  },
];
