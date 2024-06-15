import { llmChatGenerateOrThrow, VChatFunctionIn, VChatMessageIn } from '~/modules/llms/llm.client';
import { useModelsStore } from '~/modules/llms/store-llms';

import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { attachmentWrapText } from '~/common/stores/chat/chat.tokens';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { useChatStore } from '~/common/stores/chat/store-chats';


/*const suggestUserFollowUpFn: VChatFunctionIn = {
  name: 'suggest_user_prompt',
  description: 'Surprises the user with a thought-provoking question/prompt/contrarian idea',
  parameters: {
    type: 'object',
    properties: {
      question_as_user: {
        type: 'string',
        description: 'The concise and insightful question that we propose the user should ask, designed to provoke deep thought and stimulate conversation',
      },
      title: {
        type: 'string',
        description: 'Very brief title, e.g. Meaning of Life',
      },
    },
    required: ['question_as_user', 'title'],
  },
};*/


const suggestPlantUMLSystemPrompt = `
You are a helpful AI assistant skilled in creating diagrams. Analyze the conversation and user persona below to determine if a PlantUML or MermaidJS diagram would complement or enhance the user's understanding.

Rate the diagram's usefulness (1-5): 1: Misleading, unnecessary or duplicate, 2: Not a fit or trivial, 3: Potentially useful to the user, 4: Very useful, 5: Essential.

Only if the rating is 3, 4, or 5, generate the diagram code.

Assistant personality type:
{{personaSystemPrompt}}

Analyze the following short exchange and call the function \`draw_plantuml_diagram\` with the diagram code only if the score is 3, 4 or 5.
`;


const suggestPlantUMLFn: VChatFunctionIn = {
  name: 'draw_plantuml_diagram',
  description: 'Generates a PlantUML diagram or mindmap from the last message, if applicable, relevant, and no other diagrams are present.',
  parameters: {
    type: 'object',
    properties: {
      rating_short_reason: {
        type: 'string',
        description: 'A 4-10 words reason on whether the diagram would desired by the user or not.',
      },
      rating_number: {
        type: 'number',
        description: 'The relevance of the diagram to the conversation, on a scale of 1 to 5. If 1 or 2, do not proceed and stop right here.',
      },
      type: {
        type: 'string',
        description: 'The most suitable PlantUML diagram type: sequence, class, use case, activity, component, state, object, deployment, wireframe, mindmap, gantt, flowchart, or an empty string.',
      },
      code: {
        type: 'string',
        description: 'A valid PlantUML string (@startuml...@enduml) to be rendered as a diagram or mindmap (@startmindmap...@endmindmap), or empty. No external references allowed. Use one or more asterisks to indent and separate with spaces.',
      },
    },
    required: ['rating_short_reason', 'rating_number'],
  },
};


/**
 * Formulates proposals for follow-up questions, prompts, and counterpoints, based on the last 2 chat messages
 */
export function autoSuggestions(conversationId: string, assistantMessageId: string, suggestDiagrams: boolean, suggestQuestions: boolean) {

  // use valid fast model
  const { funcLLMId } = useModelsStore.getState();
  if (!funcLLMId) return;

  // only operate on valid conversations, without any title
  const { conversations } = useChatStore.getState();
  const conversation = conversations.find(c => c.id === conversationId) ?? null;
  if (!conversation || conversation.messages.length < 3) return;

  // find the index of the assistant message
  const assistantMessageIndex = conversation.messages.findIndex(m => m.id === assistantMessageId);
  if (assistantMessageIndex < 2) return;
  const userMessage = conversation.messages[assistantMessageIndex - 1];
  const assistantMessage = conversation.messages[assistantMessageIndex];
  const systemMessage = conversation.messages[0];
  if (!(systemMessage?.role === 'system') || !(userMessage?.role === 'user') || !(assistantMessage?.role === 'assistant')) return;

  // Execute the following follow-ups in parallel
  // const assistantMessageId = assistantMessage.id;
  const assistantMessageText = messageFragmentsReduceText(assistantMessage.fragments);

  // Follow-up: Question
  if (suggestQuestions) {
    // llmChatGenerateOrThrow(funcLLMId, [
    //     { role: 'system', content: systemMessage.text },
    //     { role: 'user', content: userMessage.text },
    //     { role: 'assistant', content: assistantMessageText },
    //   ], [suggestUserFollowUpFn], 'suggest_user_prompt',
    // ).then(chatResponse => {
    //   // assistantMessageText += '\n\n' + chatResponse?.function_arguments?.question_as_user + '\n';
    // });
  }

  // Follow-up: Auto-Diagrams if the assistant text does not contain @startuml / @startmindmap already
  if (suggestDiagrams && !['@startuml', '@startmindmap', '```plantuml', '```mermaid'].some(s => assistantMessageText.includes(s))) {
    const instructions: VChatMessageIn[] = [
      {
        role: 'system', content: suggestPlantUMLSystemPrompt
          .replace('{{personaSystemPrompt}}', attachmentWrapText(messageFragmentsReduceText(systemMessage.fragments), '', 'markdown-code')),
      },
      { role: 'user', content: messageFragmentsReduceText(userMessage.fragments) },
      { role: 'assistant', content: assistantMessageText },
    ];
    llmChatGenerateOrThrow(
      funcLLMId,
      instructions,
      'chat-followup-diagram', conversationId,
      [suggestPlantUMLFn], 'draw_plantuml_diagram',
    ).then(chatResponse => {
      // cheap way to check if the function was supported
      if (!('function_arguments' in chatResponse))
        return;

      // parse the output PlantUML string, if any
      const functionArguments = chatResponse.function_arguments ?? null;
      if (functionArguments) {
        const { code, type }: { code: string, type: string } = functionArguments as any;
        if (code && type) {

          // validate the code
          const plantUML = code.trim();
          if (!plantUML.startsWith('@start') || !(plantUML.endsWith('@enduml') || plantUML.endsWith('@endmindmap'))) return;

          // append the PlantUML diagram to the assistant response
          const cHandler = ConversationsManager.getHandler(conversationId);
          cHandler.messageAppendTextContentFragment(assistantMessageId, attachmentWrapText(plantUML, `${type}.auto-diagram`, 'markdown-code'), true, true);
        }
      }
    }).catch(err => {
      // Likely the model did not support function calling
      // console.log('autoSuggestions: diagram error:', err);
    });
  }

}