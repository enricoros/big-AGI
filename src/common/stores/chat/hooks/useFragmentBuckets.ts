import * as React from 'react';

import type { Immutable } from '~/common/types/immutable.types';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import { DMessageAttachmentFragment, DMessageContentFragment, DMessageFragment, DMessageVoidFragment, DVoidFragmentModelAnnotations, isContentFragment, isErrorPart, isImageRefPart, isVoidAnnotationsFragment, isZyncAssetImageReferencePart } from '../chat.fragments';

/**
 * Fragments that can be interleaved: void fragments (reasoning, placeholders) and content fragments (text, code, tools).
 * Excludes annotations (rendered separately at top) and attachments (rendered separately).
 */
export type InterleavedFragment = DMessageVoidFragment | DMessageContentFragment;

interface FragmentBuckets {
  annotationFragments: DVoidFragmentModelAnnotations[];
  interleavedFragments: InterleavedFragment[];
  imageAttachments: DMessageAttachmentFragment[];
  nonImageAttachments: DMessageAttachmentFragment[];
  lastFragmentIsError: boolean;
}

/**
 * Split Fragments into renderable groups, while only recalculating when the input changes, and when content really changes
 */
export function useFragmentBuckets(messageFragments: Immutable<DMessageFragment[]>): FragmentBuckets {

  // Refs to store the last stable value for each bucket
  const annotationFragmentsRef = React.useRef<DVoidFragmentModelAnnotations[]>([]);
  const interleavedFragmentsRef = React.useRef<InterleavedFragment[]>([]);
  const imageAttachmentsRef = React.useRef<DMessageAttachmentFragment[]>([]);
  const nonImageAttachmentsRef = React.useRef<DMessageAttachmentFragment[]>([]);

  // Use useMemo to recalculate buckets only when messageFragments changes
  return React.useMemo(() => {

    const annotationFragments: DVoidFragmentModelAnnotations[] = [];
    const interleavedFragments: InterleavedFragment[] = [];
    const imageAttachments: DMessageAttachmentFragment[] = [];
    const nonImageAttachments: DMessageAttachmentFragment[] = [];

    messageFragments.forEach(fragment => {
      const ft = fragment.ft;
      switch (ft) {
        case 'content':
          // Content fragments go into interleaved list (in order)
          return interleavedFragments.push(fragment);
        case 'attachment':
          // Attachments stay separated for special rendering
          if (isZyncAssetImageReferencePart(fragment.part) || isImageRefPart(fragment.part))
            return imageAttachments.push(fragment);
          else
            return nonImageAttachments.push(fragment);
        case 'void':
          // Use type guard to properly narrow the fragment type
          if (isVoidAnnotationsFragment(fragment))
            return annotationFragments.push(fragment);
          else
            return interleavedFragments.push(fragment);
        case '_ft_sentinel':
          break; // nothing to do here - this is a sentinel type
        default:
          const _exhaustiveCheck: never = ft;
          console.warn('[DEV] Unexpected fragment type:', { fragment });
      }
    });

    // For each bucket, return the new value if it's different, otherwise return the stable ref
    if (!shallowEquals(annotationFragments, annotationFragmentsRef.current))
      annotationFragmentsRef.current = annotationFragments;

    if (!shallowEquals(interleavedFragments, interleavedFragmentsRef.current))
      interleavedFragmentsRef.current = interleavedFragments;

    if (!shallowEquals(imageAttachments, imageAttachmentsRef.current))
      imageAttachmentsRef.current = imageAttachments;

    if (!shallowEquals(nonImageAttachments, nonImageAttachmentsRef.current))
      nonImageAttachmentsRef.current = nonImageAttachments;

    const lastFragment: DMessageFragment | undefined = messageFragments.at(-1);

    return {
      annotationFragments: annotationFragmentsRef.current,
      interleavedFragments: interleavedFragmentsRef.current,
      imageAttachments: imageAttachmentsRef.current,
      nonImageAttachments: nonImageAttachmentsRef.current,
      lastFragmentIsError: !!lastFragment && isContentFragment(lastFragment) && isErrorPart(lastFragment.part),
    };
  }, [messageFragments]);
}