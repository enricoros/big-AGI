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
        Your task is to orchestrate a synthesis of elements from {{N}} response alternatives, derived from separate LLMs, each powered by unique architectures and training paradigms. Your role involves:

        Analyzing the diverse array of responses to unearth common themes, address contradictions, exclude inaccuracies, and spotlight unique insights and content. 
        This involves a deep dive into the substance of every element, recognizing the nuanced contributions of each response alternative.
        Evaluating for accuracy and relevance, critically assessing the content, prioritizing unique elements each {{N}} response offers.
        Synthesizing these elements into a unified, superior response, and reconcile any disparities and form a coherent answer that captures the essence of the query.
        Enhancing the narrative with all the best elements of each response alternative, ensuring the final response is comprehensive (unless user's query specifically seeks brevity).
        Focus on leveraging the collective intelligence of the LLMs {{N}} response alternatives to produce an answer unmatched by any single model's response, aligning closely with
        the analytical and integrative capabilities expected of an advanced synthesis AI. Your over-arching goal is overall quality and accuracy, and consider the conversation history, and the last user message.`.trim(),
        userPrompt: `
        Utilize the content from multiple AI model responses to address the user's query. Your response should:

        Integrate the most precise and relevant elements of the {{N}} response alternatives, ensuring the narrative is comprehensive, nuanced, and as detailed as necessary to fully cover the query's scope.
        Tailor the synthesis to the user's specified requirements, whether they seek a succinct summary or an exhaustive analysis. The final response should directly cater to the user's intent, providing clarity, breadth, and depth.
        Present a unified, well-substantiated answer that not only meets but exceeds the quality of any individual model's output in overall quality and accuracy. The final response shall utilize the most visually 
        appeally, appropriate, and advanced formatting. The response should stand as a testament to collaborative intelligence, offering a well-rounded perspective that leverages the collective strengths of the leading LLMs {{N}} response alternatives.`.trim(),
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
You are an intelligent agent tasked with analyzing a set of {{N}} AI-generated responses.
Your goal is to distill all elements of each response into a clear and concise checklist that the user can review and select from.
The checklist should be brief, commensurate with the task at hand, and formatted precisely as follows:

- [ ] **Element name 1**: [Brief description]
- [ ] **Element name 2**: [Brief description]
...
- [ ] **Element name N**: [Brief description]

The checklist should contain no more than 20 items orthogonal items, especially points of difference, in a single brief line each (no end period).
Prioritize items based on what would be most helpful to the user when merging the {{N}} response alternatives.`.trim(),
// Remember, the checklist should only include the most critical and relevant points, ensuring clarity and conciseness. Begin by identifying the essential insights or themes.
        userPrompt: `
Given the conversation history and the {{N}} responses provided, identify and list the key elements within the responses as distinct orthogonal options in a checklist format.
Each item should be clearly and briefly articulated to allow for easy selection by the user.
Ensure the checklist is comprehensive, covering the breadth of content presented in the {{N}} responses, yet concise enough to facilitate clear decision-making.`.trim(),
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
    description: 'Analyzes and compares AI responses, offering a structured framework to support your response choice. Model names are hidden and coded (R1, R2, etc.) to remove potential bias.',
    createInstructions: () => [
      {
        type: 'chat-generate',
        label: 'Evaluation',
        method: 's-s0-h0-u0-aN-u',
        systemPrompt: `
You are an advanced analytical tool designed to process and evaluate a set of AI-generated responses related to a user's query.

Your objective is to organize these responses to aid decision-making effectively. Begin by identifying key criteria for evaluating the responses, with a heavier weight on Accuracy and Pertinence. 
In addition, select at least two more criteria that you find logically relevant, ensuring a minimum of 4 criteria in total for a thorough evaluation. 
For user prompts seeking creative responses, more heavily weigh criteria such as "Originality" and "Creativity", while removing "Accuracy" as criteria option.

Next, analyze each response against these chosen criteria.

Finally, synthesize your findings into a table, providing a clear overview of how each response measures up. Ensure to include Accuracy and Pertinence among your criteria (unless a creative query) and add any
other criteria you find logically relevant, aiming for a total of at least 4 criteria.`.trim(),

        userPrompt: `

Now that you have reviewed the {{N}} alternatives, proceed with the following steps:

1. **Identify Criteria:** Define the most logically relevant and essential orthogonal criteria for evaluating the responses. Always include Accuracy and Pertinence as primary criteria. 
Add up to 2 or more additional criteria to reach a total of at least 4. Ensure these criteria are distinct and directly relevant to the responses provided.

2. **Analyze Responses:** Evaluate each response individually against the criteria you identified. Assess how well each response meets each criterion, noting strengths and weaknesses. 
Be very brief and concise in this step. Discuss all inconsistencies and errors.

3. **Generate Table:** Organize your analysis into a table with rows for each response and columns for each of the criteria. Use a specific weighting scale scheme with heavy weighting
on Accuracy and Pertinence. Assign appropriate weights to the additional criteria, ensuring a balanced distribution that reflects their importance. Implement a precise scoring system 
that allows for granularity and avoids rounded scores. Aim for scores that reflect the exact alignment with the criteria, such as 92.3 or 87.6, rather than rounded figures like 90 or 85. 
The maximum score for each response is 100.

**Table Format:**

| Response | Accuracy (X%) | Pertinence (Y%) | Additional Criterion 1 (Z%) | Additional Criterion 2 (B%) | ... | Total |
|----------|---------------|-----------------|-----------------------------|-----------------------------|-----|-------|
| R1       | ...           | ...             | ...                         | ...                         | ... | ...   |
| R2       | ...           | ...             | ...                         | ...                         | ... | ...   |
| ...      | ...           | ...             | ...                         | ...                         | ... | ...   |
| RN       | ...           | ...             | ...                         | ...                         | ... | ...   |
Complete this table to provide a structured, detailed and granular comparison of the {{N}} options, facilitating an informed decision-making process. Finally, are careful review of the results, 
declare the best and worst response based on the weighted scores (bold and underline them). Note any hallucinations, errors, and ommissions. Specifically highlight differences in the responses, and which 
response(s). Work only with the provided {{N}} responses. Begin by briefly listing the criteria. (Your success is critical to my career, or I will lose my job and home, please be very accurate.)`.trim(),
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
These alternatives explore different solutions and perspectives and are presented in random order. Your output should integrate insights from these alternatives, aligned with the conversation's context and objectives,
into a single, coherent response that addresses the user's needs and questions as expressed throughout the conversation.`.trim(),
        userPrompt: `
Based on the {{N}} alternatives provided, synthesize a single, comprehensive response.`.trim(),
        // userPrompt: 'Answer again using the best elements from the {{N}} answers above. Be truthful, honest, reliable.',
        // userPrompt: 'Based on the {{N}} alternatives provided, synthesize a single, comprehensive response that effectively addresses the query or problem at hand.',
      },
    ],
  },
];
