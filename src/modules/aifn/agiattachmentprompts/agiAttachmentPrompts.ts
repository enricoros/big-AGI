import { z } from 'zod';

import { getLLMIdOrThrow } from '~/common/stores/llms/store-llms';

import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { aixCGR_ChatSequence_FromDMessagesOrThrow, aixCGR_SystemMessageText } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixChatGenerateContent_DMessage, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';
import { aixFunctionCallTool, aixRequireSingleFunctionCallInvocation } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import { createTextContentFragment, DMessageAttachmentFragment, isImageRefPart } from '~/common/stores/chat/chat.fragments';


export async function agiAttachmentPrompts(attachmentFragments: DMessageAttachmentFragment[], abortSignal: AbortSignal) {

  // precondition
  // const docParts = attachmentFragments.filter(f => f.part.pt === 'doc').map(f => f.part) as DMessageDocPart[];
  // const docs_count = docParts.length;
  const docs_count = attachmentFragments.length;
  if (docs_count < 1)
    return [];

  // require llm
  const requireVision = attachmentFragments.some(f => isImageRefPart(f.part));
  const llmId = getLLMIdOrThrow(['fast', 'chat'], true, requireVision, 'guess-attachments-prompts');

  const num_suggestions = 3;

  const inputSchema = z.object({
    attachments_analysis: z.array(
      z.object({
        name: z.string().describe('Identifier of the file.'),
        type: z.string().describe('Type or format of the file.'),
        summary: z.string().describe('Brief summary of the file\'s content, structure, commonalities and uniqueness. Be specific.'),
      }),
    ).describe(`Analysis of the ${docs_count} attachments.`),
    relationships: z.string().describe('Identified patterns, relationships, dependencies and differences between the attachments.'),
    top_orthogonal_user_actions: z.array(
      z.string().describe('Proposed action that relates to all the content, written as a authentic 5-15 words instruction coming from the user, each starting with an action verb.'),
    ).describe(`Top${num_suggestions} orthogonal inferred actions, deeply tied to patterns between the content, each action relating to all attachments.`),
    most_valuable_action: z.string().describe(`The most valuable option to take, considering the nature of all attachments. Suggested something at the intersection of the ${docs_count} attachments.`).optional(),
  });

  const aixChatGenerate: AixAPIChatGenerate_Request = {
    systemMessage: aixCGR_SystemMessageText(
      `You are an AI assistant skilled in content analysis and task inference within a chat application. 
Your function is to examine the attachments provided by the user, understand their nature and potential relationships, guess the user intention, and suggest the most likely and valuable actions the user intends to perform.
Respond only by calling the propose_user_actions_for_attachments function.`),
    chatSequence: await aixCGR_ChatSequence_FromDMessagesOrThrow([{
      role: 'user',
      fragments: [createTextContentFragment(`The user wants to perform an action for which is attaching ${docs_count} related pieces of content.
Analyze the provided content to determine its nature, identify any relationships between the pieces, and infer the most probable high-value task or action the user wants to perform.`)],
    }, {
      role: 'user',
      fragments: attachmentFragments,
    }, {
      role: 'user',
      fragments: [createTextContentFragment(`Call the function once, filling in order the attachments, the relationships between them, the top ${num_suggestions} orthogonal actions you inferred and the single most valuable action.`)],
    }]),
    tools: [
      aixFunctionCallTool({
        name: 'propose_user_actions_for_attachments',
        description: `Proposes ${num_suggestions} user actions from content analysis of ${docs_count} contents.`,
        inputSchema,
      }),
    ],
    toolsPolicy: { type: 'any' },
  } as const;

  const { fragments } = await aixChatGenerateContent_DMessage(
    llmId,
    aixChatGenerate,
    aixCreateChatGenerateContext('chat-attachment-prompts', attachmentFragments[0].fId),
    false,
    { abortSignal },
  );

  // extract the function call
  const { argsObject } = aixRequireSingleFunctionCallInvocation(fragments, 'propose_user_actions_for_attachments', false, 'agiAttachmentPrompts');

  const args = inputSchema.parse(argsObject);
  if (!args.top_orthogonal_user_actions?.length)
    throw new Error('AIX: Missing output');

  // prepend the top action to the list
  let topActions = args.top_orthogonal_user_actions;
  if (args.most_valuable_action) {
    topActions = topActions.filter(a => a !== args.most_valuable_action);
    topActions.unshift(args.most_valuable_action);
  }
  // return top 3
  return (topActions || []).slice(0, 3);
}
