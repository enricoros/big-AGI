import * as React from 'react';

import type { DLLMId } from '~/modules/llms/store-llms';
import type { VChatMessageIn } from '~/modules/llms/transports/chatGenerate';
import { streamChat } from '~/modules/llms/transports/streamChat';


export function useStreamChatText() {

  // state
  const [text, setText] = React.useState<string | null>(null);
  const [partialText, setPartialText] = React.useState<string | null>(null);
  const [streamError, setStreamError] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);


  const startStreaming = React.useCallback(async (llmId: DLLMId, prompt: VChatMessageIn[]) => {
    setStreamError(null);
    setPartialText(null);
    setText(null);

    // Cancel any existing stream before starting a new one
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      let lastText = '';
      await streamChat(llmId, prompt, abortControllerRef.current.signal, (update) => {
        if (update.text) {
          lastText = update.text;
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