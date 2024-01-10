import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

import { createBase36Uid } from '~/common/util/textUtils';


/**
 * Very simple personas store for the "Persona Creator" - note that we shall
 * switch to a more complex personas store in the future, as for now we mainly
 * save system prompts so that we don't lose what was created.
 */
export interface SimplePersona {
  id: string;
  name?: string;
  systemPrompt: string; // The system prompt is very important and required
  creationDate: string; // ISO string format
  pictureUrl?: string; // Optional picture URL
  // source material
  inputProvenance?: SimplePersonaProvenance;
  inputText: string;
  // llm used
  llmLabel?: string;
}

export type SimplePersonaProvenance = {
  type: 'youtube';
  url: string;
  title?: string;
  thumbnailUrl?: string;
} | {
  type: 'text';
};


interface AppPersonasStore {

  // state
  simplePersonas: SimplePersona[];

  // actions
  prependSimplePersona: (systemPrompt: string, inputText: string, inputProvenance?: SimplePersonaProvenance, llmLabel?: string) => void;
  deleteSimplePersona: (id: string) => void;

}

/**
 * DO NOT USE outside of this application - this is a very simple store for Personas so that
 * they're not immediately lost.
 */
const useAppPersonasStore = create<AppPersonasStore>()(persist(
  (_set, _get) => ({

    simplePersonas: [],

    prependSimplePersona: (systemPrompt: string, inputText: string, inputProvenance?: SimplePersonaProvenance, llmLabel?: string) =>
      _set(state => ({
        simplePersonas: [
          {
            id: createBase36Uid(state.simplePersonas.map(persona => persona.id)),
            systemPrompt,
            creationDate: new Date().toISOString(),
            inputProvenance,
            inputText,
            llmLabel,
          },
          ...state.simplePersonas,
        ],
      })),

    deleteSimplePersona: (simplePersonaId: string) =>
      _set(state => ({
        simplePersonas: state.simplePersonas.filter(persona => persona.id !== simplePersonaId),
      })),

  }),
  {
    name: 'app-app-personas',
    version: 1,
  },
));

export function useSimplePersonas() {
  const simplePersonas = useAppPersonasStore(state => state.simplePersonas, shallow);
  return { simplePersonas };
}

export function prependSimplePersona(systemPrompt: string, inputText: string, inputProvenance?: SimplePersonaProvenance, llmLabel?: string) {
  useAppPersonasStore.getState().prependSimplePersona(systemPrompt, inputText, inputProvenance, llmLabel);
}

export function deleteSimplePersona(simplePersonaId: string) {
  useAppPersonasStore.getState().deleteSimplePersona(simplePersonaId);
}