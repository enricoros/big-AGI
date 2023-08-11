import * as React from 'react';

import { DLLMId } from '~/modules/llms/llm.types';
import { callChatGenerate, VChatMessageIn } from '~/modules/llms/llm.client';
import { useModelsStore } from '~/modules/llms/store-llms';


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
export function useLLMChain(steps: LLMChainStep[], llmId: DLLMId | undefined, chainInput: string | undefined) {
  const [chain, setChain] = React.useState<ChainState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const chainAbortController = React.useRef(new AbortController());

  // restart Chain on inputs change
  React.useEffect(() => {
    // abort any ongoing chain, if any
    chainAbortController.current.abort();
    chainAbortController.current = new AbortController();
    setChain(null);

    // error if no LLM
    setError(!llmId ? 'LLM not provided' : null);

    // abort if no input
    if (!chainInput || !llmId)
      return;

    // start the chain
    setChain(initChainState(llmId, chainInput, steps));
    return () => chainAbortController.current.abort();
  }, [chainInput, llmId, steps]);


  // perform Step on Chain update
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
      return console.log('WARNING - Output overlap - why is this happening?', chainStep);

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

    // LLM call
    callChatGenerate(llmId, llmChatInput, chain.overrideResponseTokens)
      .then(({ content }) => {
        stepDone = true;
        if (!stepAbortController.signal.aborted)
          setChain(updateChainState(chain, llmChatInput, stepIdx, content));
      })
      .catch((err) => {
        stepDone = true;
        if (!stepAbortController.signal.aborted)
          setError(`Transformation Error: ${err?.message || err?.toString() || err || 'unknown'}`);
      });

    // abort if unmounted before the LLM call ends, or if the full chain has been aborted
    return () => {
      if (!stepDone)
        stepAbortController.abort('step aborted');
      _chainAbortController.signal.removeEventListener('abort', globalToStepListener);
    };
  }, [chain, llmId]);


  return {
    isFinished: !!chain?.output,
    isTransforming: !!chain?.steps?.length && !chain?.output && !error,
    chainOutput: chain?.output ?? null,
    chainProgress: chain?.progress ?? 0,
    chainStepName: chain?.steps?.find((step) => !step.isComplete)?.ref.name ?? null,
    chainIntermediates: chain?.steps?.map((step) => step.output ?? null)?.filter(out => out) ?? [],
    chainError: error,
    abortChain: () => {
      chainAbortController.current.abort('user canceled');
      setError('Canceled');
    },
  };
}


interface ChainState {
  steps: StepState[];
  chatHistory: VChatMessageIn[];
  progress: number;
  safeInputLength: number;
  overrideResponseTokens: number;
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
  const { llms } = useModelsStore.getState();
  const llm = llms.find(llm => llm.id === llmId);
  if (!llm)
    throw new Error(`LLM ${llmId} not found`);

  const maxTokens = llm.contextTokens;
  const overrideResponseTokens = Math.floor(maxTokens / 3);
  const inputTokens = maxTokens - overrideResponseTokens;
  const safeInputLength = Math.floor(inputTokens * 2); // it's deemed around 4

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
  const steps = chain.steps.length;
  return {
    ...chain,
    steps: chain.steps.map((step, i) =>
      (i === stepIdx) ? {
        ...step,
        output: output,
        isComplete: true,
      } : step),
    chatHistory: history,
    progress: Math.round(100 * (stepIdx + 1) / steps) / 100,
    output: (stepIdx === steps - 1) ? output : null,
  };
}

function implodeText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  const halfLength = Math.floor(maxLength / 2);
  return `${text.substring(0, halfLength)}\n...\n${text.substring(text.length - halfLength)}`;
}