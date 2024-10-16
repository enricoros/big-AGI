import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Sheet } from '@mui/joy';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
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
              // renderTextDiff={textDiffs || undefined}
              showUnsafeHtmlCode={props.showUnsafeHtmlCode}
              optiAllowSubBlocksMemo={!!props.optiAllowSubBlocksMemo}
              onContextMenu={props.onContextMenu}
              onDoubleClick={props.onDoubleClick}
            />
          );

        case 'tool_invocation':
          return (
            <BlocksContainer key={fId}>
              {part.invocation.type === 'function_call' ? (
                <Sheet color='neutral' variant='soft' sx={{
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'neutral.outlinedColor',
                  width: '100%',
                  borderRadius: 'lg',
                  boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
                  fontSize: 'sm',
                  p: 2,
                  // grid layout with 2 cols
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 2,
                  rowGap: 1,
                }}>
                  <div>Id</div>
                  <div>{part.id}</div>
                  <div>Name</div>
                  <div>{part.invocation.name}</div>
                  <div>Args</div>
                  <div>{part.invocation.args/*?.replaceAll('{', '').replaceAll('}', '').replaceAll('","', '", "')*/}</div>
                </Sheet>
              ) : (
                <Sheet color='neutral' variant='soft' sx={{
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'neutral.outlinedColor',
                  width: '100%',
                  borderRadius: 'lg',
                  boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
                  fontSize: 'sm',
                  p: 2,
                  // grid layout with 2 cols
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 2,
                  rowGap: 1,
                }}>
                  <div>Id</div>
                  <div>{part.id}</div>
                  <div>Language</div>
                  <div>{part.invocation.language}</div>
                  <div>Code</div>
                  <div style={{ whiteSpace: 'pre' }}>{part.invocation.code?.trim()}</div>
                  <div>Author</div>
                  <div>{part.invocation.author}</div>
                </Sheet>
              )}
            </BlocksContainer>
          );

        case 'tool_response':
          return (
            <BlocksContainer key={fId}>
              {part.response.type === 'function_call' ? (
                <Sheet color='neutral' variant='soft' sx={{
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'neutral.outlinedColor',
                  width: '100%',
                  borderRadius: 'lg',
                  boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
                  fontSize: 'sm',
                  p: 2,
                  // grid layout with 2 cols
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 2,
                  rowGap: 1,
                }}>
                  <div>Type</div>
                  <div>Function Call Response</div>
                  <div>Id</div>
                  <div>{part.id}</div>
                  <div>Error</div>
                  <div>{part.error === null ? 'null' : part.error === 'false' ? '' : part.error}</div>
                  <div>Name</div>
                  <div style={{ fontWeight: 700 }}>{part.response.name}</div>
                  <div>Result</div>
                  <div style={{ fontWeight: 700 }}>{part.response.result}</div>
                  <div>Environment</div>
                  <div>{part.environment}</div>
                </Sheet>
              ) : (
                <Sheet color='neutral' variant='solid' sx={{
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'neutral.outlinedColor',
                  width: '100%',
                  borderRadius: 'lg',
                  boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
                  fontSize: 'sm',
                  p: 2,
                  // grid layout with 2 cols
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 2,
                  rowGap: 1,
                }}>
                  <div>Type</div>
                  <div>Code Execution Response</div>
                  <div>Id</div>
                  <div>{part.id}</div>
                  <div>Error</div>
                  <div>{part.error === null ? 'null' : part.error === 'false' ? '' : part.error}</div>
                  <div>Result</div>
                  <div style={{ fontWeight: 700 }}>{part.response.result}</div>
                  <div>Executor</div>
                  <div>{part.response.executor}</div>
                  <div>Environment</div>
                  <div>{part.environment}</div>
                </Sheet>
              )}
            </BlocksContainer>
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
