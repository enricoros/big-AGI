import { z } from 'zod';

import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { AixClientFunctionCallToolDefinition, aixFunctionCallTool, aixRequireSingleFunctionCallInvocation } from '~/modules/aix/client/aix.client.fromSimpleFunction';
import { aixCGR_ChatSequence_FromDMessagesOrThrow, aixCGR_SystemMessageText } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixChatGenerateContent_DMessage, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';

import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { createDMessageTextContent, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { createErrorContentFragment, createPlaceholderVoidFragment, createTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { getLLMIdOrThrow } from '~/common/stores/llms/store-llms';
import { marshallWrapText } from '~/common/stores/chat/chat.tokens';
import { processPromptTemplate } from '~/common/util/promptUtils';
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
        description: 'Very brief title, e.g., Meaning of Life',
      },
    },
    required: ['question_as_user', 'title'],
  },
};*/


// NOTE: also see the definition of the fixups in `src/modules/aifn/agicodefixup/agiFixupCode.ts`
interface DumbToolTBD {
  sys: string;
  usr: string;
  fun: AixClientFunctionCallToolDefinition,
}


function _getSystemMessage(tool: DumbToolTBD, variables: Record<string, string>, templateName: string): AixAPIChatGenerate_Request['systemMessage'] {
  return aixCGR_SystemMessageText(processPromptTemplate(tool.sys, { ...variables, functionName: tool.fun.name }, templateName));
}


// Auto-Diagram

const diagramsTool = {
  // variables: personaSystemPrompt, functionName
  sys: `You are an expert AI assistant skilled in creating diagrams. Analyze the conversation and user persona below to determine if a PlantUML diagram would complement or enhance the user's understanding.

Rate the diagram's usefulness (1-5): 1: Misleading, unnecessary or duplicate, 2: Not a fit or trivial, 3: Potentially useful to the user, 4: Very useful, 5: Essential.

Only if the rating is 4 or 5, include the diagram code, otherwise leave it empty and STOP.

---

# Assistant personality type:
{{personaSystemPrompt}}

---

# Instructions
Analyze the following short exchange and call the function {{functionName}} with the results of your analysis including code only if the score is 4 or 5.`,
  usr: 'Analyze the conversation and call {{functionName}} to assess diagram relevance and generate PlantUML if highly relevant.',
  fun: {
    name: 'draw_plantuml_diagram',
    description: 'Generates a PlantUML diagram or mindmap from the last message, if applicable, very useful to the user, and no other diagrams are present.',
    inputSchema: z.object({
      rating_short_reason: z.string().describe('A 4-10 words reason on whether the diagram would be desired by the user or not.'),
      rating_number: z.number().int().describe('The relevance of the diagram to the conversation, on a scale of 1 to 5 . If lower than 4, STOP.'),
      type: z.string().describe('The most suitable PlantUML diagram type: sequence, usecase, class, activity, component, state, object, deployment, timing, network, wireframe, gantt, wbs or mindmap.').optional(),
      code: z.string().describe('A valid PlantUML string (@startuml...@enduml) to be rendered as a diagram or mindmap (@startmindmap...@endmindmap), or empty. No external references allowed. Use one or more asterisks to indent and separate with spaces.').optional(),
    }),
  },
} satisfies DumbToolTBD;


// Auto-HTML-UI

const suggestUIFunctionName = 'generate_web_ui';

export const autoFollowUpUIMixin = `Do not generate code, unless via the \`${suggestUIFunctionName}\` function call, IF DEFINED`;

// noinspection HtmlRequiredTitleElement
const uiTool = {
  sys: `You are a helpful AI assistant skilled in creating user interfaces. Analyze the conversation and user persona below to determine if an HTML user interface would complement or enhance the user's understanding.

**Rating System**
Rate the UI's usefulness (1-5): 1. Misleading, unnecessary, or duplicate, 2. Not a fit or trivial, 3. Potentially useful or thought-provoking to the user, 4. Very useful, 5. Essential

Only if the rating is 3, 4, or 5, generate the HTML code. Ensure the generated UI is visual, interactive, resilient, and engaging.

**Assistant Personality Type**
{{personaSystemPrompt}}

**Instructions**
Analyze the following short exchange and call the function {{functionName}} with the HTML code only if the score is 3, 4, or 5.

Please follow closely the following requirements:
- **Generate Web UIs** such as interactive games, blueprints, mockups, data visualizations, dashboards, and tutorials.
- **Code Quality and Resilience:** The single-file HTML, CSS, and JavaScript code must be correct and resilient, as there will be no opportunity to modify it after.
- **Include HTML Comments:** After the DOCTYPE, explain your brief concept choices and short implementation guidelines.
- **Frontend-Only Architecture:** The code should be self-contained, using HTML, CSS, and JavaScript only. External images are allowed. Must not require backend or environment setup.
- **Include Tailwind CSS:** Add \`<script src='https://cdn.tailwindcss.com/3.4.3'></script>\` in the \`<head>\` section.
- **Incorporate Trends:** Selectively use abstract gradients, color clashing, vintage minimalism, geometric shapes, or 3D bubble text where they enhance the UI's purpose and user experience.
- **Functional Requirements:** The UI must solve the user's problem, demonstrate a complete feature or concept, be visually impressive, and renderable in isolation.`,
  usr: 'Analyze the conversation and call {{functionName}} to evaluate UI relevance and generate HTML code if sufficiently useful.',
  fun: {
    name: suggestUIFunctionName,
    description: 'Renders a web UI when provided with a single concise HTML5 string (can include CSS and JS), if applicable and relevant.',
    inputSchema: z.object({
      possible_ui_requirements: z.string().describe('Brief (10 words) to medium length (40 words) requirements for the UI. Include main features, looks, and layout.'),
      rating_short_reason: z.string().describe('A 4-10 word reason on whether the UI would be desired by the user or not.'),
      rating_number: z.number().int().describe('The relevance of the UI to the conversation, on a scale of 1 (does not add much value), 2 (superfluous), 3 (helps a lot in understanding), 4 (essential) to 5 (fundamental to the understanding). If 1 or 2, do not proceed and STOP.'),
      html: z.string().describe('A valid HTML string containing the user interface code. The code should be complete, with no dependencies, lower case, and include minimal inline CSS if needed. The UI should be visual and interactive.').optional(),
      file_name: z.string().describe('Short letters-and-dashes file name of the HTML without the .html extension.').optional(),
    }),
  },
} satisfies DumbToolTBD;


/**
 * Formulates proposals (based on 2 messages, at least) for:
 * - Diagrams: will process the message and append diagrams
 * - HTML UI: automatically append a HTML UI, if valuable
 * - [missing] follow-up questions
 * - [missing] prompts
 * - [missing] counterpoints
 */
export async function autoChatFollowUps(conversationId: string, assistantMessageId: string, suggestDiagrams: boolean, suggestHTMLUI: boolean, suggestQuestions: boolean) {

  // skip invalid or short conversations
  const { conversations } = useChatStore.getState();
  const conversation = conversations.find(c => c.id === conversationId) ?? null;
  if (!conversation || conversation.messages.length < 2) return;

  // require a valid fast model (only)
  let llmId;
  try {
    llmId = getLLMIdOrThrow(['fast'], true, false, 'chat-followups');
  } catch (error) {
    return console.log(`autoSuggestions: ${error}`);
  }

  // find the index of the assistant message
  const assistantMessageIndex = conversation.messages.findIndex(m => m.id === assistantMessageId);
  if (assistantMessageIndex < 2) return;

  const systemMessage = conversation.messages[0];
  const userMessage = conversation.messages[assistantMessageIndex - 1];
  const assistantMessage = conversation.messages[assistantMessageIndex];

  // verify the roles of the last messages
  if (!(systemMessage?.role === 'system') || !(userMessage?.role === 'user') || !(assistantMessage?.role === 'assistant')) return;

  // Execute the following follow-ups in parallel
  // const assistantMessageId = assistantMessage.id;

  const personaSystemPrompt = messageFragmentsReduceText(systemMessage.fragments);
  const assistantMessageText = messageFragmentsReduceText(assistantMessage.fragments);

  const cHandler = ConversationsManager.getHandler(conversationId);

  // Follow-up: Question
  if (suggestQuestions) {
    // ... TODO ...
  }

  // Follow-up: Auto-Diagrams if the assistant text does not contain @startuml / @startmindmap already
  if (suggestDiagrams && !['@startuml', '@startmindmap', '```plantuml', '```mermaid'].some(s => assistantMessageText.includes(s))) {

    // Placeholder for the diagram
    const placeholderFragment = createPlaceholderVoidFragment('Auto-Diagram ...');
    cHandler.messageFragmentAppend(assistantMessageId, placeholderFragment, false, false);

    // Instructions
    const systemMessage = _getSystemMessage(diagramsTool, { personaSystemPrompt }, 'chat-followup-diagram_system');
    const chatSequence = await aixCGR_ChatSequence_FromDMessagesOrThrow([
      userMessage,
      assistantMessage,
      createDMessageTextContent('user', processPromptTemplate(diagramsTool.usr, { functionName: diagramsTool.fun.name }, 'chat-followup-diagram_reminder')),
    ]);

    // Strict call to a function
    aixChatGenerateContent_DMessage(
      llmId,
      { systemMessage, chatSequence, tools: [aixFunctionCallTool(diagramsTool.fun)], toolsPolicy: { type: 'any' } },
      aixCreateChatGenerateContext('chat-followup-diagram', conversationId),
      false,
      { abortSignal: 'NON_ABORTABLE' },
    ).then(({ fragments }) => {

      // extract the function call
      const { argsObject } = aixRequireSingleFunctionCallInvocation(fragments, diagramsTool.fun.name, false, 'chat-followup-diagram');
      const { code, type } = diagramsTool.fun.inputSchema.parse(argsObject);
      if (code && type) {

        // validate the code
        const plantUML = code.trim();
        if (!plantUML.startsWith('@start') || !(plantUML.endsWith('@enduml') || plantUML.endsWith('@endmindmap'))) {
          console.log(`autoSuggestions: invalid generated PlantUML: ${plantUML.slice(0, 20)}...`);
          throw new Error('Invalid PlantUML');
        }

        // PlantUML Text Content to replace the placeholder
        const fileName = `${type}.diagram`;
        const codeBlock = marshallWrapText(plantUML, /*'[Auto Diagram] ' +*/ fileName, 'markdown-code');
        const fragment = createTextContentFragment(codeBlock);
        cHandler.messageFragmentReplace(assistantMessageId, placeholderFragment.fId, fragment, false);
        return;
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
    const placeholderFragment = createPlaceholderVoidFragment('Auto-UI ...');
    cHandler.messageFragmentAppend(assistantMessageId, placeholderFragment, false, false);

    // Instructions
    const systemMessage = _getSystemMessage(uiTool, { personaSystemPrompt }, 'chat-followup-htmlui_system');
    const chatSequence = await aixCGR_ChatSequence_FromDMessagesOrThrow([
      userMessage,
      assistantMessage,
      createDMessageTextContent('user', processPromptTemplate(uiTool.usr, { functionName: uiTool.fun.name }, 'chat-followup-htmlui_reminder')),
    ]);

    // Strict call to a function
    aixChatGenerateContent_DMessage(
      llmId,
      { systemMessage, chatSequence, tools: [aixFunctionCallTool(uiTool.fun)], toolsPolicy: { type: 'any' } },
      aixCreateChatGenerateContext('chat-followup-htmlui', conversationId),
      false,
      { abortSignal: 'NON_ABORTABLE' },
    ).then(({ fragments }) => {

      // extract the function call
      const { argsObject } = aixRequireSingleFunctionCallInvocation(fragments, uiTool.fun.name, false, 'chat-followup-diagram');
      const { html, file_name } = uiTool.fun.inputSchema.parse(argsObject);
      if (html && file_name) {

        // validate the code
        const htmlUI = html.trim();
        if (!['<!DOCTYPE', '<!doctype', '<html', '<HTML', '<Html'].some(s => htmlUI.includes(s))) {
          console.log(`autoSuggestions: invalid generated HTML: ${htmlUI.slice(0, 20)}...`);
          throw new Error('Invalid HTML');
        }

        // HTML UI Text Content to replace the placeholder
        const fileName = (file_name || 'ui').trim().replace(/[^a-zA-Z0-9-]/g, '') + '.html';
        const codeBlock = marshallWrapText(htmlUI, /*'[Generative UI] ' +*/ fileName, 'markdown-code');
        const fragment = createTextContentFragment(codeBlock); // `Example of Generative User Interface ("Auto UI" setting):\n${codeBlock}`
        cHandler.messageFragmentReplace(assistantMessageId, placeholderFragment.fId, fragment, false);
        return;
      }

      // no UI generated
      cHandler.messageFragmentDelete(assistantMessageId, placeholderFragment.fId, false, false);
    }).catch(error => {
      cHandler.messageFragmentReplace(assistantMessageId, placeholderFragment.fId, createErrorContentFragment(`Auto-UI generation issue: ${error?.message || error}`), false);
    });
  }

}