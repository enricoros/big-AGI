export type FlattenStyleType = 'brief' | 'deep' | 'exploration' | 'action';

interface FlattenProfile {
  type: FlattenStyleType;
  name: string;
  description: string;
  emoji: string;
  systemPrompt: string;
  userPrompt: string;
}

const systemPromptSuffix = 'Ensure the summary is impersonal and easy to read, write clear and separated paragraphs and use bullet points when possible.';

export const FLATTEN_PROFILES: FlattenProfile[] = [
  {
    type: 'brief',
    name: 'Brief',
    description: 'Concise overview with main points and actions',
    emoji: '⚡',
    systemPrompt: 'Create a brief and concise summary of the given conversation thread, focusing on the most important points, recent developments, and key actionable insights. Maintain enough context for future reference and exclude any references to the user or the assistant. ' + systemPromptSuffix,
    userPrompt: 'Please create a brief and concise summary for the conversation below, focusing on the most important points, recent developments, and key actionable insights, while maintaining enough context for future reference:',
  },
  {
    type: 'deep',
    name: 'Detailed',
    description: 'Detailed summary with synthesized ideas',
    emoji: '🔎',
    systemPrompt: 'Provide a comprehensive and detailed summary of the given conversation thread, capturing context and background, all recent and relevant points, preserving context, and synthesizing related ideas. Highlight actionable insights and stakeholder considerations, while excluding references to the user or the assistant. ' + systemPromptSuffix,
    userPrompt: 'Please provide a detailed summary of the conversation below, capturing context and background, all recent and relevant points, preserving context, synthesizing related ideas, highlighting actionable insights, and including any stakeholder considerations:',
  },
  {
    type: 'exploration',
    name: 'Open-ended',
    description: 'Open-ended summary for further discussion',
    emoji: '🌱',
    systemPrompt: 'Summarize the given conversation thread in a way that invites further exploration, encourages the addition of new perspectives, and identifies knowledge gaps or unanswered questions. Foster continued discussion on the topic while excluding references to the user or the assistant. ' + systemPromptSuffix,
    userPrompt: 'Please summarize the conversation below in a way that invites further exploration, encourages the addition of new perspectives, identifies knowledge gaps or unanswered questions, and fosters continued discussion on the topic:',
  },
  {
    type: 'action',
    name: 'Actionable',
    description: 'Summary with decisions, actions, and context',
    emoji: '📌',
    systemPrompt: 'Generate a summary of the given conversation thread that emphasizes decisions made, agreed-upon next steps, and action items from the discussion. Capture the context, key points, and any potential challenges or opportunities, while excluding references to the user or the assistant. ' + systemPromptSuffix,
    userPrompt: 'Please generate a summary of the conversation below that emphasizes decisions made, agreed-upon next steps, and action items from the discussion, while also capturing the context, key points, and any potential challenges or opportunities:',
  },
];