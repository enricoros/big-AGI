import * as React from 'react';

import { DLLMId, findLLMOrThrow } from '~/modules/llms/store-llms';
import { llmStreamingChatGenerate, VChatContextRef, VChatMessageIn, VChatStreamContextName } from '~/modules/llms/llm.client';


// set to true to log to the console
const DEBUG_CHAIN = false;


export interface LLMChainStep {
  name: string;
  setSystem?: string;
  addPrevAssistant?: boolean;
  addUserInput?: boolean;
  addUser?: string;
}


/**
 * React hook to manage a chain of LLM transformations.
 */
export function useLLMChain(steps: LLMChainStep[], llmId: DLLMId | undefined, chainInput: string | undefined, onSuccess: (output: string, input: string) => void, contextName: VChatStreamContextName, contextRef: VChatContextRef) {

  // state
  const [chain, setChain] = React.useState<ChainState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [chainStepInterimText, setChainStepInterimText] = React.useState<string | null>(null);
  const chainAbortController = React.useRef(new AbortController());


  // abort an ongoing chain, if any
  const abortChain = React.useCallback((reason: string) => {
    DEBUG_CHAIN && console.log('chain: abort (' + reason + ')');
    chainAbortController.current.abort(reason);
    chainAbortController.current = new AbortController();
  }, []);

  const userCancelChain = React.useCallback(() => {
    abortChain('user canceled');
    setError('Canceled');
  }, [abortChain]);

  // starts a chain with the given inputs
  const startChain = React.useCallback((inputText: string | undefined, llmId: DLLMId | undefined, steps: LLMChainStep[]) => {
    DEBUG_CHAIN && console.log('chain: restart', { textLen: inputText?.length, llmId, stepsCount: steps.length });

    // abort any former running chain
    abortChain('restart');

    // init state
    setError(!llmId ? 'LLM not provided' : null);
    setChain((inputText && llmId)
      ? initChainState(llmId, inputText, steps)
      : null,
    );
    setChainStepInterimText(null);

  }, [abortChain]);

  // restarts this chain
  const restartChain = React.useCallback(() => {
    startChain(chainInput, llmId, steps);
  }, [chainInput, llmId, startChain, steps]);


  // lifecycle: Start on inputs change + Abort on unmounts
  React.useEffect(() => {
    restartChain();
    return () => abortChain('unmount');
  }, [restartChain, abortChain]);


  // stepper: perform Step on Chain updates
  React.useEffect(() => {
    // skip step if the chain has been aborted
    const _chainAbortController = chainAbortController.current;
    if (_chainAbortController.signal.aborted) return;

    // skip if there is no chain
    if (!chain || !llmId) return;

    // skip if no next unprocessed step
    const stepIdx = chain.steps.findIndex((step) => !step.isComplete);
    if (stepIdx === -1) return;

    // safety check (re-processing the same step shall never happen)
    const chainStep = chain.steps[stepIdx];
    if (chainStep.output)
      return console.log('WARNING - Output overlap - FIXME', chainStep);

    // execute step instructions
    let llmChatInput: VChatMessageIn[] = [...chain.chatHistory];
    const instruction = chainStep.ref;
    if (instruction.setSystem) {
      llmChatInput = llmChatInput.filter((msg) => msg.role !== 'system');
      llmChatInput.unshift({ role: 'system', content: instruction.setSystem });
    }
    if (instruction.addUserInput)
      llmChatInput.push({ role: 'user', content: implodeText(chain.input, chain.safeInputLength) });
    if (instruction.addPrevAssistant && stepIdx > 0)
      llmChatInput.push({ role: 'assistant', content: implodeText(chain.steps[stepIdx - 1].output!, chain.safeInputLength) });
    if (instruction.addUser)
      llmChatInput.push({ role: 'user', content: instruction.addUser });

    // monitor for cleanup before the result
    let stepDone = false;
    const stepAbortController = new AbortController();
    const globalToStepListener = () => stepAbortController.abort('chain aborted');
    _chainAbortController.signal.addEventListener('abort', globalToStepListener);

    // interim text
    let interimText = '';
    setChainStepInterimText(null);

    // LLM call (streaming, cancelable)
    llmStreamingChatGenerate(llmId, llmChatInput, contextName, contextRef, null, null, stepAbortController.signal,
      ({ textSoFar }) => {
        textSoFar && setChainStepInterimText(interimText = textSoFar);
      })
      .then(() => {
        if (stepAbortController.signal.aborted)
          return;
        const chainState = updateChainState(chain, llmChatInput, stepIdx, interimText);
        if (chainState.output && onSuccess)
          onSuccess(chainState.output, chainState.input);
        setChain(chainState);
      })
      .catch((err) => {
        if (!stepAbortController.signal.aborted)
          setError(`Transformation error: ${err?.message || err?.toString() || err || 'unknown'}`);
      })
      .finally(() => {
        stepDone = true;
        setChainStepInterimText(null);
      });

    // abort if unmounted before the LLM call ends, or if the full chain has been aborted
    return () => {
      if (!stepDone)
        stepAbortController.abort('step aborted');
      _chainAbortController.signal.removeEventListener('abort', globalToStepListener);
    };
  }, [chain, contextRef, contextName, llmId, onSuccess]);


  return {
    isFinished: !!chain?.output,
    isTransforming: !!chain?.steps?.length && !chain?.output && !error,
    chainOutput: chain?.output ?? null,
    chainProgress: chain?.progress ?? 0,
    chainStepName: chain?.steps?.find((step) => !step.isComplete)?.ref.name ?? null,
    chainStepInterimChars: chainStepInterimText?.length ?? null,
    chainIntermediates: chain?.steps?.map((step) => ({ name: step.ref.name, output: step.output ?? null })).filter(i => !!i.output) ?? [],
    chainError: error,
    userCancelChain,
    restartChain,
  };
}


interface ChainState {
  steps: StepState[];
  chatHistory: VChatMessageIn[];
  progress: number;
  safeInputLength: number | null;
  overrideResponseTokens: number | null;
  input: string;
  output: string | null;
}

interface StepState {
  ref: LLMChainStep;
  output?: string;
  isComplete: boolean;
  isLast: boolean;
}

function initChainState(llmId: DLLMId, input: string, steps: LLMChainStep[]): ChainState {
  // max token allocation fo the job
  const llm = findLLMOrThrow(llmId);

  const overrideResponseTokens = llm.maxOutputTokens;
  const safeInputLength = (llm.contextTokens && overrideResponseTokens)
    ? Math.floor((llm.contextTokens - overrideResponseTokens) * 2)
    : null;

  return {
    steps: steps.map((step, i) => ({
      ref: step,
      output: undefined,
      isComplete: false,
      isLast: i === steps.length - 1,
    })),
    chatHistory: [],
    overrideResponseTokens,
    safeInputLength,
    progress: 0,
    input: input,
    output: null,
  };
}

function updateChainState(chain: ChainState, history: VChatMessageIn[], stepIdx: number, output: string): ChainState {
  const stepsCount = chain.steps.length;
  return {
    ...chain,
    steps: chain.steps.map((step, i) =>
      (i === stepIdx) ? {
        ...step,
        output: output,
        isComplete: true,
      } : step),
    chatHistory: history,
    progress: Math.round(100 * (stepIdx + 1) / stepsCount) / 100,
    output: (stepIdx === stepsCount - 1) ? output : null,
  };
}

function implodeText(text: string, maxLength: number | null) {
  if (!maxLength || text.length <= maxLength) return text;
  const halfLength = Math.floor(maxLength / 2);
  return `${text.substring(0, halfLength)}\n...\n${text.substring(text.length - halfLength)}`;
}