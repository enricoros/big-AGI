import * as React from 'react';

import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import { DMessageAttachmentFragment, DMessageContentFragment, DMessageFragment, DMessageVoidFragment, isAttachmentFragment, isContentFragment, isImageRefPart, isVoidFragment } from '../chat.fragments';


interface FragmentBuckets {
  voidFragments: DMessageVoidFragment[];
  contentFragments: DMessageContentFragment[];
  imageAttachments: DMessageAttachmentFragment[];
  nonImageAttachments: DMessageAttachmentFragment[];
}

/**
 * Split Fragments into renderable groups, while only recalculating when the input changes, and when content really changes
 */
export function useFragmentBuckets(messageFragments: DMessageFragment[]): FragmentBuckets {

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
      if (isContentFragment(fragment))
        contentFragments.push(fragment);
      else if (isAttachmentFragment(fragment)) {
        if (isImageRefPart(fragment.part))
          imageAttachments.push(fragment);
        else
          nonImageAttachments.push(fragment);
      } else if (isVoidFragment(fragment)) {
        voidFragments.push(fragment);
      } else
        console.warn('[DEV] Unexpected fragment type:', { fragment });
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

    return {
      voidFragments: voidFragmentsRef.current,
      contentFragments: contentFragmentsRef.current,
      imageAttachments: imageAttachmentsRef.current,
      nonImageAttachments: nonImageAttachmentsRef.current,
    };
  }, [messageFragments]);
}