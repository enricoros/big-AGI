import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageContentFragment, DMessageFragmentId, DMessageVoidFragment, isPlaceholderPart } from '~/common/stores/chat/chat.fragments';
import { Release } from '~/common/app.release';

import { BlockPartModelAux } from './BlockPartModelAux';
import { BlockPartPlaceholder } from './BlockPartPlaceholder';
import { BlockPartModelAnnotations } from './BlockPartModelAnnotations';


const editLayoutSx: SxProps = {
  display: 'grid',
  gap: 1.5,     // see why we give more space on ChatMessage

  // horizontal separator between messages (second part+ and before)
  // '& > *:not(:first-of-type)': {
  //   borderTop: '1px solid',
  //   borderTopColor: 'background.level3',
  // },
};

const startLayoutSx: SxProps = {
  ...editLayoutSx,

  // NOTE: we used to have 'flex-start' here, but it was causing the Annotation fragment to not be able to
  // stretch to the full with of this 'void fragments' container.
  // So now we don't have 'flex-start' anymore, and we may expect issues with other Fragment kinds?
  // justifyContent: 'flex-start',
};

const endLayoutSx: SxProps = {
  ...editLayoutSx,
  justifyContent: 'flex-end',
};


/**
 * Note: one of the reasons to have a separate Void Fragments list (below images, above content)
 * is to display the void fragments without the 'star' separator (or edit state) that content fragments have.
 *
 * In the future we can revisit this decision in case Content fragments and *Void Fragments** are
 * interleaved - but for now, Void fragments will be grouped together at the top.
 */
export function VoidFragments(props: {

  voidFragments: DMessageVoidFragment[],
  nonVoidFragmentsCount: number,

  contentScaling: ContentScaling,
  uiComplexityMode: UIComplexityMode,
  messageRole: DMessageRole,

  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,

}) {

  const showDataStreamViz =
    !Release.Features.LIGHTER_ANIMATIONS
    && props.uiComplexityMode !== 'minimal'
    && props.voidFragments.length === 1 && props.nonVoidFragmentsCount === 0
    && isPlaceholderPart(props.voidFragments[0].part);

  const fromAssistant = props.messageRole === 'assistant';


  return <Box aria-label='message void' sx={showDataStreamViz ? editLayoutSx : fromAssistant ? startLayoutSx : endLayoutSx}>

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

        case 'ma':
          return (
            <BlockPartModelAux
              key={fId}
              fragmentId={fId}
              auxType={part.aType}
              auxText={part.aText}
              auxHasSignature={part.textSignature !== undefined}
              auxRedactedDataCount={part.redactedData?.length ?? 0}
              zenMode={props.uiComplexityMode === 'minimal'}
              contentScaling={props.contentScaling}
              onFragmentReplace={props.onFragmentReplace}
            />
          );

        case 'ph':
          return (
            <BlockPartPlaceholder
              key={fId}
              placeholderText={part.pText}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
              showAsItalic
              showAsDataStreamViz={showDataStreamViz}
            />
          );

        case '_pt_sentinel':
          return null;

        default:
          // noinspection JSUnusedLocalSymbols
          const _exhaustiveVoidFragmentCheck: never = part;
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
