/**
 * Sets a chat's system message from an instruction: history in, history out. It stores nothing, the caller does.
 *
 * The rules, in order:
 * - the system message is message 0, or there is none
 * - one the user edited (`updated` set) is theirs: nothing changes
 * - text fragments are mixed with the chat's clock; a mixed text takes the place of the stored text and keeps its id,
 *   as an edit does
 * - attachments are the caller's call: what `mapAttachment` returns goes in as it is, no copy is made
 * - an empty instruction removes the system message; a caller that wants to keep it does not call
 *
 * Nothing that comes in is changed. What goes out shares its objects with what came in (the stored message, the
 * caller's attachments), so a later step copies what it changes.
 */

import { promptMixer } from '~/modules/promptMixer/promptMixer';

import type { Immutable } from '~/common/types/immutable.types';

import { createDMessageEmpty, DMessage } from '../chat.message';
import { createTextContentFragment, DMessageAttachmentFragment, DMessageFragment, isAttachmentFragment, isTextContentFragment } from '../chat.fragments';


/** The system message while it is built: its own fields can be set, what they hold cannot be changed. */
type SystemMessageDraft = { [K in keyof DMessage]: Immutable<DMessage[K]> };

export function historyApply_systemInstruction(
  inputHistory: Immutable<DMessage[]>,
  instruction: Immutable<DMessageFragment[]>,
  options?: {
    /** sets `updated`: later runs leave this system message alone, as they do one the user edited */
    freeze?: boolean,
    /** the identity the caller keeps on the message, e.g. which persona it comes from */
    stamp?: (systemMessage: SystemMessageDraft) => void,
    /** what an attachment of the instruction becomes, usually the attachment itself; without it, attachments are left out */
    mapAttachment?: (fragment: Immutable<DMessageAttachmentFragment>) => Immutable<DMessageFragment> | null,
  },
): {
  nextHistory: Immutable<DMessage[]>,
  systemMessage: Immutable<DMessage> | null,
  modified: boolean,
} {

  const former = inputHistory[0]?.role === 'system' ? inputHistory[0] : null;
  if (former?.updated)
    return { nextHistory: inputHistory, systemMessage: former, modified: false };

  const chatMessages = former ? inputHistory.slice(1) : inputHistory;

  const fragments: Immutable<DMessageFragment>[] = [];
  for (const fragment of instruction) {
    const stored = former?.fragments[fragments.length]; // the stored fragment this one takes the place of, if any
    const built: Immutable<DMessageFragment> | null = isTextContentFragment(fragment) ? {
        ...createTextContentFragment(promptMixer.chat.mixInstruction(fragment.part.text, chatMessages)),
        // in the place of a stored text it is that text, edited: the id stays. Anywhere else it is a new fragment
        ...(stored?.ft === 'content' && stored.part?.pt === 'text' && { fId: stored.fId }),
      }
      : isAttachmentFragment(fragment) ? options?.mapAttachment?.(fragment) ?? null
        : null;
    if (built)
      fragments.push(built);
  }

  if (!fragments.length)
    return former ? { nextHistory: chatMessages, systemMessage: null, modified: true }
      : { nextHistory: inputHistory, systemMessage: null, modified: false };

  const systemMessage: SystemMessageDraft = former ? { ...former } : createDMessageEmpty('system');
  systemMessage.fragments = fragments;
  options?.stamp?.(systemMessage);
  if (options?.freeze)
    systemMessage.updated = Date.now();

  return { nextHistory: [systemMessage, ...chatMessages], systemMessage, modified: true };
}
