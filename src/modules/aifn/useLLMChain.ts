import * as React from 'react';

import type { AixAPI_Context_ChatGenerate } from '~/modules/aix/server/api/aix.wiretypes';
import type { AixChatGenerate_TextMessages } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { ellipsizeMiddle } from '~/common/util/textUtils';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';


// set to true to log to the console
const DEBUG_CHAIN = false;


export interface LLMChainStep {
  name: string;
  setSystem?: string;
  addUserChainInput?: boolean;
  addModelPrevOutput?: boolean;
  addUserText?: string;
}


/**
 * React hook to manage a chain of LLM transformations.
 */
export function useLLMChain(
  steps: LLMChainStep[],
  llmId: DLLMId | undefined,
  chainInput: string | undefined,
  onSuccess: (output: string, input: string) => void,
  aixContextName: AixAPI_Context_ChatGenerate['name'],
  aixContextRef: AixAPI_Context_ChatGenerate['ref'],
) {

  // state
  const [chain, setChain] = React.useState<ChainState | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
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
    setErrorMessage('Canceled');
  }, [abortChain]);

  // starts a chain with the given inputs
  const startChain = React.useCallback((inputText: string | undefined, llmId: DLLMId | undefined, steps: LLMChainStep[]) => {
    DEBUG_CHAIN && console.log('chain: restart', { textLen: inputText?.length, llmId, stepsCount: steps.length });

    // abort any former running chain
    abortChain('restart');

    // init state
    setErrorMessage(!llmId ? 'LLM not provided' : null);
    setChain((inputText && llmId)
      ? _initChainState(llmId, inputText, steps)
      : null,
    );
    setChainStepInterimText(null);

  }, [abortChain]);

  // restarts this chain
  const restartChain = React.useCallback(() => {
    startChain(chainInput, llmId, steps);
  }, [chainInput, llmId, startChain, steps]);


  // [effect] Start on inputs change + Abort on unmounts
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
    const nextStepIdx = chain.stepStates.findIndex((step) => !step.isComplete);
    if (nextStepIdx === -1) return;

    // safety check (re-processing the same step shall never happen)
    const nextStepState = chain.stepStates[nextStepIdx];
    if (nextStepState.output)
      return console.log('WARNING - Output overlap - FIXME', nextStepState);
    const nextStep = nextStepState.def;


    // execute step instructions

    const stepSystemInstruction = nextStep.setSystem || chain.lastSystemInstruction || '';

    const stepChatHistory: AixChatGenerate_TextMessages = [...chain.lastChatHistory];

    if (nextStep.addUserChainInput)
      stepChatHistory.push({
        role: 'user',
        text: !chain.safeInputLength ? chain.chainInputText : ellipsizeMiddle(chain.chainInputText, chain.safeInputLength, '\n...\n'),
      });

    if (nextStep.addModelPrevOutput && nextStepIdx > 0)
      stepChatHistory.push({
        role: 'model',
        text: chain.safeInputLength
          ? ellipsizeMiddle(chain.stepStates[nextStepIdx - 1].output!, chain.safeInputLength, '\n...\n')
          : (chain.stepStates[nextStepIdx - 1].output || ''),
      });

    if (nextStep.addUserText)
      stepChatHistory.push({
        role: 'user',
        text: nextStep.addUserText,
      });

    // monitor for cleanup before the result
    let stepDone = false;
    const stepAbortController = new AbortController();
    const globalToStepListener = () => stepAbortController.abort('chain aborted');
    _chainAbortController.signal.addEventListener('abort', globalToStepListener);

    // interim text
    setChainStepInterimText(null);

    // LLM call (streaming, cancelable)
    aixChatGenerateText_Simple(
      llmId,
      stepSystemInstruction,
      stepChatHistory,
      aixContextName,
      aixContextRef,
      { abortSignal: stepAbortController.signal },
      setChainStepInterimText,
    )
      .then((stepOutputText) => {
        if (stepAbortController.signal.aborted)
          return;
        const chainState = _updateChainState_pure(chain, nextStepIdx, stepSystemInstruction, stepChatHistory, stepOutputText);
        if (chainState.outputText && onSuccess)
          onSuccess(chainState.outputText, chainState.chainInputText);
        setChain(chainState);
      })
      .catch((err) => {
        if (!stepAbortController.signal.aborted)
          setErrorMessage(`Transformation error: ${err?.message || err?.toString() || err || 'unknown'}`);
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
  }, [aixContextName, aixContextRef, chain, llmId, onSuccess]);

  return {
    isFinished: !!chain?.outputText,
    isTransforming: !!chain?.stepStates?.length && !chain?.outputText && !errorMessage,
    chainOutputText: chain?.outputText ?? null,
    chainProgress: chain?.progress ?? 0,
    chainStepName: chain?.stepStates?.find((step) => !step.isComplete)?.def.name ?? null,
    chainStepInterimChars: chainStepInterimText?.length ?? null,
    chainIntermediates: chain?.stepStates
      ?.map((step) => ({ name: step.def.name, output: step.output ?? null }))
      .filter(i => !!i.output) ?? [],
    chainErrorMessage: errorMessage,
    userCancelChain,
    restartChain,
  };
}


interface ChainState {
  chainInputText: string;
  overrideResponseTokens: number | null;
  safeInputLength: number | null;

  stepStates: StepState[];

  lastSystemInstruction: string | null;
  lastChatHistory: AixChatGenerate_TextMessages;

  progress: number;
  outputText: string | null;
}

interface StepState {
  def: LLMChainStep;
  isLast: boolean;
  isComplete: boolean;
  output?: string;
}

function _initChainState(llmId: DLLMId, input: string, steps: LLMChainStep[]): ChainState {
  // max token allocation fo the job
  const llm = findLLMOrThrow(llmId);

  const overrideResponseTokens = llm.maxOutputTokens;
  const safeInputLength = (llm.contextTokens && overrideResponseTokens)
    ? Math.floor((llm.contextTokens - overrideResponseTokens) * 2)
    : null;

  return {
    // consts
    chainInputText: input,
    overrideResponseTokens,
    safeInputLength,

    // each step state
    stepStates: steps.map((step, i) => ({
      def: step,
      isLast: i === steps.length - 1,
      isComplete: false,
      output: undefined,
    })),

    // variables updated by the state machinery
    lastSystemInstruction: null,
    lastChatHistory: [],

    // input/output
    progress: 0,
    outputText: null,
  };
}

function _updateChainState_pure(chain: ChainState, stepIdx: number, stepSystemInstruction: string, stepChatHistory: AixChatGenerate_TextMessages, stepOutputText: string): ChainState {
  const stepsCount = chain.stepStates.length;
  return {
    ...chain,
    stepStates: chain.stepStates.map((step, i) =>
      (i === stepIdx) ? {
        ...step,
        // def // do not change
        // isLast // do not change
        isComplete: true,
        output: stepOutputText,
      } : step),
    lastSystemInstruction: stepSystemInstruction,
    lastChatHistory: stepChatHistory,
    progress: Math.round(100 * (stepIdx + 1) / stepsCount) / 100,
    outputText: (stepIdx === stepsCount - 1) ? stepOutputText : null,
  };
}
