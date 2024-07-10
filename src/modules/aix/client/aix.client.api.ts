import type { DMessageDocPart, DMessageTextPart, DMessageToolCallPart, DMessageToolResponsePart } from '~/common/stores/chat/chat.fragments';


// Implementation note: we reuse the 'Parts' from the chat module, and slightly extend/modify it.
// However we may switch to the 'Fragments' concept if we need to uplevel.
//
// This is only the interface between the application and the client (there's no data storage) so
// we can change it without any migration. The client will then issue the server intake request,
// which must match exactly this format.
//
// Chat/Other -- (this schema) --> Client -- (intake request) --> Server -- (dispatch request) --> AI Service
//


// Chat Content Generation - Request Schema

export interface ContentGenerationRequest {
  systemMessage?: AixSystemMessage;
  inputSequence: AixInputMessage[];
  tools?: AixToolDefinition[];
  toolPolicy?: AixToolPolicy;
}

// export interface GenerationParameters {
//   model?: string;
//   temperature?: number;
//   maxTokens?: number;
// }


// System Message Schema

export type AixSystemMessage = {
  parts: DMessageTextPart[];
}


// Input Message Schema

export type AixInputMessage = {
  role: 'user',
  parts: _InputUserParts[];
} | {
  role: 'model',
  parts: _InputModelParts[];
} | {
  role: 'tool',
  parts: _InputToolResponseParts[];
}

type _InputUserParts = DMessageTextPart | InlineImagePart | DMessageDocPart | MetaReplyToPart;
type _InputModelParts = DMessageTextPart | DMessageToolCallPart;
type _InputToolResponseParts = DMessageToolResponsePart;

type InlineImagePart = {
  pt: 'inlineImage';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; // supported by all
  // | 'image/gif' // Anthropic/OpenAI only
  // | 'image/heic' | 'image/heif' // Gemini only
  base64: string;
}

// type InlineAudioPart = {
//   pt: 'inlineAudio';
//   mimeType: 'audio/wav' | 'audio/mp3' | 'audio/aiff' | 'audio/aac' | 'audio/ogg' | 'audio/flac'; // Gemini only
//   base64: string;
// }

type MetaReplyToPart = {
  pt: 'metaReplyTo';
  replyTo: string;
}


// AIX Tools

export type AixToolDefinition =
  | AixToolFunctionCallDefinition
  | AixToolGeminiCodeInterpreter
  | AixToolPreprocessor;

export type AixToolPolicy =
  | { type: 'any' }
  | { type: 'auto' }
  | { type: 'function'; function: { name: string } }
  | { type: 'none' };


// AIX Tools > Function Call

type AixToolFunctionCallDefinition = {
  type: 'function_call';
  function: AixFunctionCall;
};

type AixFunctionCall = {
  /**
   * The name of the function to call. Up to 64 characters long, and can only contain letters, numbers, underscores, and hyphens.
   */
  name: string;
  /**
   * 3-4 sentences. Detailed description of what the tool does, when it should be used (and when not), what each parameter means, caveats and limitations.
   */
  description: string;
  /**
   * A JSON Schema object defining the expected parameters for the function call.
   * (OpenAI,Google: parameters, Anthropic: input_schema)
   */
  input_schema?: AixFunctionCallInputSchema;
};

type AixFunctionCallInputSchema = {
  type: 'object';
  properties: Record<string, OpenAPISchemaObject>;
  required?: string[];
};

/**
 * The TypeScript definition of an "OpenAPI 3.0.3" "Schema Object".
 * This is a subset of the OpenAPI Schema Object, focused on function calling use cases.
 */
type OpenAPISchemaObject = {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  nullable?: boolean;
  enum?: unknown[]; // Changed from any[] to unknown[] for better type safety
  format?: string;
  properties?: Record<string, OpenAPISchemaObject>;
  required?: string[];
  items?: OpenAPISchemaObject;
};


// AIX Tools > Gemini Code Interpreter

type AixToolGeminiCodeInterpreter = {
  type: 'gemini_code_interpreter';
};

// AIX Tools > Preprocessor

type AixToolPreprocessor = {
  type: 'preprocessor';
  pname: 'anthropic_artifacts';
};
