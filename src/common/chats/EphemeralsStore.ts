import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { customEventHelpers } from '~/common/util/eventUtils';

import type { ConversationHandler } from './ConversationHandler';


/**
 * DEphemeral: For ReAct sidebars, displayed under the chat
 */
export interface DEphemeral {
  id: string;
  title: string;
  text: string;
  state: object;
}

function createDEphemeral(title: string, initialText: string): DEphemeral {
  return {
    id: uuidv4(),
    title: title,
    text: initialText,
    state: {},
  };
}

const [dispatchEphemeralsChanged, installEphemeralsChangedListener] = customEventHelpers<DEphemeral[]>('ephemeralsChanged');


/**
 * [store]: diy reactive store for a list of ephemerals
 */
export class EphemeralsStore extends EventTarget {
  private readonly ephemerals: DEphemeral[] = [];

  constructor() {
    super();
  }

  find(): DEphemeral[] {
    return this.ephemerals;
  }

  append(ephemeral: DEphemeral): void {
    this.ephemerals.push(ephemeral);
    dispatchEphemeralsChanged(this, this.ephemerals);
  }

  delete(ephemeralId: string): void {
    const index = this.ephemerals.findIndex(e => e.id === ephemeralId);
    console.log('EphemeralsStore: delete', index);
    if (index >= 0) {
      this.ephemerals.splice(index, 1);
      dispatchEphemeralsChanged(this, this.ephemerals);
    }
  }

  update(ephemeralId: string, update: Partial<DEphemeral>): void {
    const ephemeral = this.ephemerals.find(e => e.id === ephemeralId);
    if (ephemeral) {
      Object.assign(ephemeral, update);
      dispatchEphemeralsChanged(this, this.ephemerals);
    }
  }
}

export class EphemeralHandler {
  private readonly ephemeralId: string;

  constructor(title: string, initialText: string, readonly ephemeralsStore: EphemeralsStore) {
    const dEphemeral = createDEphemeral(title, initialText);
    this.ephemeralId = dEphemeral.id;
    this.ephemeralsStore.append(dEphemeral);
  }

  updateText(text: string): void {
    this.ephemeralsStore.update(this.ephemeralId, { text });
  }

  updateState(state: object): void {
    this.ephemeralsStore.update(this.ephemeralId, { state });
  }

  delete(): void {
    this.ephemeralsStore.delete(this.ephemeralId);
  }
}


export function useEphemerals(conversationHandler: ConversationHandler | null): DEphemeral[] {

  // state
  const [ephemerals, setEphemerals] = React.useState<DEphemeral[]>(
    () => conversationHandler ? conversationHandler.ephemeralsStore.find() : []);

  React.useEffect(() => {
    if (!conversationHandler) return;
    return installEphemeralsChangedListener(conversationHandler.ephemeralsStore.find(), conversationHandler.ephemeralsStore, (detail) => setEphemerals([...detail]));
  }, [conversationHandler]);

  return ephemerals;
}
