import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts_slice';
import type { DBlobAssetId } from '~/common/stores/blob/dblobs-portability';
import type { DMessageAttachmentFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { collectFragmentAssetIds } from '~/common/stores/chat/chat.gc';


/** Where a control's drafts go at Done: after this fragment, or at the end (null). Read at Done, so a reordered group still receives them last. */
export type CMEditDraftsAnchor = () => DMessageFragmentId | null;

export interface CMEditDraftsTaken {
  anchor: DMessageFragmentId | null;
  fragments: DMessageAttachmentFragment[];
}


/**
 * The attachment drafts of an edit session: one store per add control (the row below each attachments group, the bar
 * at the end), owned by the control and registered here with its anchor. The session reads the aggregate state and
 * takes every store at Done. An external store for `useSyncExternalStore`.
 */
export class CMEditDrafts {

  private readonly _stores = new Map<AttachmentDraftsStoreApi, { anchor: CMEditDraftsAnchor, unsubscribe: () => void }>();
  private readonly _listeners = new Set<() => void>();

  register(store: AttachmentDraftsStoreApi, anchor: CMEditDraftsAnchor): () => void {
    this._stores.set(store, { anchor, unsubscribe: store.subscribe(this._notify) });
    this._notify();
    return () => {
      this._stores.get(store)?.unsubscribe();
      this._stores.delete(store);
      this._notify();
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  /** Snapshot: bit 1 when any draft exists, bit 2 when one still loads or converts. */
  getState = (): number => {
    let state = 0;
    for (const store of this._stores.keys())
      for (const draft of store.getState().attachmentDrafts) {
        state |= 1;
        if (draft.inputLoading || draft.outputsConverting) return 3;
      }
    return state;
  };

  collectAssetIds(assetIds: Set<DBlobAssetId>): void {
    for (const store of this._stores.keys())
      collectFragmentAssetIds(store.getState().attachmentDrafts.flatMap(draft => draft.outputFragments), assetIds);
  }

  /** Moves every draft's images into the chat scope and returns the fragments by anchor, controls in registration order. */
  async takeAll(): Promise<CMEditDraftsTaken[]> {
    const taken: CMEditDraftsTaken[] = [];
    for (const [store, { anchor }] of this._stores) {
      const fragments = await store.getState().takeAllFragments('global', 'app-chat');
      if (fragments.length) taken.push({ anchor: anchor(), fragments });
    }
    return taken;
  }

  disposeAll(): void {
    for (const store of this._stores.keys())
      store.getState().removeAllAttachmentDrafts();
  }

  private _notify = () => {
    for (const listener of this._listeners) listener();
  };
}
