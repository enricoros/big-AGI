import * as React from 'react';
import type { StateCreator } from 'zustand/vanilla';

import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import MediationOutlinedIcon from '@mui/icons-material/MediationOutlined';

import type { DLLMId } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { createDMessage, DMessage } from '~/common/state/store-chats';

import { GATHER_PLACEHOLDER } from '../beam.config';


// Choose, Improve, Fuse, Manual

const commonInitialization = (isEditable: boolean): Pick<BFusion, 'isEditable' | 'currentInstructionIndex' | 'llmId' | 'status' | 'outputMessage'> => ({
  isEditable,
  currentInstructionIndex: 0,
  llmId: null,
  status: 'idle',
  outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
});

export const FUSION_FACTORIES: { label: string, Icon: React.FunctionComponent, description: string, factory: () => BFusion }[] = [
  {
    label: 'Guided',
    Icon: CheckBoxOutlinedIcon,
    // description: 'This approach employs a two-stage, interactive process where an AI first generates a checklist of insights from a conversation for user selection, then synthesizes those selections into a tailored, comprehensive response, integrating user preferences with AI analysis and creativity.',
    description: 'A brainstorming session with AI, where you first pick your favorite ideas from a list it generates, and then the AI combines those picks into a tailored solution.',
    factory: () => ({
      ...commonInitialization(false),
      instructions: [
        {
          type: 'chat-generate',
          name: 'Generate Checklist',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: `You are an intelligent agent tasked with analyzing a set of AI-generated alternatives to identify key insights, solutions, or ideas. Your goal is to distill these alternatives into a concise checklist of options that can address the user's query. Consider the conversation's context, the user's last message, and the diversity of perspectives offered by the Beam alternatives. Generate a clear and actionable checklist that the user can review and select from.`,
          userPrompt: 'Given the conversation history and the {{N}} alternatives provided, identify and list the key insights, themes, or solutions as distinct options in a checklist format. Each item should be clearly articulated to allow for easy selection by the user. Ensure the checklist is comprehensive, covering the breadth of ideas presented in the alternatives, yet concise enough to facilitate clear decision-making.',
          outputType: 'user-checklist',
        },
        {
          type: 'chat-generate',
          name: 'Checklist-guided Merge',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: 'You are a master synthesizer, now equipped with specific insights selected by the user from a checklist you previously helped generate. Your task is to integrate these selected insights into a single, cohesive response. This synthesis should address the user\'s original query comprehensively, incorporating the best elements of the user\'s chosen options. Aim for clarity, coherence, and actionability in your final output.',
          userPrompt: 'Given the user\'s selected options from the checklist, synthesize these into a single, cohesive, comprehensive response that addresses the original query. Ensure the synthesis is coherent, integrating the selected insights in a manner that provides clear, actionable advice or solutions. The final output should reflect a deep understanding of the user\'s preferences and the conversation\'s context.',
          outputType: 'display-message',
        },
      ],
    }),
  },
  {
    label: 'Fuse',
    Icon: MediationOutlinedIcon,
    description: 'AI combines conversation details and various AI-generated ideas into one clear, comprehensive answer, making sense of diverse insights for you.',
    factory: () => ({
      ...commonInitialization(false),
      instructions: [
        {
          type: 'chat-generate',
          name: 'Syntesizing Fusion',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: `
You are an expert AI text synthesizer, your task is to analyze the following inputs and generate a single, comprehensive response that addresses the core objectives or questions.

Consider the conversation history, the last user message, and the diverse perspectives presented in the {{N}} response alternatives.

Your response should integrate the most relevant insights from these inputs into a cohesive and actionable answer.

Synthesize the perfect response that merges the key insights and provides clear guidance or answers based on the collective intelligence of the alternatives.`.trim(),
          userPrompt: 'Synthesize the perfect response that merges the key insights and provides clear guidance or answers based on the collective intelligence of the alternatives.',
          // evalPrompt: `Evaluate the synthesized response provided by the AI synthesizer. Consider its relevance to the original query, the coherence of the integration of different perspectives, and its completeness in addressing the objectives or questions raised throughout the conversation.`.trim(),
          outputType: 'display-message',
        },
      ],
    }),
  },
  {
    label: 'Custom',
    Icon: BuildCircleOutlinedIcon,
    description: 'Define your own fusion prompt.',
    factory: () => ({
      ...commonInitialization(true),
      instructions: [
        {
          type: 'chat-generate',
          name: 'Executing Your Merge Strategy',
          method: 's-s0-h0-u0-aN-u',
          systemPrompt: `
Your task is to synthesize a cohesive and relevant response based on the following messages: the original system message, the full conversation history up to the user query, the user query, and a set of {{N}} answers generated independently.
These alternatives explore different solutions and perspectives and are presented in random order. Your output should integrate insights from these alternatives, aligned with the conversation's context and objectives, into a single, coherent response that addresses the user's needs and questions as expressed throughout the conversation.`.trim(),
          userPrompt: 'Answer again using the best elements from the {{N}} answers above. Be truthful, honest, reliable.',
          // userPrompt: 'Based on the {{N}} alternatives provided, synthesize a single, comprehensive response that effectively addresses the query or problem at hand.',
          outputType: 'display-message',
        },
      ],
    }),
  },
];

export function mixInstructionPrompt(prompt: string, raysReady: number): string {
  return bareBonesPromptMixer(prompt, undefined, {
    '{{N}}': raysReady.toString(),
  });
}

function executeInstruction(instruction: TInstruction): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('executed', instruction);
      resolve();
    }, 1000);
  });
}

export function fusionGatherStop(fusion: BFusion): BFusion {
  fusion.abortController?.abort();
  return {
    ...fusion,
    ...(fusion.status === 'fusing' ? { status: 'stopped' } : {}),
    abortController: undefined,
  };
}


/// Gather Store Slice ///

export type TChatGenerateInstruction = {
  type: 'chat-generate',
  name: string;
  /**
   * - s-s0-h0-u0-aN-u: sandwiches the existing history and the new proposals in between the System and User prompts of the Instruction
   */
  method: 's-s0-h0-u0-aN-u',
  systemPrompt: string;
  userPrompt: string;
  evalPrompt?: string;
  outputType: 'display-message' | 'user-checklist';
}

export type TInstruction = TChatGenerateInstruction | {
  type: 'user-input-checklist'
  name: string;
};

export interface BFusion {
  // set at creation, adjusted later if this is a custom fusion (and only when idle)
  isEditable: boolean; // only true on a single custom fusion
  instructions: TInstruction[];

  // set at start
  llmId: DLLMId | null;

  // variable
  currentInstructionIndex: number; // points to the next instruction to execute
  status: 'idle' | 'fusing' | 'success' | 'stopped' | 'error';
  outputMessage: DMessage;
  issue?: string;
  abortController?: AbortController;
}

interface GatherStateSlice {

  gatherShowPrompts: boolean;

  fusions: BFusion[];
  fusionIndex: number | null;

  fusionLlmId: DLLMId | null; // i'd love to call this 'gatherLlmId', but it's already used too much and can hide errors

  isGathering: boolean;  // true if any fusion is gathering at the moment

}

export const reInitGatherStateSlice = (prevFusions: BFusion[]): GatherStateSlice => {
  // stop any ongoing fusions
  prevFusions.forEach(fusionGatherStop);

  return {
    gatherShowPrompts: false,
    fusions: FUSION_FACTORIES.map(spec => spec.factory()),
    fusionIndex: null,
    fusionLlmId: null,
    isGathering: false,
  };
};

export interface GatherStoreSlice extends GatherStateSlice {

  toggleGatherShowPrompts: () => void;
  setFusionIndex: (index: number | null) => void;
  setFusionLlmId: (llmId: DLLMId | null) => void;

  fusionCopyAsCustom: (sourceIndex: number) => void; // copies 'source' to custom
  fusionInstructionEdit: (fusionIndex: number, instructionIndex: number, update: Partial<TInstruction>) => void;
  fusionStart: () => void;
  fusionStop: () => void;

  _fusionUpdate: (fusionIndex: number, update: Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null))) => void;

}

export const createGatherSlice: StateCreator<GatherStoreSlice, [], [], GatherStoreSlice> = (_set, _get) => ({

  // initial state
  ...reInitGatherStateSlice([]),


  toggleGatherShowPrompts: () =>
    _set(state => ({
      gatherShowPrompts: !state.gatherShowPrompts,
    })),

  setFusionIndex: (index: number | null) =>
    _set({
      fusionIndex: index,
    }),

  setFusionLlmId: (llmId: DLLMId | null) =>
    _set({
      fusionLlmId: llmId,
    }),

  fusionInstructionEdit: (fusionIndex: number, instructionIndex: number, update: Partial<TInstruction>) =>
    _get()._fusionUpdate(fusionIndex, fusion => ({
      instructions: fusion.instructions.map((instruction, index) => (index === instructionIndex)
        ? { ...instruction, ...update as any /* Note: do not update a different 'type' of instruction ... */ }
        : instruction,
      ),
    })),

  fusionCopyAsCustom: (sourceIndex: number) => {
    const { fusions, setFusionIndex, _fusionUpdate } = _get();
    const editableFusionIndex = fusions.findIndex(fusion => fusion.isEditable);
    const fusionFactory = FUSION_FACTORIES[sourceIndex];
    if (editableFusionIndex === -1 || editableFusionIndex === sourceIndex || !fusionFactory)
      return;
    _fusionUpdate(editableFusionIndex, customFusion => {
      // Terminate current custom fusion, if any
      fusionGatherStop(customFusion);
      return {
        ...fusionFactory.factory(),
        isEditable: true,
      };
    });
    setFusionIndex(editableFusionIndex);
  },

  fusionStart: () => {
    console.log('startGatheringCurrent');
  },

  fusionStop: () => {
    console.log('stopGatheringCurrent');
  },

  _fusionUpdate: (fusionIndex: number, update: Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null))) =>
    _set(state => ({
      fusions: state.fusions.map((fusion, index) => (index === fusionIndex)
        ? { ...fusion, ...(typeof update === 'function' ? update(fusion) : update) }
        : fusion,
      ),
    })),

});
