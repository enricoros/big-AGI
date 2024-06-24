import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageContentFragment, DMessageFragment, DMessageFragmentId, isContentFragment } from '~/common/stores/chat/chat.fragments';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { ContentPartImageRef } from './ContentPartImageRef';
import { ContentPartPlaceholder } from './ContentPartPlaceholder';
import { PartTextBlocks } from './PartTextBlocks';
import { PartTextEdit } from './PartTextEdit';


const editLayoutSx: SxProps = {
  display: 'grid',
  gap: 1.5,     // see why we give more space on ChatMessage

  // horizontal separator between messages (second part+ and before)
  // '& > *:not(:first-child)': {
  //   borderTop: '1px solid',
  //   borderTopColor: 'background.level3',
  // },
};

const startLayoutSx: SxProps = {
  ...editLayoutSx,
  justifyContent: 'flex-start',
};

const endLayoutSx: SxProps = {
  ...editLayoutSx,
  justifyContent: 'flex-end',
};


export function ContentFragments(props: {

  fragments: DMessageFragment[]

  contentScaling: ContentScaling,
  fitScreen: boolean,
  messageOriginLLM?: string,
  messageRole: DMessageRole,
  optiAllowSubBlocksMemo?: boolean,
  renderTextAsMarkdown: boolean,
  showTopWarning?: string,
  showUnsafeHtml?: boolean,

  textEditsState: ChatMessageTextPartEditState | null,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  onEditsApply: () => void,
  onEditsCancel: () => void,

  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  const fromAssistant = props.messageRole === 'assistant';
  const isEditingText = !!props.textEditsState;
  const isMonoFragment = props.fragments.length < 2;

  // if no fragments, don't box them
  if (!props.fragments.length)
    return null;

  return <Box aria-label='message body' sx={isEditingText ? editLayoutSx : fromAssistant ? startLayoutSx : endLayoutSx}>
    {props.fragments.map((fragment) => {

      // only proceed with DMessageContentFragment
      if (!isContentFragment(fragment))
        return null;

      switch (fragment.part.pt) {
        case 'text':
          return props.textEditsState ? (
            <PartTextEdit
              key={'edit-' + fragment.fId}
              textPartText={fragment.part.text}
              fragmentId={fragment.fId}
              contentScaling={props.contentScaling}
              editedText={props.textEditsState[fragment.fId]}
              setEditedText={props.setEditedText}
              onEnterPressed={props.onEditsApply}
              onEscapePressed={props.onEditsCancel}
            />
          ) : (
            <PartTextBlocks
              key={fragment.fId}
              // ref={blocksRendererRef}
              textPartText={fragment.part.text}
              messageRole={props.messageRole}
              messageOriginLLM={props.messageOriginLLM}
              contentScaling={props.contentScaling}
              fitScreen={props.fitScreen}
              renderTextAsMarkdown={props.renderTextAsMarkdown}
              // renderTextDiff={textDiffs || undefined}
              showUnsafeHtml={props.showUnsafeHtml}
              showTopWarning={props.showTopWarning}
              optiAllowSubBlocksMemo={!!props.optiAllowSubBlocksMemo}
              onContextMenu={props.onContextMenu}
              onDoubleClick={props.onDoubleClick}
            />
          );

        case 'image_ref':
          return (
            <ContentPartImageRef
              key={fragment.fId}
              imageRefPart={fragment.part}
              fragmentId={fragment.fId}
              contentScaling={props.contentScaling}
              onFragmentDelete={!isMonoFragment ? props.onFragmentDelete : undefined}
              onFragmentReplace={props.onFragmentReplace}
            />
          );

        case 'ph':
          return (
            <ContentPartPlaceholder
              key={fragment.fId}
              placeholderText={fragment.part.pText}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
              showAsItalic
            />
          );

        case 'error':
          return props.textEditsState ? (
            <PartTextEdit
              key={'edit-' + fragment.fId}
              textPartText={fragment.part.error}
              fragmentId={fragment.fId}
              contentScaling={props.contentScaling}
              editedText={props.textEditsState[fragment.fId]}
              setEditedText={props.setEditedText}
              onEnterPressed={props.onEditsApply}
              onEscapePressed={props.onEditsCancel}
            />
          ) : (
            <ContentPartPlaceholder
              key={fragment.fId}
              placeholderText={fragment.part.error}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
              showAsDanger
              showAsItalic
            />
          );

        case 'tool_call':
        case 'tool_response':
        case '_pt_sentinel':
        default:
          return (
            <ContentPartPlaceholder
              key={fragment.fId}
              placeholderText={`Unknown Content fragment: ${fragment.part.pt}`}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
              showAsDanger
            />
          );
      }
    }).filter(Boolean)}
  </Box>;
}
