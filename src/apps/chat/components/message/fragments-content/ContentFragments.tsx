import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageContentFragment, DMessageFragment, DMessageFragmentId, isContentFragment, isPlaceholderPart, isTextPart, isVoidFragment } from '~/common/stores/chat/chat.fragments';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { BlockEdit_TextFragment } from './BlockEdit_TextFragment';
import { BlockOpEmpty } from './BlockOpEmpty';
import { BlockPartError } from './BlockPartError';
import { BlockPartImageRef } from './BlockPartImageRef';
import { BlockPartPlaceholder } from './BlockPartPlaceholder';
import { BlockPartText_AutoBlocks } from './BlockPartText_AutoBlocks';
import { BlockPartToolInvocation } from './BlockPartToolInvocation';
import { BlockPartToolResponse } from './BlockPartToolResponse';


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
  justifyContent: 'flex-start',
};

const endLayoutSx: SxProps = {
  ...editLayoutSx,
  justifyContent: 'flex-end',
};


export function ContentFragments(props: {

  fragments: DMessageFragment[]
  showEmptyNotice: boolean,

  contentScaling: ContentScaling,
  uiComplexityMode: UIComplexityMode,
  fitScreen: boolean,
  isMobile: boolean,
  messageRole: DMessageRole,
  optiAllowSubBlocksMemo?: boolean,
  disableMarkdownText: boolean,
  enhanceCodeBlocks: boolean,
  showUnsafeHtmlCode?: boolean,

  textEditsState: ChatMessageTextPartEditState | null,
  setEditedText?: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,
  onEditsApply: (withControl: boolean) => void,
  onEditsCancel: () => void,

  onFragmentBlank: () => void
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
  onMessageDelete?: () => void,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  const fromAssistant = props.messageRole === 'assistant';
  const fromUser = props.messageRole === 'user';
  const isEditingText = !!props.textEditsState;
  // const isMonoFragment = props.fragments.length < 2;
  const enableRestartFromEdit = !fromAssistant && props.messageRole !== 'system';
  const showDataStreamViz = props.uiComplexityMode !== 'minimal' && props.fragments.length === 1 && isVoidFragment(props.fragments[0]) && isPlaceholderPart(props.fragments[0].part);

  // Content Fragments Edit Zero-State: button to create a new TextContentFragment
  if (isEditingText && !props.fragments.length)
    return (
      <Button variant='plain' color='neutral' onClick={props.onFragmentBlank} sx={{ justifyContent: 'flex-start' }}>
        add text ...
      </Button>
    );

  // when editing text, don't show the empty notice
  if (props.showEmptyNotice && isEditingText)
    return null;

  // if no fragments, don't box them
  if (!props.showEmptyNotice && !props.fragments.length)
    return null;

  return <Box aria-label='message body' sx={(isEditingText || showDataStreamViz) ? editLayoutSx : fromAssistant ? startLayoutSx : endLayoutSx}>

    {/* Empty Message Block - if empty */}
    {props.showEmptyNotice && (
      <BlockOpEmpty
        text={`empty ${fromAssistant ? 'model ' : fromUser ? 'user ' : ''}message`}
        contentScaling={props.contentScaling}
        onDelete={props.onMessageDelete}
      />
    )}

    {props.fragments.map((fragment) => {

      // Render VOID fragments
      if (isVoidFragment(fragment)) {
        const { fId, part } = fragment;
        switch (part.pt) {
          case 'ph': {
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
          }

          case '_pt_sentinel':
          default:
            <ScaledTextBlockRenderer
              key={fId}
              text={`Unknown Void Fragment: ${part.pt}`}
              contentScaling={props.contentScaling}
              textRenderVariant='text'
              showAsDanger
            />;
            break;
        }
      }

      // Render CONTENT fragments
      if (!isContentFragment(fragment))
        return null;

      // simplify
      const { fId, part } = fragment;

      // Determine the text to edit based on the part type
      let editText = '';
      let editLabel;
      if (isTextPart(part))
        editText = part.text;
      else if (part.pt === 'error')
        editText = part.error;
      else if (part.pt === 'tool_invocation') {
        if (part.invocation.type === 'function_call') {
          editText = part.invocation.args /* string | null */ || '';
          editLabel = `[Invocation] Function Call: \`${part.invocation.name}\``;
        } else {
          editText = part.invocation.code;
          editLabel = `[Invocation] Code Execution: \`${part.invocation.language}\``;
        }
      } else if (part.pt === 'tool_response') {
        if (!part.error) {
          editText = part.response.result;
          editLabel = `[Response]: ${part.response.type === 'function_call' ? 'Function Call' : 'Code Execution'}: \`${part.id}\``;
        }
      }

      // editing for text parts, tool invocations, or tool responses
      if (props.textEditsState && !!props.setEditedText && (isTextPart(part) || part.pt === 'error' || part.pt === 'tool_invocation' || part.pt === 'tool_response')) {
        return (
          <BlockEdit_TextFragment
            key={'edit-' + fId}
            initialText={editText}
            inputLabel={editLabel}
            fragmentId={fId}
            contentScaling={props.contentScaling}
            enableRestart={enableRestartFromEdit}
            editedText={props.textEditsState[fId]}
            setEditedText={props.setEditedText}
            onSubmit={props.onEditsApply}
            onEscapePressed={props.onEditsCancel}
            // endDecorator='Shift+Enter to save · Ctrl+Shift+Enter to restart · Escape to cancel'
          />
        );
      }

      switch (part.pt) {
        case 'error':
          return (
            <BlockPartError
              key={fId}
              errorText={part.error}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
            />
          );


        case 'image_ref':
          return (
            <BlockPartImageRef
              key={fId}
              imageRefPart={part}
              fragmentId={fId}
              contentScaling={props.contentScaling}
              onFragmentDelete={/*isMonoFragment ? undefined :*/ props.onFragmentDelete}
              onFragmentReplace={props.onFragmentReplace}
            />
          );

        // This is the most frequent part by far, and can be broken down into sub-blocks
        case 'text':
          return (
            <BlockPartText_AutoBlocks
              key={fId}
              // ref={blocksRendererRef}
              textPartText={part.text}
              setEditedText={props.setEditedText}
              fragmentId={fId}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
              fitScreen={props.fitScreen}
              isMobile={props.isMobile}
              disableMarkdownText={props.disableMarkdownText}
              enhanceCodeBlocks={props.enhanceCodeBlocks}
              // renderWordsDiff={wordsDiff || undefined}
              showUnsafeHtmlCode={props.showUnsafeHtmlCode}
              optiAllowSubBlocksMemo={!!props.optiAllowSubBlocksMemo}
              onContextMenu={props.onContextMenu}
              onDoubleClick={props.onDoubleClick}
            />
          );

        case 'tool_invocation':
          return (
            <BlockPartToolInvocation
              key={fId}
              toolInvocationPart={part}
              contentScaling={props.contentScaling}
              onDoubleClick={props.onDoubleClick}
            />
          );

        case 'tool_response':
          return (
            <BlockPartToolResponse
              key={fId}
              toolResponsePart={part}
              contentScaling={props.contentScaling}
              onDoubleClick={props.onDoubleClick}
            />
          );

        case '_pt_sentinel':
        default:
          return (
            <ScaledTextBlockRenderer
              key={fId}
              text={`Unknown Content Fragment: ${part.pt}`}
              contentScaling={props.contentScaling}
              textRenderVariant='text'
              showAsDanger
            />
          );
      }
    }).filter(Boolean)}
  </Box>;
}
