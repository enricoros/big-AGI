import type { Intake_ChatGenerateRequest, Intake_Model } from '../../../intake/schemas.intake.api';
import type { Intake_ChatMessage, Intake_DocPart } from '../../../intake/schemas.intake.messages';
import type { Intake_ToolDefinition, Intake_ToolsPolicy } from '../../../intake/schemas.intake.tools';

import { GeminiWire_API_Generate_Content, GeminiWire_ContentParts, GeminiWire_Messages, GeminiWire_Safety } from '../../wiretypes/gemini.wiretypes';


// configuration
const hotFixImagePartsFirst = true;


export function intakeToGeminiGenerateContent(model: Intake_Model, chatGenerate: Intake_ChatGenerateRequest, geminiSafetyThreshold: GeminiWire_Safety.HarmBlockThreshold, jsonOutput: boolean, _streaming: boolean): TRequest {

  // Note: the streaming setting is ignored as it only belongs in the path

  // System Instructions
  const systemInstruction: TRequest['systemInstruction'] = chatGenerate.systemMessage?.parts.length
    ? { parts: chatGenerate.systemMessage.parts.map(part => GeminiWire_ContentParts.TextContentPart(part.text)) }
    : undefined;

  // Chat Messages
  const contents: TRequest['contents'] = _intakeToGeminiContents(chatGenerate.chatSequence);

  // Construct the request payload
  const payload: TRequest = {
    contents,
    tools: chatGenerate.tools && _intakeToGeminiTools(chatGenerate.tools),
    toolConfig: chatGenerate.toolsPolicy && _intakeToGeminiToolConfig(chatGenerate.toolsPolicy),
    safetySettings: _toGeminiSafetySettings(geminiSafetyThreshold),
    systemInstruction,
    generationConfig: {
      stopSequences: undefined, // (default, optional)
      responseMimeType: jsonOutput ? 'application/json' : undefined,
      responseSchema: undefined, // (default, optional) NOTE: for JSON output, we'd take the schema here
      candidateCount: undefined, // (default, optional)
      maxOutputTokens: model.maxTokens !== undefined ? model.maxTokens : undefined,
      temperature: model.temperature !== undefined ? model.temperature : undefined,
      topP: undefined, // (default, optional)
      topK: undefined, // (default, optional)
    },
  };

  // Preemptive error detection with server-side payload validation before sending it upstream
  const validated = GeminiWire_API_Generate_Content.Request_schema.safeParse(payload);
  if (!validated.success)
    throw new Error(`Invalid message sequence for Gemini models: ${validated.error.errors?.[0]?.message || validated.error.message || validated.error}`);

  return validated.data;
}

type TRequest = GeminiWire_API_Generate_Content.Request;


function _intakeToGeminiContents(chatSequence: Intake_ChatMessage[]): GeminiWire_Messages.Content[] {
  return chatSequence.map(message => {
    const parts: GeminiWire_ContentParts.ContentPart[] = [];

    if (hotFixImagePartsFirst) {
      message.parts.sort((a, b) => {
        if (a.pt === 'inline_image' && b.pt !== 'inline_image') return -1;
        if (a.pt !== 'inline_image' && b.pt === 'inline_image') return 1;
        return 0;
      });
    }

    for (const part of message.parts) {
      switch (part.pt) {

        case 'text':
          parts.push(GeminiWire_ContentParts.TextContentPart(part.text));
          break;

        case 'inline_image':
          parts.push(GeminiWire_ContentParts.InlineDataPart(part.mimeType, part.base64));
          break;

        case 'doc':
          parts.push(_toApproximateGeminiDocPart(part));
          break;

        case 'meta_reply_to':
          parts.push(_toApproximateGeminiReplyTo(part.replyTo));
          break;

        case 'tool_call':
          parts.push(GeminiWire_ContentParts.FunctionCallPart(part.name, part.args));
          break;

        case 'tool_response':
          parts.push(GeminiWire_ContentParts.FunctionResponsePart(part.name, { response: part.response, isError: part.isError }));
          throw new Error('Tool responses are not supported yet - Gemini Expects Objects, but we have a string...');

        default:
          throw new Error(`Unsupported part type in message: ${(part as any).pt}`);
      }
    }

    return {
      role: message.role === 'model' ? 'model' : 'user',
      parts,
    };
  });
}

function _intakeToGeminiTools(itds: Intake_ToolDefinition[]): NonNullable<TRequest['tools']> {
  const tools: TRequest['tools'] = [];

  itds.forEach(itd => {
    switch (itd.type) {

      // Note: we add each function call as a separate tool, however it could be possible to add
      // a single tool with multiple function calls - which one to choose?
      case 'function_call':
        const { name, description, input_schema } = itd.function_call;
        tools.push({
          functionDeclarations: [{
            name,
            description,
            parameters: {
              type: 'object',
              ...input_schema,
            },
          }],
        });
        break;

      case 'gemini_code_interpreter':
        // throw if code execution is present more than once
        if (tools.some(tool => tool.codeExecution))
          throw new Error('Gemini code interpreter already defined');
        tools.push({ codeExecution: {} });
        break;

      case 'preprocessor':
        throw new Error('Preprocessors are not supported yet');
    }
  });

  return tools;
}

function _intakeToGeminiToolConfig(itp: Intake_ToolsPolicy): NonNullable<TRequest['toolConfig']> {
  switch (itp.type) {
    case 'auto':
      return { functionCallingConfig: { mode: 'AUTO' } };
    case 'any':
      return { functionCallingConfig: { mode: 'ANY' } };
    case 'function_call':
      return {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [itp.function_call.name],
        },
      };
  }
}

function _toGeminiSafetySettings(threshold: GeminiWire_Safety.HarmBlockThreshold): TRequest['safetySettings'] {
  return threshold === 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' ? undefined : [
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: threshold },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: threshold },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: threshold },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: threshold },
  ];
}


// Approximate conversions - alternative approaches should be tried until we find the best one

function _toApproximateGeminiDocPart(intakeDocPart: Intake_DocPart): GeminiWire_ContentParts.ContentPart {
  return GeminiWire_ContentParts.TextContentPart(`\`\`\`${intakeDocPart.ref || ''}\n${intakeDocPart.data.text}\n\`\`\`\n`);
}

function _toApproximateGeminiReplyTo(replyTo: string): GeminiWire_ContentParts.ContentPart {
  return GeminiWire_ContentParts.TextContentPart(`<context>The user is referring to this in particular: ${replyTo}</context>`);
}
