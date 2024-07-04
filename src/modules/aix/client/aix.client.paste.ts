interface GenerationRequest {
  systemMessage?: SystemMessageContainer;
  inputSequence: InputContainer[];
  model?: string;
  parameters?: GenerationParameters;
}

interface SystemMessageContainer {
  blocks: SystemMessageBlock[];
}

interface SystemMessageBlock {
  type: 'text';
  content: string;
}

interface InputContainer {
  blocks: InputBlock[];
}

type InputBlock = TextInputBlock | ImageInputBlock | VideoInputBlock | ToolResponseInputBlock;

interface TextInputBlock {
  type: 'text';
  content: string;
}

interface ImageInputBlock {
  type: 'image';
  content: Blob;
}

interface VideoInputBlock {
  type: 'video';
  content: Blob;
}

interface ToolResponseInputBlock {
  type: 'tool_response';
  content: ToolResponse;
}

interface ToolResponse {
  toolName: string;
  result: any;
}

// Output types
type OutputBlock = TextOutputBlock | ToolRequestOutputBlock;

interface TextOutputBlock {
  type: 'text';
  content: string;
}

interface ToolRequestOutputBlock {
  type: 'tool_request';
  content: ToolRequest;
}

interface ToolRequest {
  toolName: string;
  parameters: Record<string, any>;
}

interface GenerationParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  // ... other essential parameters
}