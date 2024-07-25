import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Sheet } from '@mui/joy';

import { BlocksContainer } from '~/modules/blocks/BlocksContainer';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { DMessageContentFragment, DMessageFragment, DMessageFragmentId, isContentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { ContentPartImageRef } from './ContentPartImageRef';
import { ContentPartPlaceholder } from './ContentPartPlaceholder';
import { ContentPartTextAutoBlocks } from './ContentPartTextAutoBlocks';
import { ContentPartTextEditor } from './ContentPartTextEditor';


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

      // editing for text parts
      if (props.textEditsState && (isTextPart(fragment.part) || fragment.part.pt === 'error')) {
        return (
          <ContentPartTextEditor
            key={'edit-' + fragment.fId}
            textPartText={isTextPart(fragment.part) ? fragment.part.text : fragment.part.error}
            fragmentId={fragment.fId}
            contentScaling={props.contentScaling}
            editedText={props.textEditsState[fragment.fId]}
            setEditedText={props.setEditedText}
            onEnterPressed={props.onEditsApply}
            onEscapePressed={props.onEditsCancel}
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

        case 'text':
          return (
            <ContentPartTextAutoBlocks
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
