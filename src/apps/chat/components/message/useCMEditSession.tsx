import * as React from 'react';
import { useStore } from 'zustand';

import type { DMessage, DMessageId } from '~/common/stores/chat/chat.message';
import type { Immutable } from '~/common/types/immutable.types';
import type { AttachmentDraftsStoreApi, AttachmentsDraftsStore } from '~/common/attachment-drafts/store-attachment-drafts_slice';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { createAttachmentDraftsVanillaStore } from '~/common/attachment-drafts/store-attachment-drafts_vanilla';
import { DMessageFragment, DMessageFragmentId, isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import { findFirstUserPromptFragment, normalizeUserFragmentGroupsOrder, userFragmentGroup } from '~/common/stores/chat/chat.fragment-order';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { getUserMessageFragmentPlacement } from '../../store-app-chat';


type CMEditFragments = Immutable<DMessageFragment[]>;

/** The host's one write: all the fragments of a message. A host without it is read-only. */
type CMFragmentsReplace = (messageId: DMessageId, fragments: DMessageFragment[]) => void;

/** Single-fragment calls for view-mode operations, derived from the one write. */
interface CMFragmentCalls {
  onMessageFragmentDelete: (messageId: DMessageId, fragmentId: DMessageFragmentId) => void;
  onMessageFragmentReplace: (messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void;
}

type CMEditSession = {
  drafts: AttachmentDraftsStoreApi;       // the new attachments, taken at Done
  base: CMEditFragments | null;           // the stored fragments at the first edit
  editable: CMEditFragments | null;       // the copy; null while untouched (the stored fragments render)
};

const _noDrafts = createAttachmentDraftsVanillaStore();
const _isDraftsBusy = (state: AttachmentsDraftsStore) => state.attachmentDrafts.some(draft => draft.inputLoading || draft.outputsConverting);


/**
 * Edit mode on a copy of the fragments. Untouched, the stored fragments render; the first edit copies them, and every
 * edit returns a new array that keeps the untouched fragment objects. Done writes the copy over the message; Cancel
 * confirms when edited. The session owns its attachment drafts store. No effects: a pending flip ends it during render.
 */
export function useCMEditSession(messageId: DMessageId, messageFragments: CMEditFragments, messagePendingIncomplete: boolean, onMessageFragmentsReplace: CMFragmentsReplace | undefined) {

  // state
  const [session, setSession] = React.useState<CMEditSession | null>(null);
  const sessionRef = React.useRef(session);
  sessionRef.current = session;

  // external state
  const { showPromisedOverlay } = useOverlayComponents();
  const draftsBusy = useStore(session?.drafts ?? _noDrafts, _isDraftsBusy);

  // a resume or ray restart flips the message to pending: the session ends
  if (session && messagePendingIncomplete) {
    session.drafts.getState().removeAllAttachmentDrafts();
    setSession(null);
  }


  const begin = React.useCallback(() => {
    const drafts = createAttachmentDraftsVanillaStore();
    setSession(s => s ?? { drafts, base: null, editable: null });
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
    // edited, or attachments waiting in the strip: confirm before dropping them
    if (current.editable || current.drafts.getState().attachmentDrafts.length) {
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
    current.drafts.getState().removeAllAttachmentDrafts();
    setSession(s => s === current ? null : s);
  }, [showPromisedOverlay]);

  /** Done: takes the new attachments into the copy and stores it when anything changed. False while attachments convert. */
  const apply = React.useCallback(async (): Promise<boolean> => {
    const started = sessionRef.current;
    if (!started || draftsBusy) return false;
    const drafts = await started.drafts.getState().takeAllFragments('global', 'app-chat');
    const current = sessionRef.current;
    if (current?.drafts !== started.drafts) return false; // ended while taking
    setSession(null);
    if (!current.editable && !drafts.length) return true;

    // new attachments join the attachment group
    let editable = current.editable ?? messageFragments;
    if (drafts.length) {
      const index = _attachmentGroupIndex(editable, drafts[0]);
      editable = [...editable.slice(0, index), ...drafts, ...editable.slice(index)];
    }

    // store, overwriting the message: empty text is dropped
    onMessageFragmentsReplace?.(messageId, editable.filter(fragment => !isTextContentFragment(fragment) || !!fragment.part.text));
    return true;
  }, [draftsBusy, messageFragments, messageId, onMessageFragmentsReplace]);


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


/** After the last attachment; without one, before the first user text when the composer's group order puts `inserted` first, else the end. */
function _attachmentGroupIndex(fragments: CMEditFragments, inserted: Immutable<DMessageFragment>): number {
  const lastAttachment = fragments.findLastIndex(fragment => fragment.ft === 'attachment');
  if (lastAttachment >= 0) return lastAttachment + 1;
  const groups = normalizeUserFragmentGroupsOrder(getUserMessageFragmentPlacement().order);
  const prompt = groups.indexOf(userFragmentGroup(inserted)) < groups.indexOf('text') ? findFirstUserPromptFragment(fragments) : undefined;
  return prompt ? fragments.indexOf(prompt) : fragments.length;
}
