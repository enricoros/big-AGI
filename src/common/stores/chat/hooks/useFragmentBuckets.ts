import * as React from 'react';

import type { Immutable } from '~/common/types/immutable.types';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import { DMessageAttachmentFragment, DMessageContentFragment, DMessageFragment, DMessageVoidFragment, isContentFragment, isErrorPart, isImageRefPart, isZyncAssetImageReferencePart } from '../chat.fragments';


interface FragmentBuckets {
  voidFragments: DMessageVoidFragment[];
  contentFragments: DMessageContentFragment[];
  imageAttachments: DMessageAttachmentFragment[];
  nonImageAttachments: DMessageAttachmentFragment[];
  lastFragmentIsError: boolean;
}

/**
 * Split Fragments into renderable groups, while only recalculating when the input changes, and when content really changes
 */
export function useFragmentBuckets(messageFragments: Immutable<DMessageFragment[]>): FragmentBuckets {

  // Refs to store the last stable value for each bucket
  const voidFragmentsRef = React.useRef<DMessageVoidFragment[]>([]);
  const contentFragmentsRef = React.useRef<DMessageContentFragment[]>([]);
  const imageAttachmentsRef = React.useRef<DMessageAttachmentFragment[]>([]);
  const nonImageAttachmentsRef = React.useRef<DMessageAttachmentFragment[]>([]);

  // Use useMemo to recalculate buckets only when messageFragments changes
  return React.useMemo(() => {

    const voidFragments: DMessageVoidFragment[] = [];
    const contentFragments: DMessageContentFragment[] = [];
    const imageAttachments: DMessageAttachmentFragment[] = [];
    const nonImageAttachments: DMessageAttachmentFragment[] = [];

    messageFragments.forEach(fragment => {
      const ft = fragment.ft;
      switch (ft) {
        case 'content':
          return contentFragments.push(fragment);
        case 'attachment':
          if (isZyncAssetImageReferencePart(fragment.part) || isImageRefPart(fragment.part))
            return imageAttachments.push(fragment);
          else
            return nonImageAttachments.push(fragment);
        case 'void':
          return voidFragments.push(fragment);
        case '_ft_sentinel':
          break; // nothing to do here - this is a sentinel type
        default:
          const _exhaustiveCheck: never = ft;
          console.warn('[DEV] Unexpected fragment type:', { fragment });
      }
    });

    // For each bucket, return the new value if it's different, otherwise return the stable ref
    if (!shallowEquals(voidFragments, voidFragmentsRef.current))
      voidFragmentsRef.current = voidFragments;

    if (!shallowEquals(contentFragments, contentFragmentsRef.current))
      contentFragmentsRef.current = contentFragments;

    if (!shallowEquals(imageAttachments, imageAttachmentsRef.current))
      imageAttachmentsRef.current = imageAttachments;

    if (!shallowEquals(nonImageAttachments, nonImageAttachmentsRef.current))
      nonImageAttachmentsRef.current = nonImageAttachments;

    const lastFragment: DMessageFragment | undefined = messageFragments.at(-1);

    return {
      voidFragments: voidFragmentsRef.current,
      contentFragments: contentFragmentsRef.current,
      imageAttachments: imageAttachmentsRef.current,
      nonImageAttachments: nonImageAttachmentsRef.current,
      lastFragmentIsError: !!lastFragment && isContentFragment(lastFragment) && isErrorPart(lastFragment.part),
    };
  }, [messageFragments]);
}