import * as React from 'react';

import { DMessageAttachmentFragment, DMessageContentFragment, DMessageFragment, isAttachmentFragment, isContentFragment, isImageRefPart } from '~/common/stores/chat/chat.fragments';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';


interface FragmentBuckets {
  contentFragments: DMessageContentFragment[];
  imageAttachments: DMessageAttachmentFragment[];
  nonImageAttachments: DMessageAttachmentFragment[];
}

/**
 * Split Fragments into renderable groups, while only recalculating when the input changes, and when content really changes
 */
export function useFragmentBuckets(messageFragments: DMessageFragment[]): FragmentBuckets {

  // Refs to store the last stable value for each bucket
  const contentFragmentsRef = React.useRef<DMessageContentFragment[]>([]);
  const imageAttachmentsRef = React.useRef<DMessageAttachmentFragment[]>([]);
  const nonImageAttachmentsRef = React.useRef<DMessageAttachmentFragment[]>([]);

  // Use useMemo to recalculate buckets only when messageFragments changes
  return React.useMemo(() => {

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
      } else
        console.warn('[DEV] Unexpected fragment type:', fragment.ft);
    });

    // For each bucket, return the new value if it's different, otherwise return the stable ref
    if (!shallowEquals(contentFragments, contentFragmentsRef.current))
      contentFragmentsRef.current = contentFragments;

    if (!shallowEquals(imageAttachments, imageAttachmentsRef.current))
      imageAttachmentsRef.current = imageAttachments;

    if (!shallowEquals(nonImageAttachments, nonImageAttachmentsRef.current))
      nonImageAttachmentsRef.current = nonImageAttachments;

    return {
      contentFragments: contentFragmentsRef.current,
      imageAttachments: imageAttachmentsRef.current,
      nonImageAttachments: nonImageAttachmentsRef.current,
    };
  }, [messageFragments]);
}