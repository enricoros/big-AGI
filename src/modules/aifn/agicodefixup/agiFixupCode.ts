import * as z from 'zod/v4';

import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { aixChatGenerateContent_DMessage_orThrow, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';
import { aixCGR_FromSimpleText } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixFunctionCallTool, aixRequireSingleFunctionCallInvocation } from '~/modules/aix/client/aix.client.fromSimpleFunction';

import { getDomainModelIdOrThrow } from '~/common/stores/llms/store-llms';
import { processPromptTemplate } from '~/common/util/promptUtils';


export type CodeFixType = keyof typeof CodeFixes;

interface CodeFix {
  description: string;
  systemMessage: string;
  userInstructionTemplate: string; // Template with placeholders for `codeToFix` and `errorString`
  functionName: string;
  functionPolicy: 'invoke' | 'think-then-invoke';
  outputSchema: z.ZodObject<{
    corrected_code: z.ZodString;
  }>;
  outputProcessors?: ('unmarkdown')[];
}

const CodeFixes: Record<string, CodeFix> = {

  // See `RenderCodeChartJS`
  'chartjs-issue': {
    description: 'Provides the corrected Chart.js configuration code.',
    systemMessage: `You are an AI assistant that fixes invalid Chart.js configuration JSON.

When provided with invalid Chart.js code, you analyze it, identify errors, especially remove all functions if any, and output a corrected version in valid JSON format.

You MUST:

1. Analyze the JSON

Determine the probable cause or causes of the error.

2. Correct any errors (REMOVE FUNCTIONS!!!)

Functions or strings containing functions are not a valid JSON format and MUST be removed.

3. Provide a valid JSON-only ChartOptions that can be parsed by Chart.js.

Only use valid Chart.js chart types for the 'type' field: bar, bubble, doughnut, line, pie, polarArea, radar, scatter.

Respond first with a very brief analysis of probable errors and changes, and then call the \`{{functionName}}\` function.`,
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

  // See `RenderCodeMermaid`
  'mermaid-issue': {
    description: 'Provides the corrected Mermaid diagram code.',
    systemMessage: `You are an AI assistant that fixes invalid Mermaid diagram code.
When provided with invalid Mermaid code, you analyze it, identify errors, and output a corrected version.
Only use valid Mermaid diagram types: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, journey, gantt, pie, quadrantChart, requirementDiagram, timeline, gitGraph or mindmap.
Respond first with a very brief analysis of where the error is and exactly what to change, and then call the \`{{functionName}}\` function.`,
    userInstructionTemplate: `The following Mermaid code is invalid and cannot be rendered on browsers:
\`\`\`mermaid
{{codeToFix}}
\`\`\`

{{errorMessageSection}}
Please analyze the code, correct any errors (e.g. PROPERLY QUOTE , ESP. BRACKETS), ensure a simple baseline compatibility, and provide a valid Mermaid code that can be rendered.
Make sure to use only valid Mermaid diagram types: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, journey, gantt, pie, quadrantChart, requirementDiagram, timeline, gitGraph or mindmap.
Do not introduce any new diagram types that are not in this list and use valid and correct syntax for the diagram type.`,
    functionName: 'provide_corrected_mermaid_code',
    functionPolicy: 'think-then-invoke',
    outputSchema: z.object({
      corrected_code: z.string().describe('The corrected Mermaid code.'),
    }),
    outputProcessors: ['unmarkdown'],
  },


  // See `RenderCodePlantUML`
  'plantuml-issue': {
    description: 'Provides the corrected PlantUML diagram code.',
    systemMessage: `You are an AI assistant that fixes invalid PlantUML diagram code.

When provided with invalid PlantUML code, you analyze it, identify errors, and output a corrected version.

Ensure that the code starts with '@startuml' and ends with '@enduml'.
Only use valid PlantUML diagram types: sequence, usecase, class, activity, component, state, object, deployment, timing, network, wireframe, gantt, wbs or mindmap.
Pay special attention to proper quoting, especially for labels, notes, and multiline text.

Respond first with a very brief analysis of where the error is and exactly what to change, and then call the \`{{functionName}}\` function.`,
    userInstructionTemplate: `The following PlantUML code is invalid and cannot be rendered:
\`\`\`plantuml
{{codeToFix}}
\`\`\`

{{errorMessageSection}}
Please analyze the code, correct any errors (e.g., syntax, indentation, relationships, QUOTING), ensure compatibility with PlantUML standard, and provide valid PlantUML code that can be rendered.
Make sure to:
1. Use only valid PlantUML diagram types.
2. Correct syntax errors, especially mismatched or missing quotes for labels, notes, and multiline text.
3. Verify proper indentation and structure.
4. Ensure balanced brackets, parentheses, and quotes.
5. Validate relationships and connections between elements.
6. Use correct keywords and directives.
Preserve the original intent and structure as much as possible while fixing the issues.`,
    functionName: 'provide_corrected_plantuml_code',
    functionPolicy: 'think-then-invoke',
    outputSchema: z.object({
      corrected_code: z.string().describe('The corrected PlantUML code.'),
    }),
    outputProcessors: ['unmarkdown'],
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
  const llmId = getDomainModelIdOrThrow(['codeApply'], true, false, 'autofix-code');

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
      // 'invoke' used to force the named tool, DISABLED 2026-07-17 (see ToolsPolicy_schema): with our single tool,
      // 'any' is equivalent and doesn't 400 on vendors that reject named forcing (Fable/Mythos 5, thinking Kimi)
      // config.functionPolicy === 'invoke' ? { type: 'function_call', function_call: { name: config.functionName } }
      config.functionPolicy === 'invoke' ? { type: 'any' }
        : config.functionPolicy === 'think-then-invoke' ? { type: 'auto' } : undefined,
  };

  // Invoke the AI model
  const { fragments } = await aixChatGenerateContent_DMessage_orThrow(
    llmId,
    aixRequest,
    aixCreateChatGenerateContext('fixup-code', '_DEV_'),
    false,
    { abortSignal, llmParamsWrite: { llmTemperature: 0 /* chill the model for fixing code, we need valid json, not creativity */ } },
  );

  // Validate and parse the AI's response
  const { argsObject } = aixRequireSingleFunctionCallInvocation(fragments, config.functionName, config.functionPolicy === 'think-then-invoke', issueType);
  const argsZod = config.outputSchema.parse(argsObject);

  // Apply processors, if any
  let outputCode = argsZod.corrected_code;
  for (const processor of config.outputProcessors || []) {
    // Remove the markdown fences (first and last line, if they are backticks, note that the first line can contain language info)
    if (processor === 'unmarkdown') {
      const lines = outputCode.split('\n');
      if (lines.length > 2) {
        // Remove first line if it's a markdown fence
        if (lines[0].trim().startsWith('```'))
          lines.shift();
        // Remove last line if it's a markdown fence
        if (lines[lines.length - 1].trim().startsWith('```'))
          lines.pop();
        outputCode = lines.join('\n').trim();
      }
    }
  }

  // Return the corrected code
  return outputCode;
}
