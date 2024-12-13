import * as React from 'react';

import type { AixAPI_Context_ChatGenerate } from '~/modules/aix/server/api/aix.wiretypes';
import type { AixChatGenerate_TextMessages } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';

import type { DLLMId } from '~/common/stores/llms/llms.types';


/**
 * NOTE: we shall rename this to useAgiStreamChatText or similar, but let's not conclict already.
 */
export function useStreamChatText() {

  // state
  const [text, setText] = React.useState<string | null>(null);
  const [partialText, setPartialText] = React.useState<string | null>(null);
  const [streamError, setStreamError] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);


  const startStreaming = React.useCallback(async (llmId: DLLMId, systemInstructionText: string, aixChatGenerate_TextMessages: AixChatGenerate_TextMessages, aixContextName: AixAPI_Context_ChatGenerate['name'], aixContextRef: AixAPI_Context_ChatGenerate['ref']) => {
    setStreamError(null);
    setPartialText(null);
    setText(null);

    // Cancel any existing stream before starting a new one
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {

      const finalText = await aixChatGenerateText_Simple(
        llmId,
        systemInstructionText,
        aixChatGenerate_TextMessages,
        aixContextName,
        aixContextRef,
        { abortSignal: abortControllerRef.current.signal },
        setPartialText,
      );

      // since streamChat has finished, we can assume the stream is complete
      setText(finalText);

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