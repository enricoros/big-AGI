import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { DMessage } from '~/common/state/store-chats';

import type { ConversationHandler } from './ConversationHandler';


export type BeamConfig = {
  history: DMessage[];
  lastMessage: string;
  configError?: string;
};

function createConfig(history: DMessage[]): BeamConfig {
  return { history, lastMessage: history.slice(-1)[0]?.text || '' };
}

export interface BeamCandidate {
  id: string;
  text: string;
  placeholder: string;
}

function createCandidate(): BeamCandidate {
  return {
    id: uuidv4(),
    text: '',
    placeholder: '...',
  };
}

export class BeamStore extends EventTarget {
  private config: BeamConfig | null = null;
  private readonly candidates: BeamCandidate[] = [];

  constructor() {
    super();
  }

  get(): { config: BeamConfig | null, candidates: BeamCandidate[] } {
    return { config: this.config, candidates: this.candidates };
  }

  create(history: DMessage[]) {
    if (this.config) {
      this.config.configError = 'Warning: config already exists. Skipping...';
    } else {
      this.config = createConfig([...history]);
    }
    if (history.length < 1)
      this.config.configError = 'Warning: empty history. Skipping...';
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: { config: this.config } }));
  }

  appendCandidate(candidate: BeamCandidate): void {
    this.candidates.push(candidate);
    this.dispatchEvent(new CustomEvent('stateChanged', { detail: { candidates: this.candidates } }));
  }

  deleteCandidate(candidateId: BeamCandidate['id']): void {
    const index = this.candidates.findIndex(e => e.id === candidateId);
    if (index >= 0) {
      this.candidates.splice(index, 1);
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: { candidates: this.candidates } }));
    }
  }

  updateCandidate(candidateId: BeamCandidate['id'], update: Partial<BeamCandidate>): void {
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (candidate) {
      Object.assign(candidate, update);
      this.dispatchEvent(new CustomEvent('stateChanged', { detail: { candidates: this.candidates } }));
    }
  }
}


export function useBeam(conversationHandler: ConversationHandler | null): { config: BeamConfig | null, candidates: BeamCandidate[] } {

  // state
  const [beamState, setBeamState] = React.useState<{ config: BeamConfig | null, candidates: BeamCandidate[] }>(() => {
    return conversationHandler ? conversationHandler.beamStore.get() : { config: null, candidates: [] };
  });

  // [effect] subscribe to events
  React.useEffect(() => {
    if (!conversationHandler) return;
    const handleStateChanged = (event: Event) => {
      setBeamState(state => ({ ...state, ...(event as CustomEvent<{ config?: BeamConfig, candidates?: BeamCandidate[] }>).detail }));
    };
    conversationHandler.beamStore.addEventListener('stateChanged', handleStateChanged);
    return () => {
      conversationHandler.beamStore.removeEventListener('stateChanged', handleStateChanged);
    };
  }, [conversationHandler]);

  return beamState;
}
