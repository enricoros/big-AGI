import type { Immutable } from '~/common/types/immutable.types';

import type { DMessageContentFragment, DMessageFragment, DMessageTextPart } from './chat.fragments';
import { isTextContentFragment, isUnstampedFragment } from './chat.fragments';


export type UserMessageFragmentGroup = 'images' | 'documents' | 'text';

export const DEFAULT_USER_MESSAGE_FRAGMENT_ORDER = ['images', 'documents', 'text'] as const satisfies readonly UserMessageFragmentGroup[];


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

/** Apply only when composing a NEW user message. Stored or edited sequences retain their explicit order. */
export function orderedUserFragments<T extends DMessageFragment>(fragments: readonly T[], order?: readonly unknown[] | null): T[] {
  const groups: Record<UserMessageFragmentGroup, T[]> = { images: [], documents: [], text: [] };
  for (const fragment of fragments)
    groups[userFragmentGroup(fragment)].push(fragment);
  return normalizeUserFragmentGroupsOrder(order).flatMap(group => groups[group]);
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
