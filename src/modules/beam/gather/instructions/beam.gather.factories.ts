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
You are an expert AI text synthesizer, your task is to meticulously analyze the {{N}} response alternatives, and synthesize them into a unified, superior response. Your response shall reflect only
the best elements of the best {{N}} response alternatives, ensuring comprehensiveness, that matches the verbosity level the query demands. Leverage the collective intelligence to
 produce an answer that is "better than the sum of its parts", considering the conversation history and the last user message. Your response shall always reflect the superior formatting style of all {{N}} response alternatives`.trim(),
        userPrompt: `
Evaluate the user last query and all {{N}} response alternatives. Integrate the most precise and pertinent elements of each, tailoring to the user's requirements. Your response verbosity level shall the user's preferences and context 
(or match the group of {{N}} alternatives, if none provided). Provide a synthesized reponse that exceeds the quality of all {{N}} response alternatives.`.trim(),
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
    createInstructions: () => [
      {
        type: 'chat-generate',
        label: 'Generating Checklist',
        display: 'chat-message',
        method: 's-s0-h0-u0-aN-u',
        systemPrompt: `
Analyze a set of {{N}} AI-generated responses and distill all elements (insights, ideas, take-aways, facts, etc.) into a checklist. Format as follows:

- [ ] **Element name 1**: [Brief description]
...
- [ ] **Element name N**: [Brief description]

Include no more than 12 orthogonal elements, especially points of difference, in a single brief line each (no end period).
Prioritize items based on what would be most helpful to the user when merging the {{N}} response alternatives.`.trim(),
        userPrompt: `
Identify and list key elements within the {{N}} responses as distinct options in a checklist format. Ensure the checklist is comprehensive, covering the breadth
 of ideas presented in the {{N}} responses, yet concise enough to facilitate clear decision-making.`.trim(),
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
You are master synthesizer, skilled in consolidating the best of {{N}} response alternatives into a single cohesive response, following user preferences from a checklist. Address
 the user's query meticulously incorporating the chosen options. Aim for clarity and coherence.`.trim(),
        userPrompt: `
Given the user preferences below, synthesize the {{N}} response alternatives into a single, comprehensive response:

{{PrevStepOutput}}

Ensure coherence and reflect a deep understanding of the user's preferences and context.`.trim(),
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
You are an advanced analytical tool designed to process and evaluate a set of AI-generated responses, analyze each response, and synthesize findings into a table.`.trim(),
        userPrompt: `
1. **Identify Criteria:** Define at least 4 logically relevant criteria, always including Accuracy and Pertinence, unless inappropriate based on user query (e.g. creative in nature).
2. **Analyze Responses:** Thoroughly evaluate each response against the criteria, to identify strengths, weaknesses, similarities and differences.
3. **Generate Table:** Organize analysis into a table with rows for responses and columns for criteria. Use a weighting scale scheme with heavy weighting on Accuracy and Pertinence, 
as appropriate to the user query. 
Implement a precise scoring system (max score 100). 
**Table Format:**

| Response | Criterion 1 (35%) | Criterion 2 (25%) | ... | Criterion C (N%) | Total |
|----------|-------------|-------------|-----|-------------|-------|
| R1 | ... | ... | ... | ... | ... |
| R2 | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |
| RN | ... | ... | ... | ... | ... |

Declare the best and worst response based on weighted scores. Note any errors or inconsistencies. 
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
Synthesize a cohesive response based on the original system message, conversation history, user query, and {{N}} answers. Integrate insights from these alternatives into a single, coherent response that addresses the user's needs.`.trim(),
        userPrompt: `
Based on the {{N}} alternatives provided, synthesize a single, comprehensive response.`.trim(),
      },
    ],
  },
];