import { llmChatGenerateOrThrow, VChatFunctionIn, VChatMessageIn } from '~/modules/llms/llm.client';
import { useModelsStore } from '~/modules/llms/store-llms';

import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { attachmentWrapText } from '~/common/stores/chat/chat.tokens';
import { createErrorContentFragment, createPlaceholderContentFragment, createTextContentFragment, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
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


// Auto-Diagram

const suggestDiagramFunctionName = 'draw_plantuml_diagram';

// export const suggestDiagramMixin = `Please defer diagram generation to the \`${suggestDiagramFunctionName}\` function, IF defined.`;

const suggestPlantUMLSystemPrompt = `
You are a helpful AI assistant skilled in creating diagrams. Analyze the conversation and user persona below to determine if a PlantUML or MermaidJS diagram would complement or enhance the user's understanding.

Rate the diagram's usefulness (1-5): 1: Misleading, unnecessary or duplicate, 2: Not a fit or trivial, 3: Potentially useful to the user, 4: Very useful, 5: Essential.

Only if the rating is 3, 4, or 5, generate the diagram code.

Assistant personality type:
{{personaSystemPrompt}}

Analyze the following short exchange and call the function \`${suggestDiagramFunctionName}\` with the diagram code only if the score is 3, 4 or 5.
`.trim();

const suggestPlantUMLFn: VChatFunctionIn = {
  name: suggestDiagramFunctionName,
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


// Auto-HTML-UI

const suggestUIFunctionName = 'generate_web_ui';

export const suggestUIMixin = `User inferace generation: only via the \`${suggestUIFunctionName}\` function, IF defined`;

const suggestUISystemPrompt = `
You are a helpful AI assistant skilled in creating user interfaces. Analyze the conversation and user persona below to determine if an HTML user interface would complement or enhance the user's understanding.

Rate the UI's usefulness (1-5): 1: Misleading, unnecessary or duplicate, 2: Not a fit or trivial, 3: Potentially useful or thought provoking to the user, 4: Very useful, 5: Essential.

Only if the rating is 3, 4, or 5, generate the HTML code. Ensure the generated UI is visual and interactive to enhance user engagement.

Assistant personality type:
{{personaSystemPrompt}}

Analyze the following short exchange and call the function \`${suggestUIFunctionName}\` with the HTML code only if the score is 3, 4 or 5.

I want you to consider this as an exercise in creativity and problem-solving to enhance the user experience. Try hard to think of a great UI to visualize or solve the problem at hand.
`.trim();

const suggestUIFn: VChatFunctionIn = {
  name: suggestUIFunctionName,
  description: 'Renders a web UI when provided with a single concise HTML5 string (can include CSS and JS), if applicable, relevant, and no other UIs are present.',
  parameters: {
    type: 'object',
    properties: {
      possible_ui_requirements: {
        type: 'string',
        description: 'Brief (10 words) to medium length (40 words) requirements for the UI. Include the main features, looks, layout.',
      },
      rating_short_reason: {
        type: 'string',
        description: 'A 4-10 words reason on whether the UI would be desired by the user or not.',
      },
      rating_number: {
        type: 'number',
        description: 'The relevance of the UI to the conversation, on a scale of 1 to 5. If 1 or 2, do not proceed and stop right here.',
      },
      html: {
        type: 'string',
        description: 'A valid HTML string containing the user interface code. The code should be complete, with no dependencies, lower case, and include minimal inline CSS if needed. The UI should be visual and interactive.',
      },
      file_name: {
        type: 'string',
        description: 'Short letters-and-dashes file name of the HTML without the .html extension',
      },
    },
    required: ['possible_ui_requirements', 'rating_short_reason', 'rating_number'],
  },
};


/**
 * Formulates proposals for follow-up questions, prompts, and counterpoints, based on the last 2 chat messages
 */
export function autoSuggestions(conversationId: string, assistantMessageId: string, suggestDiagrams: boolean, suggestHTMLUI: boolean, suggestQuestions: boolean) {

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

  const wrappedPersonaSystemText = attachmentWrapText(messageFragmentsReduceText(systemMessage.fragments), '', 'markdown-code');
  const userMessageText = messageFragmentsReduceText(userMessage.fragments);
  const assistantMessageText = messageFragmentsReduceText(assistantMessage.fragments);

  const cHandler = ConversationsManager.getHandler(conversationId);

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

    // Placeholder for the diagram
    const placeholderFragment = createPlaceholderContentFragment('Auto-Diagram ...');
    cHandler.messageFragmentAppend(assistantMessageId, placeholderFragment, false, false);

    const instructions: VChatMessageIn[] = [
      { role: 'system', content: suggestPlantUMLSystemPrompt.replace('{{personaSystemPrompt}}', wrappedPersonaSystemText) },
      { role: 'user', content: userMessageText },
      { role: 'assistant', content: assistantMessageText },
    ];
    llmChatGenerateOrThrow(
      funcLLMId, instructions, 'chat-followup-diagram', conversationId,
      [suggestPlantUMLFn], suggestDiagramFunctionName,
    ).then(chatResponse => {

      // cheap way to check if the function was supported
      if ('function_arguments' in chatResponse && chatResponse.function_arguments) {
        const functionArguments = chatResponse.function_arguments;
        const { code, type } = functionArguments as { code: string, type: string };
        if (code && type) {

          // validate the code
          const plantUML = code.trim();
          if (!plantUML.startsWith('@start') || !(plantUML.endsWith('@enduml') || plantUML.endsWith('@endmindmap'))) {
            console.log(`autoSuggestions: invalid generated PlantUML: ${plantUML.slice(0, 20)}...`);
            throw new Error('Invalid PlantUML');
          }

          // PlantUML Text Content to replace the placeholder
          const fileName = `[Auto Diagram] ${type}.diagram`;
          const codeBlock = attachmentWrapText(plantUML, fileName, 'markdown-code');
          const fragment = createTextContentFragment(codeBlock);
          cHandler.messageFragmentReplace(assistantMessageId, placeholderFragment.fId, fragment, false);
          return;
        }
      }
      // no diagram generated
      cHandler.messageFragmentDelete(assistantMessageId, placeholderFragment.fId, false, false);
    }).catch(error => {
      cHandler.messageFragmentReplace(assistantMessageId, placeholderFragment.fId, createErrorContentFragment(`Auto-Diagram generation issue: ${error?.message || error}`), false);
    });
  }

  // Follow-up: Auto-HTML-UI if the assistant text does not contain <html> already
  if (suggestHTMLUI && !['<html', '<HTML', '<Html'].some(s => assistantMessageText.includes(s))) {

    // Placeholder for the UI
    const placeholderFragment = createPlaceholderContentFragment('Auto-UI ...');
    cHandler.messageFragmentAppend(assistantMessageId, placeholderFragment, false, false);

    const instructions: VChatMessageIn[] = [
      { role: 'system', content: suggestUISystemPrompt.replace('{{personaSystemPrompt}}', wrappedPersonaSystemText) },
      { role: 'user', content: messageFragmentsReduceText(userMessage.fragments) },
      { role: 'assistant', content: assistantMessageText },
    ];
    llmChatGenerateOrThrow(
      funcLLMId, instructions, 'chat-followup-htmlui', conversationId,
      [suggestUIFn], suggestUIFunctionName,
    ).then(chatResponse => {

      // cheap way to check if the function was supported
      if ('function_arguments' in chatResponse && chatResponse.function_arguments) {
        const functionArguments = chatResponse.function_arguments;
        const { html, file_name } = functionArguments as { html: string, file_name: string };
        if (html) {

          // validate the code
          const htmlUI = html.trim();
          if (!['<!DOCTYPE', '<!doctype', '<html', '<HTML', '<Html'].some(s => htmlUI.includes(s))) {
            console.log(`autoSuggestions: invalid generated HTML: ${htmlUI.slice(0, 20)}...`);
            throw new Error('Invalid HTML');
          }

          // HTML UI Text Content to replace the placeholder
          const fileName = (file_name || 'ui').trim().replace(/[^a-zA-Z0-9-]/g, '') + '.html';
          const codeBlock = attachmentWrapText(htmlUI, '[Auto UI] ' + fileName, 'markdown-code');
          const fragment = createTextContentFragment(codeBlock); // `Example of Generative User Interface ("Auto UI" setting):\n${codeBlock}`
          cHandler.messageFragmentReplace(assistantMessageId, placeholderFragment.fId, fragment, false);
          return;
        }
      }
      // no UI generated
      cHandler.messageFragmentDelete(assistantMessageId, placeholderFragment.fId, false, false);
    }).catch(error => {
      cHandler.messageFragmentReplace(assistantMessageId, placeholderFragment.fId, createErrorContentFragment(`Auto-UI generation issue: ${error?.message || error}`), false);
    });
  }

}
