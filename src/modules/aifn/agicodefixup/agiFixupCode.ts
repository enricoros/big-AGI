import type { ZodObject } from 'zod';

import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { aixChatGenerateContent_DMessage, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';
import { aixCGR_FromSimpleText } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixFunctionCallTool, aixRequireSingleFunctionCallInvocation } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import { getLLMIdOrThrow } from '~/common/stores/llms/store-llms';
import { processPromptTemplate } from '~/common/util/promptUtils';


export type CodeFixType = keyof typeof CodeFixes;

interface CodeFix {
  description: string;
  systemMessage: string;
  userInstructionTemplate: string; // Template with placeholders for `codeToFix` and `errorString`
  functionName: string;
  functionPolicy: 'invoke' | 'think-then-invoke';
  outputSchema: ZodObject<any>;
}

const CodeFixes: Record<string, CodeFix> = {};


/**
 *
 */
export async function agiFixupCode(issueType: CodeFixType, codeToFix: string, errorString: string | null, abortSignal: AbortSignal): Promise<string> {

  // Validate the issue type
  const config = CodeFixes[issueType];
  if (!config) throw new Error('Invalid issue type.');

  // Require the Chat LLM (for a change) - as this is a small but important call
  const llmId = getLLMIdOrThrow(['chat', 'fast'], true, false, 'autofix-code');

  // Construct the AI chat generate request
  const templateVariables = {
    codeToFix: codeToFix,
    errorMessageSection: errorString?.trim() ? `The error message was:\n${errorString}\n\n` : '',
    functionName: config.functionName,
  };

  const aixRequest: AixAPIChatGenerate_Request = {
    ...aixCGR_FromSimpleText(
      processPromptTemplate(config.systemMessage, templateVariables, issueType),
      [{ role: 'user', text: processPromptTemplate(config.userInstructionTemplate, templateVariables, issueType) }],
    ),
    tools: [
      aixFunctionCallTool({
        name: config.functionName,
        description: config.description,
        inputSchema: config.outputSchema,
      }),
    ],
    toolsPolicy:
      config.functionPolicy === 'invoke' ? { type: 'function_call', function_call: { name: config.functionName } }
        : config.functionPolicy === 'think-then-invoke' ? { type: 'auto' } : undefined,
  };

  // Invoke the AI model
  const { fragments } = await aixChatGenerateContent_DMessage(
    llmId,
    aixRequest,
    aixCreateChatGenerateContext('fixup-code', '_DEV_'),
    false,
    { abortSignal, llmOptionsOverride: { llmTemperature: 0 /* chill the model for fixing code, we need valid json, not creativity */ } },
  );

  // Validate and parse the AI's response
  const { argsObject } = aixRequireSingleFunctionCallInvocation(fragments, config.functionName, config.functionPolicy === 'think-then-invoke', issueType);
  const argsZod = config.outputSchema.parse(argsObject);

  // Return the corrected code
  return argsZod.corrected_code;
}
