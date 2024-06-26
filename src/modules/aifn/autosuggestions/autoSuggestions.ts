import { llmChatGenerateOrThrow, VChatFunctionIn, VChatMessageIn } from '~/modules/llms/llm.client';
import { useModelsStore } from '~/modules/llms/store-llms';

import { useChatStore } from '~/common/state/store-chats';


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

const suggestPlantUMLFn: VChatFunctionIn = {
  name: 'draw_plantuml_diagram',
  description: 'Generates a PlantUML diagram or mindmap from the last message, if applicable, relevant, and no other diagrams are present.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'The suitable type of diagram. Options: sequence, class, usecase, activity, component, state, object, deployment, wireframe, mindmap, gantt, flowchart, or an empty string.',
      },
      code: {
        type: 'string',
        description: 'A valid PlantUML string (@startuml...@enduml) to be rendered as a diagram or mindmap, or an empty string. Use quotation marks for proper escaping, avoid external references and avoid unescaped spaces in participants/actors.',
      },
    },
    required: ['type', 'code'],
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
  const { conversations, editMessage } = useChatStore.getState();
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
  let assistantMessageText = assistantMessage.text;

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

  // Follow-up: Auto-Diagrams
  if (suggestDiagrams) {
    const instructions: VChatMessageIn[] = [
      { role: 'system', content: systemMessage.text },
      { role: 'user', content: userMessage.text },
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
          editMessage(conversationId, assistantMessageId, {
            text: assistantMessageText + `\n\n\`\`\`${type}.diagram\n${plantUML}\n\`\`\`\n`,
          }, false);
        }
      }
    }).catch(err => {
      // Likely the model did not support function calling
      // console.log('autoSuggestions: diagram error:', err);
    });
  }

}