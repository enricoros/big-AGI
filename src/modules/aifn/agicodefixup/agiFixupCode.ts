import { z, type ZodObject } from 'zod';

import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { aixChatGenerateContent_DMessage, aixCreateChatGenerateStreamContext } from '~/modules/aix/client/aix.client';
import { aixChatGenerateRequestSimple } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixFunctionCallTool, aixRequireSingleFunctionCallInvocation } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import { getChatLLMId } from '~/common/stores/llms/store-llms';
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

const CodeFixes: Record<string, CodeFix> = {

  // See `RenderCodeChartJS`
  'chartjs-issue': {
    description: 'Provides the corrected Chart.js configuration code.',
    systemMessage: `You are an AI assistant that fixes invalid Chart.js configuration JSON.
When provided with invalid Chart.js code, you analyze it, identify errors, especially remove all functions if any, and output a corrected version in valid JSON format.
Respond first with a very brief analysis of where the error is and exactly what to change, and then call the \`{{functionName}}\` function.`,
    userInstructionTemplate: `The following Chart.js ChartOptions JSON is invalid and cannot be parsed:
\`\`\`json
{{codeToFix}}
\`\`\`

{{errorMessageSection}}
Please analyze the JSON, correct any errors (REMOVE FUNCTIONS!!!), and provide a valid JSON-only ChartOptions that can be parsed by Chart.js.`,
    functionName: 'provide_corrected_chartjs_code',
    functionPolicy: 'think-then-invoke',
    outputSchema: z.object({
      corrected_code: z.string().describe('The corrected Chart.js ChartOptions in valid JSON format.'),
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

  // Require the Chat LLM (for a change) - as this is a small but important call
  const llmId = getChatLLMId();
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
    toolsPolicy:
      config.functionPolicy === 'invoke' ?  { type: 'function_call', function_call: { name: config.functionName } }
        : config.functionPolicy === 'think-then-invoke' ? { type: 'auto' } : undefined,
  };

  // Invoke the AI model
  const { fragments } = await aixChatGenerateContent_DMessage(
    llmId,
    aixRequest,
    aixCreateChatGenerateStreamContext('DEV', 'DEV'),
    false,
    { abortSignal, llmOptionsOverride: { llmTemperature: 0 /* chill the model for fixing code, we need valid json, not creativity */ } },
  );

  // Validate and parse the AI's response
  const { argsObject } = aixRequireSingleFunctionCallInvocation(fragments, config.functionName, config.functionPolicy === 'think-then-invoke', issueType);
  const argsZod = config.outputSchema.parse(argsObject);

  // Return the corrected code
  return argsZod.corrected_code;
}
