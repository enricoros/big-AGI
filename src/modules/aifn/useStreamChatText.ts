import * as React from 'react';

import type { DLLMId } from '~/modules/llms/store-llms';
import { llmStreamingChatGenerate, VChatContextRef, VChatMessageIn, VChatStreamContextName } from '~/modules/llms/llm.client';


export function useStreamChatText() {

  // state
  const [text, setText] = React.useState<string | null>(null);
  const [partialText, setPartialText] = React.useState<string | null>(null);
  const [streamError, setStreamError] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);


  const startStreaming = React.useCallback(async (llmId: DLLMId, prompt: VChatMessageIn[], contextName: VChatStreamContextName, contextRef: VChatContextRef) => {
    setStreamError(null);
    setPartialText(null);
    setText(null);

    // Cancel any existing stream before starting a new one
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      let lastText = '';
      await llmStreamingChatGenerate(llmId, prompt, contextName, contextRef, null, null, abortControllerRef.current.signal, ({ textSoFar }) => {
        if (textSoFar) {
          lastText = textSoFar;
          setPartialText(lastText);
        }
      });
      // Since streamChat has finished, we can assume the stream is complete
      setText(lastText);
    } catch (error: any) {
      setStreamError(error?.name !== 'AbortError'
        ? error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error'
        : 'Interrupted.',
      );
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const stopStreaming = React.useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const resetText = React.useCallback(() => {
    setText(null);
    setPartialText(null);
    setStreamError(null);
  }, []);


  // Clean up the abort controller when the component unmounts
  React.useEffect(() => {
    return () => stopStreaming();
  }, [stopStreaming]);


  return {
    // properties
    isStreaming: !!abortControllerRef.current,
    text,
    partialText,
    streamError,
    // methods
    startStreaming,
    stopStreaming,
    setText,
    resetText,
  };
}