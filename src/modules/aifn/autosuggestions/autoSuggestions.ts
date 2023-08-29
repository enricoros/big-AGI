import { callChatGenerateWithFunctions, VChatFunctionIn } from '~/modules/llms/llm.client';
import { useModelsStore } from '~/modules/llms/store-llms';

import { useChatStore } from '~/common/state/store-chats';


const suggestUserFollowUpFn: VChatFunctionIn = {
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
};

const suggestPlantUMLFn: VChatFunctionIn = {
  name: 'add_user_suggested_plantuml',
  description: 'Adds a PlantUML diagram to the chat, if the content can be best represented as a diagram and there is no other diagram yet',
  parameters: {
    type: 'object',
    properties: {
      plantuml: {
        type: 'string',
        description: 'The PlantUML diagram, as a string',
      }
    }
  }
}


/**
 * Formulates proposals for follow-up questions, prompts, and counterpoints, based on the last 2 chat messages
 */
export async function autoSuggestions(conversationId: string) {

  // use valid fast model
  const { funcLLMId } = useModelsStore.getState();
  if (!funcLLMId) return;

  // only operate on valid conversations, without any title
  const { conversations, editMessage } = useChatStore.getState();
  const conversation = conversations.find(c => c.id === conversationId) ?? null;
  if (!conversation || conversation.messages.length < 3) return;

  // get the first message of the conversation, and the last 2
  const systemMessage = conversation.messages[0];
  const [userMessage, assistantMessage] = conversation.messages.slice(-2);
  if (!(systemMessage?.role === 'system') || !(userMessage?.role === 'user') || !(assistantMessage?.role === 'assistant')) return;

  // LLM
  callChatGenerateWithFunctions(funcLLMId, [
    { role: 'system', content: systemMessage.text },
    { role: 'user', content: userMessage.text },
    { role: 'assistant', content: assistantMessage.text },
  ], [
    suggestUserFollowUpFn,
  ]).then(chatResponse => {
    console.log(chatResponse);
  });

  callChatGenerateWithFunctions(funcLLMId, [
    { role: 'system', content: systemMessage.text },
    { role: 'user', content: userMessage.text },
    { role: 'assistant', content: assistantMessage.text },
  ], [
    suggestPlantUMLFn,
  ]).then(chatResponse => {
    const functionArguments = chatResponse?.function_arguments ?? null;
    if (functionArguments && ('plantuml' in functionArguments)) {
      editMessage(conversationId, assistantMessage.id, { text: assistantMessage.text + '\n\n```\n' + functionArguments.plantuml + '\n```\n' }, false);
    }
    console.log(chatResponse);
  });

}