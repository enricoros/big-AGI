import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { DMessage } from '~/common/state/store-chats';

import type { ConversationHandler } from './ConversationHandler';
import { customEventHelpers } from '~/common/util/eventUtils';


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


interface BeamState {
  config: BeamConfig | null;
  candidates: BeamCandidate[];
}

const [dispatchStateChangeEvent, installStateChangeListener] = customEventHelpers<Partial<BeamState>>('stateChange');


export class BeamStore extends EventTarget {
  private config: BeamConfig | null = null;
  private readonly candidates: BeamCandidate[] = [];

  constructor() {
    super();
  }

  get(): BeamState {
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
    dispatchStateChangeEvent(this, { config: this.config });
  }

  destroy() {
    this.config = null;
    dispatchStateChangeEvent(this, { config: this.config });
  }

  appendCandidate(candidate: BeamCandidate): void {
    this.candidates.push(candidate);
    dispatchStateChangeEvent(this, { candidates: this.candidates });
  }

  deleteCandidate(candidateId: BeamCandidate['id']): void {
    const index = this.candidates.findIndex(e => e.id === candidateId);
    if (index >= 0) {
      this.candidates.splice(index, 1);
      dispatchStateChangeEvent(this, { candidates: this.candidates });
    }
  }

  updateCandidate(candidateId: BeamCandidate['id'], update: Partial<BeamCandidate>): void {
    const candidate = this.candidates.find(c => c.id === candidateId);
    if (candidate) {
      Object.assign(candidate, update);
      dispatchStateChangeEvent(this, { candidates: this.candidates });
    }
  }
}


export function useBeamState(conversationHandler: ConversationHandler): BeamState {

  // state
  const [beamState, setBeamState] = React.useState<BeamState>(() => conversationHandler.beamStore.get());

  React.useEffect(() => {
    return installStateChangeListener(conversationHandler.beamStore, (detail) => setBeamState(state => ({ ...state, ...detail })));
  }, [conversationHandler]);

  return beamState;
}
