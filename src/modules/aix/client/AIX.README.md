# AIX

AIX is a client-side API for integrating advanced AI capabilities into web applications.

## Overview

AIX provides a unified interface to incorporate various AI functionalities into web apps, abstracting the complexities of underlying AI services.

## Features

- Content Generation
- Information Extraction
- Image Manipulation
- Multi-Modal Reasoning
- Adaptive AI Personas
- Complex AI Workflows

## Benefits

- Single API for multiple AI services
- Full TypeScript support
- React components for rapid integration
- Supports simple tasks to complex, interactive AI workflows

## Structure
Here's the file structure we'll use:

1. `types.ts`: Basic types used across the API
2. `blocks.ts`: Input and output block definitions
3. `parameters.ts`: Parameter interfaces for various API calls
4. `foundation-api.ts`: Foundation API interfaces
5. `advanced-api.ts`: Advanced API interfaces
6. `instruction-api.ts`: Instruction API interfaces and types
7. `aix-client.ts`: Main client interface (without implementation)
8. `react-component.tsx`: React component for using the AIX API

Let's go through each file in detail:

1. `types.ts`

```typescript
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamOptions<T> {
  onPartialResponse?: (partial: Partial<T>) => void;
  signal?: AbortSignal;
}

export interface ExtractionSchema {
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    description?: string;
  }>;
}

export interface MultiModalContext {
  text?: string[];
  images?: ImageInputBlock[];
  structuredData?: Record<string, any>;
}

export interface PersonaState {
  knowledgeGrowth: Record<string, number>;
  adaptationLevel: number;
  specializations: string[];
}
```

2. `blocks.ts`

```typescript
export type InputBlock = InputContentBlock | InputMetaBlock;

export type InputContentBlock = 
  | TextInputBlock
  | ImageInputBlock
  | ToolOutputBlock
  | FunctionCallResultBlock
  | EmbeddingInputBlock;

export type InputMetaBlock =
  | ContextMetaBlock
  | ControlMetaBlock;

export interface TextInputBlock {
  type: 'text';
  content: string;
  role: 'user' | 'assistant' | 'function';
}

export interface ImageInputBlock {
  type: 'image';
  content: string;
  mimeType: string;
}

export interface ToolOutputBlock {
  type: 'tool_output';
  toolName: string;
  content: any;
}

export interface FunctionCallResultBlock {
  type: 'function_call_result';
  name: string;
  content: any;
}

export interface EmbeddingInputBlock {
  type: 'embedding';
  content: number[];
}

export interface ContextMetaBlock {
  type: 'context';
  contextType: string;
  content: any;
}

export interface ControlMetaBlock {
  type: 'control';
  instruction: string;
}

export type OutputBlock = OutputContentBlock | OutputMetaBlock;

export type OutputContentBlock = 
  | TextOutputBlock
  | ImageOutputBlock
  | ToolCallOutputBlock
  | FunctionCallOutputBlock;

export type OutputMetaBlock =
  | ErrorOutputBlock
  | CompletionStatusBlock
  | ConfidenceBlock;

export interface TextOutputBlock {
  type: 'text';
  content: string;
  role: 'assistant' | 'system';
}

export interface ImageOutputBlock {
  type: 'image';
  url: string;
  mimeType: string;
}

export interface ToolCallOutputBlock {
  type: 'tool_call';
  toolName: string;
  arguments: Record<string, any>;
}

export interface FunctionCallOutputBlock {
  type: 'function_call';
  name: string;
  arguments: string;
}

export interface ErrorOutputBlock {
  type: 'error';
  code: string;
  message: string;
}

export interface CompletionStatusBlock {
  type: 'completion_status';
  status: 'complete' | 'incomplete' | 'truncated';
}

export interface ConfidenceBlock {
  type: 'confidence';
  score: number;
}
```

3. `parameters.ts`

```typescript
export interface BaseParameters {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerationParameters extends BaseParameters {
  // Additional generation-specific parameters
}

export interface ExtractionParameters extends BaseParameters {
  // Additional extraction-specific parameters
}

export interface ImageManipulationParameters extends BaseParameters {
  dimensions?: { width: number; height: number };
  style?: string;
}

export interface ReasoningParameters extends BaseParameters {
  depthOfAnalysis?: 'shallow' | 'moderate' | 'deep';
}

export interface PersonaParameters extends BaseParameters {
  personaId: string;
}
```

4. `foundation-api.ts`

```typescript
import { InputBlock, OutputBlock } from './blocks';
import { GenerationParameters, ExtractionParameters, ImageManipulationParameters } from './parameters';
import { TokenUsage, StreamOptions, ExtractionSchema } from './types';

export interface GenerationRequest {
  inputSequence: InputBlock[];
  parameters: GenerationParameters;
}

export interface GenerationResponse {
  outputSequence: OutputBlock[];
  usage: TokenUsage;
}

export interface ExtractionRequest {
  data: string | Blob;
  schema: ExtractionSchema;
  parameters: ExtractionParameters;
}

export interface ExtractedInformation {
  [key: string]: any;
}

export interface ImageManipulationRequest {
  operation: 'generate' | 'edit' | 'variation';
  prompt?: string;
  baseImage?: ImageInputBlock;
  parameters: ImageManipulationParameters;
}

export interface ImageManipulationResult {
  images: ImageOutputBlock[];
  metadata: Record<string, any>;
}

export interface FoundationAPIs {
  generateContent(
    request: GenerationRequest,
    options?: StreamOptions<GenerationResponse>
  ): Promise<GenerationResponse>;

  extractInformation(
    request: ExtractionRequest,
    options?: StreamOptions<ExtractedInformation>
  ): Promise<ExtractedInformation>;

  imageManipulation(
    request: ImageManipulationRequest,
    options?: StreamOptions<ImageManipulationResult>
  ): Promise<ImageManipulationResult>;
}
```

5. `advanced-api.ts`

```typescript
import { InputBlock, OutputBlock } from './blocks';
import { ReasoningParameters, PersonaParameters } from './parameters';
import { MultiModalContext, PersonaState, StreamOptions } from './types';

export interface MultiModalReasoningRequest {
  context: MultiModalContext;
  query: string;
  parameters: ReasoningParameters;
}

export interface ReasoningResult {
  conclusion: string;
  confidenceScore: number;
  supportingEvidence: any[];
}

export interface PersonaInteractionRequest {
  input: InputBlock[];
  parameters: PersonaParameters;
}

export interface PersonaResponse {
  output: OutputBlock[];
  personaState: PersonaState;
}

export interface AdvancedAPIs {
  multiModalReasoning(
    request: MultiModalReasoningRequest,
    options?: StreamOptions<ReasoningResult>
  ): Promise<ReasoningResult>;

  adaptivePersona(
    request: PersonaInteractionRequest,
    options?: StreamOptions<PersonaResponse>
  ): Promise<PersonaResponse>;
}
```

6. `instruction-api.ts`

```typescript
export interface Instruction {
  id: string;
  type: string;
  parameters: Record<string, any>;
  condition?: (context: ExecutionContext) => boolean;
  userInteraction?: UserInteractionConfig;
  subInstructions?: Instruction[];
}

export interface UserInteractionConfig {
  componentType: string;
  props: Record<string, any>;
}

export interface InstructionResult {
  id: string;
  type: string;
  status: 'completed' | 'awaiting_user_input' | 'cancelled' | 'error';
  output?: any;
  error?: string;
  userInteraction?: UserInteractionConfig;
}

export interface ExecutionContext {
  variables: Record<string, any>;
  results: InstructionResult[];
}

export interface ExecuteInstructionsOptions {
  initialContext?: Partial<ExecutionContext>;
  onUserInteractionRequired: (interaction: UserInteractionConfig) => Promise<UserInteractionResult>;
  onProgress?: (result: InstructionResult) => void;
  onCancel?: () => void;
  signal?: AbortSignal;
}

export interface UserInteractionResult {
  status: 'completed' | 'cancelled';
  data?: any;
}
```

7. `aix-client.ts`

```typescript
import { FoundationAPIs } from './foundation-api';
import { AdvancedAPIs } from './advanced-api';
import { Instruction, InstructionResult, ExecuteInstructionsOptions } from './instruction-api';

export interface AIXClient {
  foundation: FoundationAPIs;
  advanced: AdvancedAPIs;

  executeInstructions(
    instructions: Instruction[],
    options?: ExecuteInstructionsOptions
  ): AsyncIterableIterator<InstructionResult>;
}
```

8. `react-component.tsx`

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import { AIXClient } from './aix-client';
import { Instruction, InstructionResult, UserInteractionConfig } from './instruction-api';

const DynamicComponent = React.lazy(() => import('./DynamicComponent'));

interface AIXWorkflowProps {
  client: AIXClient;
  initialInstructions: Instruction[];
}

export const AIXWorkflow: React.FC<AIXWorkflowProps> = ({ client, initialInstructions }) => {
  const [results, setResults] = useState<InstructionResult[]>([]);
  const [currentInteraction, setCurrentInteraction] = useState<UserInteractionConfig | null>(null);

  const handleUserInteraction = useCallback(async (interaction: UserInteractionConfig) => {
    return new Promise<{ status: 'completed' | 'cancelled'; data?: any }>((resolve) => {
      setCurrentInteraction({ ...interaction, onComplete: resolve });
    });
  }, []);

  const runWorkflow = useCallback(async () => {
    const abortController = new AbortController();

    for await (const result of client.executeInstructions(initialInstructions, {
      onUserInteractionRequired: handleUserInteraction,
      signal: abortController.signal,
    })) {
      setResults(prev => [...prev, result]);
    }

    return () => abortController.abort();
  }, [client, initialInstructions, handleUserInteraction]);

  useEffect(() => {
    const cleanup = runWorkflow();
    return cleanup;
  }, [runWorkflow]);

  const handleInteractionComplete = useCallback((data: any) => {
    currentInteraction?.onComplete({ status: 'completed', data });
    setCurrentInteraction(null);
  }, [currentInteraction]);

  const handleInteractionCancel = useCallback(() => {
    currentInteraction?.onComplete({ status: 'cancelled' });
    setCurrentInteraction(null);
  }, [currentInteraction]);

  return (
    <div>
      {results.map((result) => (
        <div key={result.id}>
          <h3>{result.type}</h3>
          <pre>{JSON.stringify(result.output, null, 2)}</pre>
        </div>
      ))}
      {currentInteraction && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <DynamicComponent
            type={currentInteraction.componentType}
            props={{
              ...currentInteraction.props,
              onComplete: handleInteractionComplete,
              onCancel: handleInteractionCancel,
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};
```

This file structure provides a clean separation of concerns, with each file focusing on a specific aspect of the AIX API. The `types.ts`, `blocks.ts`, and `parameters.ts` files contain the fundamental building blocks used throughout the API. The `foundation-api.ts` and `advanced-api.ts` files define the core AI functionalities, while `instruction-api.ts` provides the high-level instruction execution system. The `aix-client.ts` file defines the main client interface, and `react-component.tsx` offers a ready-to-use React component for integrating the AIX API into a React application.

This structure allows for easy maintenance, extensibility, and clarity in the API design, making it easier for developers to understand and use the AIX system in their applications.