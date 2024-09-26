import { z, type ZodObject } from 'zod';

import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { aixChatGenerateContent_DMessage, aixCreateChatGenerateStreamContext } from '~/modules/aix/client/aix.client';
import { aixChatGenerateRequestSimple } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixFunctionCallTool, aixRequireSingleFunctionCallInvocation } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import { getFastLLMId } from '~/common/stores/llms/store-llms';
import { processPromptTemplate } from '~/common/util/promptUtils';


export type CodeFixType = keyof typeof CodeFixes;

interface CodeFix {
  description: string;
  systemMessage: string;
  userInstructionTemplate: string; // Template with placeholders for `codeToFix` and `errorString`
  functionName: string;
  outputSchema: ZodObject<any>;
}

const CodeFixes: Record<string, CodeFix> = {

  // See `RenderCodeChartJS`
  'chartjs-issue': {
    description: 'Provides the corrected ChartJS configuration code.',
    systemMessage: `You are an AI assistant that helps fix invalid ChartJS configuration JSON code.
When provided with invalid ChartJS code, you analyze it, identify errors, and output a corrected version in valid JSON format.
Respond only by calling the \`{{functionName}}\` function.`,
    userInstructionTemplate: `The following ChartJS configuration code is invalid and cannot be parsed:
\`\`\`json
{{codeToFix}}
\`\`\`

{{errorMessageSection}}
Please analyze the code, correct any errors, in particular remove functions if any, and provide a valid JSON configuration that can be parsed by ChartJS.
Call the function \`{{functionName}}\` once, providing the corrected code.`,
    functionName: 'provide_corrected_chartjs_code',
    outputSchema: z.object({
      corrected_code: z.string().describe('The corrected ChartJS configuration code in valid JSON format.'),
    }),
  },

};


/**
 *
 */
export async function agiFixupCode(issueType: CodeFixType, codeToFix: string, errorString: string | null, abortSignal: AbortSignal): Promise<string> {

  // Validate the issue type
  const config = CodeFixes[issueType];
  if (!config) throw new Error('Invalid issue type.');

  // Require the Fast LLM
  const llmId = getFastLLMId();
  if (!llmId) throw new Error('No LLM configured.');


  // Construct the AI chat generate request
  const templateVariables = {
    codeToFix: codeToFix,
    errorMessageSection: errorString?.trim() ? `The error message was:\n${errorString}\n\n` : '',
    functionName: config.functionName,
  };

  const aixRequest: AixAPIChatGenerate_Request = {
    ...aixChatGenerateRequestSimple(
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
    toolsPolicy: { type: 'function_call', function_call: { name: config.functionName } },
  };

  // Invoke the AI model
  const { fragments } = await aixChatGenerateContent_DMessage(
    llmId,
    aixRequest,
    aixCreateChatGenerateStreamContext('DEV', 'DEV'),
    false,
    { abortSignal },
  );

  // Validate and parse the AI's response
  const { argsObject } = aixRequireSingleFunctionCallInvocation(fragments, config.functionName, issueType);
  const argsZod = config.outputSchema.parse(argsObject);

  // Return the corrected code
  return argsZod.corrected_code;
}
