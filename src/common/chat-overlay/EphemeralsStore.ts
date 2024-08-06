import * as React from 'react';

import { agiUuid } from '~/common/util/idUtils';
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
  done: boolean;
  pinned: boolean;
}

function createDEphemeral(title: string, initialText: string, pinned: boolean): DEphemeral {
  return {
    id: agiUuid('chat-ephemerals-item'),
    title: title,
    text: initialText,
    state: {},
    done: false,
    pinned: pinned,
  };
}

const [dispatchEphemeralsChanged, installEphemeralsChangedListener] = customEventHelpers<DEphemeral[]>('ephemeralsChanged');


/**
 * [store]: diy reactive store for a list of ephemerals
 */
export class EphemeralsStore extends EventTarget {
  static lastEphemeralPinned: boolean = false;
  private readonly ephemerals: DEphemeral[] = [];

  constructor() {
    super();
  }

  get currentEphemerals(): DEphemeral[] {
    return this.ephemerals;
  }

  append(ephemeral: DEphemeral): void {
    this.ephemerals.push(ephemeral);
    dispatchEphemeralsChanged(this, this.ephemerals);
  }

  delete(ephemeralId: string): void {
    const index = this.ephemerals.findIndex(e => e.id === ephemeralId);
    if (index >= 0) {
      this.ephemerals.splice(index, 1);
      dispatchEphemeralsChanged(this, this.ephemerals);
    }
  }

  update(ephemeralId: string, update: Partial<DEphemeral>): void {
    if (update.pinned !== undefined)
      EphemeralsStore.lastEphemeralPinned = update.pinned;
    const ephemeral = this.ephemerals.find(e => e.id === ephemeralId);
    if (ephemeral) {
      Object.assign(ephemeral, update);
      dispatchEphemeralsChanged(this, this.ephemerals);
    }
  }


  // Pinned State

  isPinned(ephemeralId: string): boolean {
    return this.ephemerals.find(e => e.id === ephemeralId)?.pinned || false;
  }

  togglePinned(ephemeralId: string): void {
    const ephemeral = this.ephemerals.find(e => e.id === ephemeralId);
    if (ephemeral) {
      // special case: unpinning after it's done
      if (ephemeral.pinned && ephemeral.done)
        return this.delete(ephemeralId);

      // while running: toggle pinning
      ephemeral.pinned = !ephemeral.pinned;
      dispatchEphemeralsChanged(this, this.ephemerals);
    }
  }

}

export class EphemeralHandler {
  private readonly ephemeralId: string;

  constructor(title: string, initialText: string, readonly ephemeralsStore: EphemeralsStore) {
    const dEphemeral = createDEphemeral(title, initialText, EphemeralsStore.lastEphemeralPinned);
    this.ephemeralId = dEphemeral.id;
    this.ephemeralsStore.append(dEphemeral);
  }

  updateText(text: string): void {
    this.ephemeralsStore.update(this.ephemeralId, { text });
  }

  updateState(state: object): void {
    this.ephemeralsStore.update(this.ephemeralId, { state });
  }

  markAsDone(): void {
    this.ephemeralsStore.update(this.ephemeralId, { done: true });
  }

  deleteIfNotPinned(forceIfPinned: boolean): void {
    if (!forceIfPinned && this.ephemeralsStore.isPinned(this.ephemeralId))
      return;
    this.ephemeralsStore.delete(this.ephemeralId);
  }
}


export function useEphemerals(conversationHandler: ConversationHandler | null): DEphemeral[] {

  // state
  const [ephemerals, setEphemerals] = React.useState<DEphemeral[]>(
    () => conversationHandler ? conversationHandler.ephemeralsStore.currentEphemerals : [],
  );

  React.useEffect(() => {
    if (!conversationHandler) return;
    return installEphemeralsChangedListener(conversationHandler.ephemeralsStore.currentEphemerals, conversationHandler.ephemeralsStore, (detail) => setEphemerals([...detail]));
  }, [conversationHandler]);

  return ephemerals;
}
