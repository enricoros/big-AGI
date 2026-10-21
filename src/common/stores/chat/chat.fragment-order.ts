import type { Immutable } from '~/common/types/immutable.types';

import type { DMessageContentFragment, DMessageFragment, DMessageTextPart } from './chat.fragments';
import { createTextContentFragment, isTextContentFragment, isUnstampedFragment } from './chat.fragments';


export type UserMessageFragmentGroup = 'images' | 'documents' | 'text';

export const DEFAULT_USER_MESSAGE_FRAGMENT_ORDER = ['images', 'documents', 'text'] as const satisfies readonly UserMessageFragmentGroup[];

/** A prompt line equal to this places the attachments there, when the preference is on (see `orderedUserFragments`). */
export const USER_MESSAGE_ATTACHMENTS_MARKER = '{{attachments}}';


/** Complete partial preferences in default order, ignoring stale or duplicate groups. */
export function normalizeUserFragmentGroupsOrder(order?: readonly unknown[] | null): UserMessageFragmentGroup[] {
  const result: UserMessageFragmentGroup[] = [];
  for (const group of [...(Array.isArray(order) ? order : []), ...DEFAULT_USER_MESSAGE_FRAGMENT_ORDER]) {
    if ((group === 'images' || group === 'documents' || group === 'text') && !result.includes(group))
      result.push(group);
  }
  return result;
}

/** The Images preference also covers live frames, audio assets and URL video inputs. */
export function userFragmentGroup(fragment: DMessageFragment): UserMessageFragmentGroup {
  if (fragment.ft === 'content' || fragment.ft === 'attachment') {
    const part = fragment.part;
    if (part.pt === 'image_ref' || (part.pt === 'reference' && part.rt === 'zync' && part.zType === 'asset'))
      return 'images';
    if (part.pt === 'hosted_resource') {
      const resource = part.resource;
      if (resource.via === 'url' || (resource.via === 'gemini-file' && /^(image|video|audio)\//.test(resource.mimeType)))
        return 'images';
      return 'documents';
    }
    if (fragment.ft === 'attachment')
      return 'documents';
  }
  return 'text';
}

/** Where the attachments go in a new user message. */
export interface UserMessageFragmentPlacement {
  /** Group order, completed by `normalizeUserFragmentGroupsOrder`. */
  order?: readonly unknown[] | null;
  /** The first `{{attachments}}` in the prompt places them there instead. */
  splitAtMarker?: boolean;
}

/**
 * Apply only when composing a NEW user message. Stored or edited sequences retain their explicit order.
 * With `splitAtMarker`, the first marker in the prompt places the attachments (in preference order) there: the prompt
 * goes out as the text before and after it, the marker dropped. No attachments: nothing is split.
 */
export function orderedUserFragments<T extends DMessageFragment>(fragments: readonly T[], placement?: UserMessageFragmentPlacement | null): (T | DMessageContentFragment)[] {
  const groups: Record<UserMessageFragmentGroup, T[]> = { images: [], documents: [], text: [] };
  for (const fragment of fragments)
    groups[userFragmentGroup(fragment)].push(fragment);
  const groupsOrder = normalizeUserFragmentGroupsOrder(placement?.order);

  if (placement?.splitAtMarker) {
    const attachments = groupsOrder.filter(group => group !== 'text').flatMap(group => groups[group]);
    const index = attachments.length ? groups.text.findIndex(_isUserPromptFragment) : -1;
    const prompt = index < 0 ? undefined : groups.text[index];
    const split = prompt && isTextContentFragment(prompt) ? _splitAtMarker(prompt.part.text) : null;
    if (split) {
      return [
        ...groups.text.slice(0, index),
        ...(split.before ? [createTextContentFragment(split.before)] : []),
        ...attachments,
        ...(split.after ? [createTextContentFragment(split.after)] : []),
        ...groups.text.slice(index + 1),
      ];
    }
  }

  return groupsOrder.flatMap(group => groups[group]);
}

/** The text before and after the first marker, trimmed at the cut; null without a marker. */
function _splitAtMarker(text: string): { before: string, after: string } | null {
  const index = text.indexOf(USER_MESSAGE_ATTACHMENTS_MARKER);
  if (index < 0) return null;
  return { before: text.slice(0, index).trimEnd(), after: text.slice(index + USER_MESSAGE_ATTACHMENTS_MARKER.length).trimStart() };
}


/** Attachment placement must not change which authored text supplies a slash command or image prompt. */
export function findFirstUserPromptFragment(fragments: Immutable<DMessageFragment[]>) {
  return fragments.find(_isUserPromptFragment);
}

export function findLastUserPromptFragment(fragments: Immutable<DMessageFragment[]>) {
  return fragments.findLast(_isUserPromptFragment);
}

/** Stamped text (e.g. persona reinforcement prefix/suffix) is app-injected and must not become the command prompt. */
function _isUserPromptFragment(fragment: Immutable<DMessageFragment>): fragment is Immutable<DMessageContentFragment & { part: DMessageTextPart }> {
  return isTextContentFragment(fragment) && isUnstampedFragment(fragment);
}
