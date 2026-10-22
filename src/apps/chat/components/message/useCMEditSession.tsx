import * as React from 'react';

import type { DBlobAssetId } from '~/common/stores/blob/dblobs-portability';
import type { DMessage, DMessageId } from '~/common/stores/chat/chat.message';
import type { Immutable } from '~/common/types/immutable.types';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { DMessageFragment, DMessageFragmentId, isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { gcRegisterAssetCollector } from '~/common/stores/chat/chat.gc';
import { isDeepEqual } from '~/common/util/hooks/useDeep';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { CMEditDrafts } from './cmEditDrafts';


type CMEditFragments = Immutable<DMessageFragment[]>;

/** The host's one write: all the fragments of a message. A host without it is read-only. */
type CMFragmentsReplace = (messageId: DMessageId, fragments: DMessageFragment[]) => void;

/** Single-fragment calls for view-mode operations, derived from the one write. */
interface CMFragmentCalls {
  onMessageFragmentDelete: (messageId: DMessageId, fragmentId: DMessageFragmentId) => void;
  onMessageFragmentReplace: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void;
}

type CMEditSession = {
  drafts: CMEditDrafts;                   // the add controls' drafts, taken at Done
  base: CMEditFragments | null;           // the stored fragments at the first edit
  editable: CMEditFragments | null;       // the copy; null while untouched (the stored fragments render)
};

const _noDrafts = new CMEditDrafts();
const _noDraftsState = () => 0;


/**
 * Edit mode on a copy of the fragments. Untouched, the stored fragments render; the first edit copies them, and every
 * edit returns a new array that keeps the untouched fragment objects. Done writes the copy over the message, confirming
 * when the stored message changed since the first edit; Cancel confirms when edited. The add controls register their
 * drafts stores with the session (`CMEditDrafts`). No effects: a pending flip ends it during render.
 */
export function useCMEditSession(messageId: DMessageId, messageFragments: CMEditFragments, messagePendingIncomplete: boolean, onMessageFragmentsReplace: CMFragmentsReplace | undefined) {

  // state
  const [session, setSession] = React.useState<CMEditSession | null>(null);
  const sessionRef = React.useRef(session);
  sessionRef.current = session;
  const storedRef = React.useRef(messageFragments);
  storedRef.current = messageFragments;

  // external state
  const { showPromisedOverlay } = useOverlayComponents();
  const drafts = session?.drafts ?? _noDrafts;
  const draftsState = React.useSyncExternalStore(drafts.subscribe, drafts.getState, _noDraftsState);
  const draftsBusy = !!(draftsState & 2);

  // a resume or ray restart flips the message to pending: the session ends
  if (session && messagePendingIncomplete) {
    session.drafts.disposeAll();
    setSession(null);
  }


  const begin = React.useCallback(() => {
    setSession(s => s ?? { drafts: new CMEditDrafts(), base: null, editable: null });
  }, []);

  /** Applies an edit to the copy; a result with the same fragments changes nothing. */
  const update = React.useCallback((edit: (fragments: CMEditFragments) => CMEditFragments) => setSession(s => {
    if (!s) return s;
    const from = s.editable ?? messageFragments;
    const editable = edit(from);
    return editable.length === from.length && editable.every((fragment, i) => fragment === from[i]) ? s : { ...s, base: s.base ?? from, editable };
  }), [messageFragments]);

  const cancel = React.useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    // edited, or attachments waiting in an add control: confirm before dropping them
    if (current.editable || current.drafts.getState() & 1) {
      const confirmed = await showPromisedOverlay('chat-message-edit-discard', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
        <ConfirmationModal
          open onClose={onUserReject} onPositive={() => onResolve(true)}
          title='Discard Edits'
          confirmationText='Discard the changes to this message?'
          positiveActionText='Discard'
        />,
      );
      if (!confirmed) return;
    }
    current.drafts.disposeAll();
    setSession(s => s === current ? null : s);
  }, [showPromisedOverlay]);

  /** Done: takes the new attachments into the copy and stores it when anything changed. False while attachments convert, or when declined. */
  const apply = React.useCallback(async (): Promise<boolean> => {
    const started = sessionRef.current;
    if (!started || draftsBusy) return false;

    // the stored message changed under the copy (sync, a follow-up, another tab): confirm the overwrite
    if (started.base && !isDeepEqual(started.base, storedRef.current)) {
      const confirmed = await showPromisedOverlay('chat-message-edit-overwrite', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
        <ConfirmationModal
          open onClose={onUserReject} onPositive={() => onResolve(true)}
          title='Message Changed'
          confirmationText='The message changed while you edited. Overwrite it?'
          positiveActionText='Overwrite'
        />,
      );
      if (!confirmed || sessionRef.current?.drafts !== started.drafts) return false;
    }

    // the new images leave the drafts scope before the message references them: keep them from a chat GC meanwhile
    const draftAssetIds = new Set<DBlobAssetId>();
    started.drafts.collectAssetIds(draftAssetIds);
    const unregisterCollector = gcRegisterAssetCollector(() => [...draftAssetIds]);
    try {
      const taken = await started.drafts.takeAll();
      const current = sessionRef.current;
      if (current?.drafts !== started.drafts) return false; // ended while taking
      setSession(null);
      if (!current.editable && !taken.length) return true;

      // each control's drafts follow its anchor (the group's last member), or go to the end
      let editable = current.editable ?? storedRef.current;
      for (const { anchor, fragments } of taken) {
        const index = anchor === null ? -1 : editable.findIndex(fragment => fragment.fId === anchor);
        editable = index < 0 ? [...editable, ...fragments] : [...editable.slice(0, index + 1), ...fragments, ...editable.slice(index + 1)];
      }

      // store, overwriting the message: empty text is dropped
      onMessageFragmentsReplace?.(messageId, editable.filter(fragment => !isTextContentFragment(fragment) || !!fragment.part.text));
      return true;
    } finally {
      unregisterCollector();
    }
  }, [draftsBusy, messageId, onMessageFragmentsReplace, showPromisedOverlay]);


  // the fragments the copy changed or added, by id: their editors count as edited (save shortcuts)
  const editedFragmentIds = React.useMemo(() => !session?.editable ? null : new Set(session.editable.filter(fragment => !session.base?.includes(fragment)).map(fragment => fragment.fId)), [session]);

  return {
    editable: !session ? null : session.editable ?? messageFragments,
    editedFragmentIds,
    drafts: session?.drafts ?? null,
    draftsBusy,
    update, begin, cancel, apply,
  };
}


/**
 * The single-fragment calls, derived from `onMessageFragmentsReplace`; none without it (read-only). Each call is one
 * write of the whole message, and calls within one event (reasoning to text, link resolution) chain.
 */
export function useCMHostFragmentCalls(messageRef: { readonly current: Immutable<Pick<DMessage, 'fragments'>> }, onMessageFragmentsReplace: CMFragmentsReplace | undefined): Partial<CMFragmentCalls> {
  const lastWriteRef = React.useRef<{ stored: CMEditFragments, written: CMEditFragments } | null>(null);
  return React.useMemo(() => {
    if (!onMessageFragmentsReplace)
      return {};
    const write = (messageId: DMessageId, edit: (fragments: CMEditFragments) => CMEditFragments) => {
      const stored = messageRef.current.fragments;
      const last = lastWriteRef.current;
      const written = edit(last?.stored === stored ? last.written : stored);
      lastWriteRef.current = { stored, written };
      onMessageFragmentsReplace(messageId, [...written]);
    };
    return {
      onMessageFragmentDelete: (messageId, fragmentId) => write(messageId, fragments => fragments.filter(f => f.fId !== fragmentId)),
      onMessageFragmentReplace: (messageId, fragmentId, newFragment) => write(messageId, fragments => fragments.map(f => f.fId === fragmentId ? newFragment : f)),
    };
  }, [messageRef, onMessageFragmentsReplace]);
}

