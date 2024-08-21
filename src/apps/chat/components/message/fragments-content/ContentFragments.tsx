import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Sheet } from '@mui/joy';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageContentFragment, DMessageFragment, DMessageFragmentId, isContentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { ContentPartImageRef } from './ContentPartImageRef';
import { ContentPartPlaceholder } from './ContentPartPlaceholder';
import { ContentPartText_AutoBlocks } from './ContentPartText_AutoBlocks';
import { TextFragmentEditor } from './TextFragmentEditor';


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
  fitScreen: boolean,
  isMobile: boolean,
  messageRole: DMessageRole,
  optiAllowSubBlocksMemo?: boolean,
  disableMarkdownText: boolean,
  enhanceCodeBlocks: boolean,
  showUnsafeHtml?: boolean,

  textEditsState: ChatMessageTextPartEditState | null,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  onEditsApply: (withControl: boolean) => void,
  onEditsCancel: () => void,

  onFragmentBlank: () => void
  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  const fromAssistant = props.messageRole === 'assistant';
  const fromUser = props.messageRole === 'user';
  const isEditingText = !!props.textEditsState;
  // const isMonoFragment = props.fragments.length < 2;

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

  return <Box aria-label='message body' sx={isEditingText ? editLayoutSx : fromAssistant ? startLayoutSx : endLayoutSx}>

    {/* The overall message is empty - show an indication of it */}
    {props.showEmptyNotice && (
      <Sheet variant='solid' color='neutral' invertedColors sx={{ mx: 1.5 }}>
        <ContentPartPlaceholder
          placeholderText={`empty ${fromAssistant ? 'assistant ' : fromUser ? 'user ' : ''}message - please edit or delete`}
          messageRole={props.messageRole}
          contentScaling={props.contentScaling}
          showAsItalic
        />
      </Sheet>
    )}

    {props.fragments.map((fragment) => {

      // only proceed with DMessageContentFragment
      if (!isContentFragment(fragment))
        return null;

      // editing for text parts
      if (props.textEditsState && (isTextPart(fragment.part) || fragment.part.pt === 'error')) {
        return (
          <TextFragmentEditor
            key={'edit-' + fragment.fId}
            textPartText={isTextPart(fragment.part) ? fragment.part.text : fragment.part.error}
            fragmentId={fragment.fId}
            contentScaling={props.contentScaling}
            enableRestart
            editedText={props.textEditsState[fragment.fId]}
            setEditedText={props.setEditedText}
            onSubmit={props.onEditsApply}
            onEscapePressed={props.onEditsCancel}
            // endDecorator='Shift+Enter to save · Ctrl+Shift+Enter to restart · Escape to cancel'
          />
        );
      }

      switch (fragment.part.pt) {
        case 'error':
          return (
            <ContentPartPlaceholder
              key={fragment.fId}
              placeholderText={fragment.part.error}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
              showAsDanger
              // showAsItalic
            />
          );


        case 'image_ref':
          return (
            <ContentPartImageRef
              key={fragment.fId}
              imageRefPart={fragment.part}
              fragmentId={fragment.fId}
              contentScaling={props.contentScaling}
              onFragmentDelete={/*isMonoFragment ? undefined :*/ props.onFragmentDelete}
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

        // This is the most frequent part by far, and can be broken down into sub-blocks
        case 'text':
          return (
            <ContentPartText_AutoBlocks
              key={fragment.fId}
              // ref={blocksRendererRef}
              textPartText={fragment.part.text}
              messageRole={props.messageRole}
              contentScaling={props.contentScaling}
              fitScreen={props.fitScreen}
              isMobile={props.isMobile}
              disableMarkdownText={props.disableMarkdownText}
              enhanceCodeBlocks={props.enhanceCodeBlocks}
              // renderTextDiff={textDiffs || undefined}
              showUnsafeHtml={props.showUnsafeHtml}
              optiAllowSubBlocksMemo={!!props.optiAllowSubBlocksMemo}
              onContextMenu={props.onContextMenu}
              onDoubleClick={props.onDoubleClick}
            />
          );

        case 'tool_invocation':
          return (
            <BlocksContainer key={fragment.fId}>
              {fragment.part.invocation.type === 'function_call' ? (
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
                  <div>{fragment.part.id}</div>
                  <div>Name</div>
                  <div>{fragment.part.invocation.name}</div>
                  <div>Args</div>
                  <div>{fragment.part.invocation.args/*?.replaceAll('{', '').replaceAll('}', '').replaceAll('","', '", "')*/}</div>
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
                  <div>{fragment.part.id}</div>
                  <div>Language</div>
                  <div>{fragment.part.invocation.language}</div>
                  <div>Code</div>
                  <div style={{ whiteSpace: 'pre' }}>{fragment.part.invocation.code?.trim()}</div>
                  <div>Author</div>
                  <div>{fragment.part.invocation.author}</div>
                </Sheet>
              )}
            </BlocksContainer>
          );

        case 'tool_response':
          return (
            <BlocksContainer key={fragment.fId}>
              {fragment.part.response.type === 'function_call' ? (
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
                  <div>{fragment.part.id}</div>
                  <div>Error</div>
                  <div>{fragment.part.error === null ? 'null' : fragment.part.error === 'false' ? '' : fragment.part.error}</div>
                  <div>Name</div>
                  <div style={{ fontWeight: 700 }}>{fragment.part.response.name}</div>
                  <div>Result</div>
                  <div style={{ fontWeight: 700 }}>{fragment.part.response.result}</div>
                  <div>Environment</div>
                  <div>{fragment.part.environment}</div>
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
                  <div>{fragment.part.id}</div>
                  <div>Error</div>
                  <div>{fragment.part.error === null ? 'null' : fragment.part.error === 'false' ? '' : fragment.part.error}</div>
                  <div>Result</div>
                  <div style={{ fontWeight: 700 }}>{fragment.part.response.result}</div>
                  <div>Executor</div>
                  <div>{fragment.part.response.executor}</div>
                  <div>Environment</div>
                  <div>{fragment.part.environment}</div>
                </Sheet>
              )}
            </BlocksContainer>
          );

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
