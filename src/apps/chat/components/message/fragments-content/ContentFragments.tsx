import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';
import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import type { InterleavedFragment } from '~/common/stores/chat/hooks/useFragmentBuckets';
import { DMessageContentFragment, DMessageFragmentId, isTextContentFragment, isTextPart, isVoidPlaceholderFragment } from '~/common/stores/chat/chat.fragments';
import { Release } from '~/common/app.release';

import type { ChatMessageTextPartEditState } from '../ChatMessage';
import { BlockEdit_TextFragment } from './BlockEdit_TextFragment';
import { BlockOpEmpty } from './BlockOpEmpty';
import { BlockPartError } from './BlockPartError';
import { BlockPartImageRef } from './BlockPartImageRef';
import { BlockPartModelAux } from '../fragments-void/BlockPartModelAux';
import { BlockPartPlaceholder } from '../fragments-void/BlockPartPlaceholder';
import { BlockPartText_AutoBlocks } from './BlockPartText_AutoBlocks';
import { BlockPartToolInvocation } from './BlockPartToolInvocation';
import { BlockPartToolResponse } from './BlockPartToolResponse';
import { humanReadableFunctionName } from './BlockPartToolInvocation.utils';


const _editLayoutSx: SxProps = {
  display: 'grid',
  gap: 1.5,     // see why we give more space on ChatMessage

  // horizontal separator between messages (second part+ and before)
  // '& > *:not(:first-of-type)': {
  //   borderTop: '1px solid',
  //   borderTopColor: 'background.level3',
  // },
};

const _startLayoutSx: SxProps = {
  ..._editLayoutSx,
  justifyContent: 'flex-start',
} as const;

const _endLayoutSx: SxProps = {
  ..._editLayoutSx,
  justifyContent: 'flex-end',
} as const;


export function ContentFragments(props: {

  contentFragments: InterleavedFragment[]
  showEmptyNotice: boolean,

  contentScaling: ContentScaling,
  uiComplexityMode: UIComplexityMode,
  fitScreen: boolean,
  isMobile: boolean,
  messageRole: DMessageRole,
  messagePendingIncomplete?: boolean,
  messageGeneratorLlmId?: string | null,
  optiAllowSubBlocksMemo?: boolean,
  disableMarkdownText: boolean,
  enhanceCodeBlocks: boolean,
  showUnsafeHtmlCode?: boolean,

  textEditsState: ChatMessageTextPartEditState | null,
  setEditedText?: (fragmentId: DMessageFragmentId, value: string, applyNow: boolean) => void,
  onEditsApply: (withControl: boolean) => void,
  onEditsCancel: () => void,

  onFragmentAddBlank?: () => void,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
  onMessageDelete?: () => void,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  const isEmpty = !props.contentFragments.length;
  const fromAssistant = props.messageRole === 'assistant';
  const fromUser = props.messageRole === 'user';
  const isEditingText = !!props.textEditsState;
  const enableRestartFromEdit = !fromAssistant && props.messageRole !== 'system';


  // solo placeholder - dataStreamViz trigger
  const showDataStreamViz =
    !Release.Features.LIGHTER_ANIMATIONS
    && props.uiComplexityMode !== 'minimal'
    && props.contentFragments.length === 1
    // && props.noVoidFragments // not needed, we have all the interleaved fragments here
    && isVoidPlaceholderFragment(props.contentFragments[0]);


  // Content Fragments Edit Zero-State: button to create a new TextContentFragment
  if (isEditingText && !props.contentFragments.some(isTextContentFragment))
    return !props.onFragmentAddBlank ? null : (
      <Button aria-label='message body empty' variant='plain' color='neutral' onClick={props.onFragmentAddBlank} sx={{ justifyContent: 'flex-start' }}>
        add text ...
      </Button>
    );

  // when editing text, don't show the empty notice
  if (props.showEmptyNotice && isEditingText)
    return null;

  // if no fragments, don't box them
  if (!props.showEmptyNotice && isEmpty)
    return null;

  return <Box aria-label='message body' sx={(showDataStreamViz || isEditingText) ? _editLayoutSx : fromAssistant ? _startLayoutSx : _endLayoutSx}>

    {/* Empty Message Block - if empty */}
    {props.showEmptyNotice && (
      <BlockOpEmpty
        text={`empty ${fromAssistant ? 'model ' : fromUser ? 'user ' : ''}message`}
        contentScaling={props.contentScaling}
        onDelete={props.onMessageDelete}
      />
    )}

    {props.contentFragments.map((fragment, fragmentIndex) => {

      // simplify
      const { fId, ft } = fragment;

      // VOID FRAGMENTS (reasoning, placeholders - interleaved with content)
      if (ft === 'void') {
        const { part } = fragment;
        switch (part.pt) {

          // Handled by VoidFragments
          // case 'annotations':
          //   console.warn('[DEV] ContentFragments: annotations fragment found in interleaved list');
          //   return null;

          case 'ma':
            return (
              <BlockPartModelAux
                key={fId}
                fragmentId={fId}
                auxType={part.aType}
                auxText={part.aText}
                auxHasSignature={part.textSignature !== undefined}
                auxRedactedDataCount={part.redactedData?.length ?? 0}
                messagePendingIncomplete={!!props.messagePendingIncomplete}
                zenMode={props.uiComplexityMode === 'minimal'}
                contentScaling={props.contentScaling}
                isLastFragment={fragmentIndex === props.contentFragments.length - 1}
                onFragmentDelete={props.onFragmentDelete}
                onFragmentReplace={props.onFragmentReplace}
              />
            );

          case 'ph':
            return (
              <BlockPartPlaceholder
                key={fId}
                placeholderText={part.pText}
                placeholderType={part.pType}
                placeholderModelOp={part.modelOp}
                placeholderAixControl={part.aixControl}
                messageRole={props.messageRole}
                contentScaling={props.contentScaling}
                showAsItalic
                showAsDataStreamViz={showDataStreamViz}
              />
            );

          case '_pt_sentinel':
            return null;

          default:
            const _exhaustiveVoidCheck: never = part;
          // fallthrough - we don't handle these here anymore
          case 'annotations':
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
      }

      // CONTENT FRAGMENTS (text, code, tool calls, images, errors)
      const { part } = fragment;

      // editing for text parts, tool invocations, or tool responses
      if (props.textEditsState && !!props.setEditedText && (
        isTextPart(part) || part.pt === 'error' || part.pt === 'tool_invocation' || part.pt === 'tool_response'
      )) {

        // Determine the text to edit based on the part type
        let editText = '';
        let editLabel;
        if (isTextPart(part)) {
          editText = part.text;
        } else if (part.pt === 'error') {
          editText = part.error;
        } else if (part.pt === 'tool_invocation') {
          if (part.invocation.type === 'function_call') {
            editText = part.invocation.args /* string | null */ || '';
            const humanName = humanReadableFunctionName(part.invocation.name, 'function_call', 'invocation');
            editLabel = `[Invocation] ${humanName} · \`${part.invocation.name}\``;
          } else {
            editText = part.invocation.code;
            const humanName = humanReadableFunctionName('code_execution', 'code_execution', 'invocation');
            editLabel = `[Invocation] ${humanName} · \`${part.invocation.language}\``;
          }
        } else if (part.pt === 'tool_response') {
          if (!part.error) {
            editText = part.response.result;
            const responseName = part.response.type === 'function_call' ? part.response.name : 'code_execution';
            const humanName = humanReadableFunctionName(responseName, part.response.type, 'response');
            editLabel = `[Response] ${humanName} · \`${part.id}\``;
          }
        }

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
              errorHint={part.hint}
              messageRole={props.messageRole}
              messageGeneratorLlmId={props.messageGeneratorLlmId}
              contentScaling={props.contentScaling}
            />
          );

        case 'reference':
          let errorMessage: string;
          const rt = part.rt;
          switch (rt) {
            case 'zync':
              const zt = part.zType;
              switch (zt) {
                case 'asset':
                  // TODO: [ASSET] future: implement rendering for the real Reference to Zync Asset
                  if (part._legacyImageRefPart?.pt === 'image_ref')
                    return (
                      <BlockPartImageRef
                        key={fId}
                        imageRefPart={part._legacyImageRefPart}
                        fragmentId={fId}
                        contentScaling={props.contentScaling}
                        onFragmentDelete={props.onFragmentDelete}
                        onFragmentReplace={props.onFragmentReplace}
                      />
                    );
                  errorMessage = `[DEV] ContentFragment: Asset System not implemented (zync asset ${part.zUuid})`;
                  break;

                default:
                  const _exhaustiveCheck: never = zt;
                  errorMessage = `[DEV] ContentFragment: unsupported zync reference type (${zt})`;
              }
              break;

            case '_sentinel':
              errorMessage = `[DEV] ContentFragment: sentinel reference type (_sentinel)`;
              break;

            default:
              const _exhaustiveCheck: never = rt;
              errorMessage = `[DEV] ContentFragment: unsupported reference type (${rt})`;
          }
          return (
            <BlockPartError
              key={fId}
              errorText={errorMessage}
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
              onFragmentDelete={props.onFragmentDelete}
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
          return null;

        default:
          // noinspection JSUnusedLocalSymbols
          const _exhaustiveContentFragmentCheck: never = part;
          return (
            <ScaledTextBlockRenderer
              key={fId}
              text={`Unknown Content Fragment: ${(part as any)?.pt}`}
              contentScaling={props.contentScaling}
              textRenderVariant='text'
              showAsDanger
            />
          );
      }
    }).filter(Boolean)}
  </Box>;
}
