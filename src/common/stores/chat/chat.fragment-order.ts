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

/**
 * Apply only when composing a NEW user message. Stored or edited sequences retain their explicit order.
 * With `splitAtMarker`, the first prompt line equal to the marker places the attachments (in preference order) there:
 * the prompt goes out as the text before and after it, the marker line dropped. No attachments: nothing is split.
 */
export function orderedUserFragments<T extends DMessageFragment>(fragments: readonly T[], order?: readonly unknown[] | null, splitAtMarker?: boolean): (T | DMessageContentFragment)[] {
  const groups: Record<UserMessageFragmentGroup, T[]> = { images: [], documents: [], text: [] };
  for (const fragment of fragments)
    groups[userFragmentGroup(fragment)].push(fragment);
  const groupsOrder = normalizeUserFragmentGroupsOrder(order);

  if (splitAtMarker) {
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

/** The text before and after the first line equal to the marker, trimmed at the cut; null without such a line. */
function _splitAtMarker(text: string): { before: string, after: string } | null {
  const lines = text.split('\n');
  const index = lines.findIndex(line => line.trim() === USER_MESSAGE_ATTACHMENTS_MARKER);
  if (index < 0) return null;
  return { before: lines.slice(0, index).join('\n').trimEnd(), after: lines.slice(index + 1).join('\n').trimStart() };
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
