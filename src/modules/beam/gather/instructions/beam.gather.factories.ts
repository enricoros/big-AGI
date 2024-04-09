import type { SvgIcon } from '@mui/material';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import MediationOutlinedIcon from '@mui/icons-material/MediationOutlined';
import TableViewRoundedIcon from '@mui/icons-material/TableViewRounded';

import type { Instruction } from './beam.gather.execution';


export type FFactoryId = string;
export const CUSTOM_FACTORY_ID = 'custom' as const;

export interface FusionFactorySpec {
  factoryId: FFactoryId;
  shortLabel: string; // used in the button group selector
  addLabel: string;   // used in the add card
  cardTitle: string;   // used as the title
  Icon?: typeof SvgIcon;
  description: string;
  createInstructions: () => Instruction[];
}

export function findFusionFactory(factoryId?: FFactoryId | null): FusionFactorySpec | null {
  if (!factoryId) return null;
  return FUSION_FACTORIES.find(f => f.factoryId === factoryId) ?? null;
}

export const FUSION_FACTORY_DEFAULT = 'fuse';

export const FUSION_FACTORIES: FusionFactorySpec[] = [
  {
    factoryId: 'fuse',
    shortLabel: 'Fuse',
    addLabel: 'Add Fusion',
    cardTitle: 'Combined Response',
    Icon: MediationOutlinedIcon,
    description: 'AI combines conversation details and ideas into one clear, comprehensive answer.',
    createInstructions: () => [
      {
        type: 'chat-generate',
        label: 'Synthesizing Fusion',
        method: 's-s0-h0-u0-aN-u',
        systemPrompt: `
You are an expert AI text synthesizer, your task is to analyze the following inputs and generate a single, comprehensive response that addresses the core objectives or questions.

Consider the conversation history, the last user message, and the diverse perspectives presented in the {{N}} response alternatives.

Your response should integrate the most relevant insights from these inputs into a cohesive and actionable answer.

Synthesize the perfect response that merges the key insights and provides clear guidance or answers based on the collective intelligence of the alternatives.`.trim(),
        userPrompt: `
Synthesize the perfect cohesive response to my last message that merges the collective intelligence of the {{N}} alternatives above.`.trim(),
        // evalPrompt: `Evaluate the synthesized response provided by the AI synthesizer. Consider its relevance to the original query, the coherence of the integration of different perspectives, and its completeness in addressing the objectives or questions raised throughout the conversation.`.trim(),
      },
    ],
  },
  {
    factoryId: 'guided',
    shortLabel: 'Guided',
    addLabel: 'Add Checklist',
    cardTitle: 'Guided Response',
    Icon: CheckBoxOutlinedIcon,
    description: 'Choose between options extracted by AI from the replies, and the model will combine your selections into a single answer.',
    // description: 'This approach employs a two-stage, interactive process where an AI first generates a checklist of insights from a conversation for user selection, then synthesizes those selections into a tailored, comprehensive response, integrating user preferences with AI analysis and creativity.',
    createInstructions: () => [
      {
        type: 'chat-generate',
        label: 'Generating Checklist',
        display: 'chat-message',
        method: 's-s0-h0-u0-aN-u',
        systemPrompt: `
You are an intelligent agent tasked with analyzing a set of {{N}} AI-generated responses to the user message to identify key insights, solutions, or themes.
Your goal is to distill these into a clear, concise, and actionable checklist that the user can review and select from.
The checklist should be brief, commensurate with the task at hand, and formatted precisely as follows:

- [ ] **Insight/Solution/Theme name 1**: [Very brief, actionable description]
- [ ] **Insight/Solution/Theme name 2**: [Very brief, actionable description]
...
- [ ] **Insight/Solution/Theme name N**: [Very brief, actionable description]

The checklist should contain no more than 3-9 items orthogonal items, especially points of difference, in a single brief line each (no end period).
Prioritize items based on what would be most helpful to the user when merging the {{N}} response alternatives.`.trim(),
// Remember, the checklist should only include the most critical and relevant points, ensuring clarity and conciseness. Begin by identifying the essential insights or themes.
        userPrompt: `
Given the conversation history and the {{N}} responses provided, identify and list the key insights, themes, or solutions within the responses as distinct orthogonal options in a checklist format.
Each item should be clearly briefly articulated to allow for easy selection by the user.
Ensure the checklist is comprehensive, covering the breadth of ideas presented in the {{N}} responses, yet concise enough to facilitate clear decision-making.`.trim(),
      },
      {
        type: 'user-input-checklist',
        label: 'Criteria Selection',
        outputPrompt: `
The user selected:
{{YesAnswers}}

The user did NOT select:
{{NoAnswers}} 
`.trim(),
      },
      {
        type: 'chat-generate',
        label: 'Checklist-guided Merge',
        method: 's-s0-h0-u0-aN-u',
        systemPrompt: `
You are a master synthesizer, equipped with specific directions selected by the user from a checklist you previously helped generate.
Your task is to combine the {{N}} response alternatives into a single cohesive response, following the preferences of the user. 
This synthesis should address the user's original query comprehensively, incorporating the {{N}} response alternatives following the user's chosen options.
Aim for clarity and coherence in your final output.`.trim(),
        userPrompt: `
Given the user preferences below, synthesize the {{N}} response alternatives above into a single, cohesive, comprehensive response that follows the user query and the preferences below:

{{PrevStepOutput}}

Ensure the synthesis is coherent, integrating the response alternatives in a clear manner.
The final output should reflect a deep understanding of the user's preferences and the conversation's context.`.trim(),
      },
    ],
  },
  {
    factoryId: 'eval',
    shortLabel: 'Compare',
    addLabel: 'Add Breakdown',
    cardTitle: 'Evaluation Table',
    Icon: TableViewRoundedIcon,
    description: 'Analyzes and compares AI responses, offering a structured framework to support your response choice.',
    createInstructions: () => [
      {
        type: 'chat-generate',
        label: 'Evaluation',
        method: 's-s0-h0-u0-aN-u',
        systemPrompt: `
You are an advanced analytical tool designed to process and evaluate a set of AI-generated responses related to a user\'s query.

Your objective is to organize these responses in a way that aids decision-making.
You will first identify key criteria essential for evaluating the responses based on relevance, quality, and applicability.

Then, you will analyze each response against these criteria.

Finally, you will synthesize your findings into a table, providing a clear overview of how each response measures up. Start by identifying orthogonal criteria for evaluation (up to 2 for simple evaluations, up to 6 for many pages of input text).`.trim(),
        userPrompt: `
Now that you have reviewed the {{N}} alternatives, proceed with the following steps:

1. **Identify Criteria:** Define the most important orthogonal criteria for evaluating the responses. Identify up to 2 criteria for simple evaluations, or up to 6 for more complex evaluations. Ensure these criteria are distinct and relevant to the responses provided.

2. **Analyze Responses:** Evaluate each response individually against the criteria you identified. Assess how well each response meets each criterion, noting strengths and weaknesses. Be VERY brief and concise in this step, using up to one sentence per response.

3. **Generate Table:** Organize your analysis into a table. The table should have rows for each response and columns for each of the criteria. Fill in the table with 1-100 scores (spread out over the full range) for each response-criterion pair, clearly scoring how well each response aligns with the criteria. 

**Table Format:**

| Response | Criterion 1 | Criterion 2 | ... | Criterion C | Total |
|----------|-------------|-------------|-----|-------------|-------|
| R1 | ... | ... | ... | ... | ... |
| R2 | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |
| RN | ... | ... | ... | ... | ... |

Complete this table to offer a structured and detailed comparison of the {{N}} options, providing an at-a-glance overview that will significantly aid in the decision-making process.

Finally declare the best response.

Only work with the provided {{N}} responses. Begin with listing the criteria.`.trim(),
      },
    ],
  },
  {
    factoryId: CUSTOM_FACTORY_ID,
    shortLabel: 'Custom',
    addLabel: 'Add Custom',
    cardTitle: 'User Defined',
    Icon: BuildRoundedIcon,
    description: 'Define your own fusion prompt.',
    createInstructions: () => [
      {
        type: 'chat-generate',
        label: 'Executing Your Merge',
        method: 's-s0-h0-u0-aN-u',
        systemPrompt: `
Your task is to synthesize a cohesive and relevant response based on the following messages: the original system message, the full conversation history up to the user query, the user query, and a set of {{N}} answers generated independently.
These alternatives explore different solutions and perspectives and are presented in random order. Your output should integrate insights from these alternatives, aligned with the conversation's context and objectives, into a single, coherent response that addresses the user's needs and questions as expressed throughout the conversation.`.trim(),
        userPrompt: `
Based on the {{N}} alternatives provided, synthesize a single, comprehensive response.`.trim(),
        // userPrompt: 'Answer again using the best elements from the {{N}} answers above. Be truthful, honest, reliable.',
        // userPrompt: 'Based on the {{N}} alternatives provided, synthesize a single, comprehensive response that effectively addresses the query or problem at hand.',
      },
    ],
  },
];
