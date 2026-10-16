import type { Immutable } from '~/common/types/immutable.types';

import type { DMessageContentFragment, DMessageFragment, DMessageTextPart } from './chat.fragments';
import { isTextContentFragment, isUnstampedFragment } from './chat.fragments';


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
