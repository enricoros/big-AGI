import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import type { DMessageContentFragment, DMessageFragmentId, DMessageVoidFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessageRole } from '~/common/stores/chat/chat.message';

import { BlockPartModelAnnotations } from './BlockPartModelAnnotations';


const startLayoutSx: SxProps = {
  display: 'grid',
  gap: 1.5,     // see why we give more space on ChatMessage

  // NOTE: we used to have 'flex-start' here, but it was causing the Annotation fragment to not be able to
  // stretch to the full with of this 'void fragments' container.
  // So now we don't have 'flex-start' anymore, and we may expect issues with other Fragment kinds?
  // justifyContent: 'flex-start',
};

const endLayoutSx: SxProps = {
  ...startLayoutSx,
  justifyContent: 'flex-end',
};


/**
 * Note: one of the reasons to have a separate Void Fragments list (below images, above content)
 * is to display the void fragments without the 'star' separator (or edit state) that content fragments have.
 *
 * In the future we can revisit this decision in case Content fragments and *Void Fragments** are
 * interleaved - but for now, Void fragments will be grouped together at the top.
 *   ^ 2025-11-20: NOTE: Lol, yes we did
 */
export function VoidFragments(props: {

  voidFragments: DMessageVoidFragment[],
  nonVoidFragmentsCount: number,

  contentScaling: ContentScaling,
  uiComplexityMode: UIComplexityMode,
  messageRole: DMessageRole,
  messagePendingIncomplete?: boolean,

  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,

}) {

  const fromAssistant = props.messageRole === 'assistant';

  return <Box aria-label='message void' sx={fromAssistant ? startLayoutSx : endLayoutSx}>

    {props.voidFragments.map(({ fId, part }) => {
      switch (part.pt) {

        case 'annotations':
          return (
            <BlockPartModelAnnotations
              key={fId}
              annotations={part.annotations}
              contentScaling={props.contentScaling}
            />
          );

        case '_pt_sentinel':
          return null;

        default:
          // noinspection JSUnusedLocalSymbols
          const _exhaustiveVoidFragmentCheck: never = part;
          // fallthrough - we don't handle these here anymore
        case 'ma':
        case 'ph':
          return (
            <ScaledTextBlockRenderer
              key={fId}
              text={`Unknown Void Fragment: ${(part as any)?.pt}`}
              contentScaling={props.contentScaling}
              textRenderVariant='text'
              showAsDanger
            />
          );
      }

    })}

  </Box>;
}
