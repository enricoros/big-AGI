import type { AixAPI_Model, AixAPIChatGenerate_Request, AixMessages_ChatMessage } from '../../../api/aix.wiretypes';
import { GeminiWire_API_Interactions } from '../../wiretypes/gemini.wiretypes';

import { aixSpillSystemToUser, approxDocPart_To_String } from './adapters.common';


type TRequest = GeminiWire_API_Interactions.Request;


/**
 * Gemini Interactions API adapter
 *
 * Converts AIX format to Gemini Interactions API format.
 * Used specifically for agents like Deep Research.
 *
 * Key differences from generateContent:
 * - Uses 'agent' instead of 'model' for agent-based interactions
 * - Uses 'input' with turns/content parts instead of 'contents'
 * - Supports background execution for long-running tasks
 * - Uses different streaming format (event_type-based)
 */
export function aixToGeminiInteractions(
  model: AixAPI_Model,
  _chatGenerate: AixAPIChatGenerate_Request,
  streaming: boolean,
): TRequest {

  // Pre-process CGR - approximate spill of System to User message
  const chatGenerate = aixSpillSystemToUser(_chatGenerate);

  // Build system instruction from system message
  let systemInstruction: string | undefined = undefined;
  if (chatGenerate.systemMessage?.parts.length) {
    const systemParts: string[] = [];
    for (const part of chatGenerate.systemMessage.parts) {
      switch (part.pt) {
        case 'text':
          systemParts.push(part.text);
          break;
        case 'doc':
          systemParts.push(approxDocPart_To_String(part));
          break;
        case 'inline_image':
        case 'meta_cache_control':
          // Ignore these for system instruction
          break;
        default:
          console.warn(`[Gemini Interactions] Unsupported system part type: ${(part as any).pt}`);
      }
    }
    if (systemParts.length > 0)
      systemInstruction = systemParts.join('\n\n');
  }

  // Convert chat sequence to turns
  const input = _toInteractionsTurns(chatGenerate.chatSequence);

  // Get the agent name from the model's vndGeminiInteractionsAgent property
  const agentName = model.vndGeminiInteractionsAgent;

  // For Deep Research and other background agents, we use background=true
  // This allows the agent to run asynchronously
  const isBackgroundAgent = agentName?.includes('deep-research');

  // Construct the request payload
  const payload: TRequest = {
    // Agent-based interactions use 'agent' instead of 'model'
    agent: agentName,

    // Input as array of turns
    input,

    // System instruction (if any)
    system_instruction: systemInstruction,

    // Generation config
    generation_config: {
      temperature: model.temperature ?? undefined,
      max_output_tokens: model.maxTokens ?? undefined,
      // Map thinking level for agents that support it
      thinking_level: model.vndGeminiThinkingLevel ?? undefined,
    },

    // API options
    stream: streaming,
    background: isBackgroundAgent, // Enable background for Deep Research
    store: true, // Enable storage for state management
  };

  // Clean up undefined values
  if (!payload.system_instruction)
    delete payload.system_instruction;
  if (payload.generation_config) {
    if (payload.generation_config.temperature === undefined)
      delete payload.generation_config.temperature;
    if (payload.generation_config.max_output_tokens === undefined)
      delete payload.generation_config.max_output_tokens;
    if (payload.generation_config.thinking_level === undefined)
      delete payload.generation_config.thinking_level;
    if (Object.keys(payload.generation_config).length === 0)
      delete payload.generation_config;
  }

  // Validate the payload
  const validated = GeminiWire_API_Interactions.Request_schema.safeParse(payload);
  if (!validated.success) {
    console.warn('Gemini Interactions: invalid payload. Error:', validated.error.message);
    throw new Error(`Invalid sequence for Gemini Interactions API: ${validated.error.issues?.[0]?.message || validated.error.message || validated.error}.`);
  }

  return validated.data;
}


// Content part type for Interactions API input
type TContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data?: string; mime_type?: string }
  | { type: 'audio'; data?: string; mime_type?: string }
  | { type: 'function_result'; name: string; call_id: string; result: unknown };

// Turn type for Interactions API input
type TTurn = {
  role: 'user' | 'model';
  content: TContentPart[];
};


/**
 * Convert AIX chat messages to Interactions API turns format
 */
function _toInteractionsTurns(chatSequence: AixMessages_ChatMessage[]): TTurn[] {
  return chatSequence.map(message => {
    const content: TContentPart[] = [];

    for (const part of message.parts) {
      switch (part.pt) {

        case 'text':
          content.push({
            type: 'text',
            text: part.text,
          });
          break;

        case 'inline_image':
          content.push({
            type: 'image',
            data: part.base64,
            mime_type: part.mimeType,
          });
          break;

        case 'inline_audio':
          content.push({
            type: 'audio',
            data: part.base64,
            mime_type: part.mimeType,
          });
          break;

        case 'doc':
          // Convert doc to text for now
          content.push({
            type: 'text',
            text: approxDocPart_To_String(part),
          });
          break;

        case 'ma':
          // Model artifact (thinking) - skip for input
          break;

        case 'meta_cache_control':
        case 'meta_in_reference_to':
          // Skip metadata parts
          break;

        case 'tool_invocation':
          // For function calls, we'd need to handle these specially
          // For Deep Research, this is less relevant
          console.warn('[Gemini Interactions] Tool invocations not yet supported in input');
          break;

        case 'tool_response':
          // Function results
          if (part.response.type === 'function_call') {
            content.push({
              type: 'function_result',
              name: part.response._name || part.id,
              call_id: part.id,
              result: part.response.result,
            });
          }
          break;

        default:
          console.warn(`[Gemini Interactions] Unsupported part type: ${(part as any).pt}`);
      }
    }

    // If no content, add empty text
    if (content.length === 0)
      content.push({ type: 'text', text: '' });

    return {
      role: message.role === 'model' ? 'model' : 'user',
      content,
    };
  });
}
