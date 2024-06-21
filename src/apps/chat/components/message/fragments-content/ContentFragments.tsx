import * as React from 'react';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageContentFragment, DMessageFragment, DMessageFragmentId, DMessageRole } from '~/common/stores/chat/chat.message';

import type { ChatMessageTextContentEditState } from '../ChatMessage';
import { ContentPartImageRef } from './ContentPartImageRef';
import { ContentPartPlaceholder } from './ContentPartPlaceholder';
import { ContentPartText } from './ContentPartText';
import { ContentPartTextEdit } from './ContentPartTextEdit';


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

  textEditsState: ChatMessageTextContentEditState | null,
  setEditedText: (fragmentId: DMessageFragmentId, value: string) => void,
  onEditsApply: () => void,
  onEditsCancel: () => void,

  onFragmentDelete: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

}) {

  const isMonoFragment = props.fragments.length < 2;

  return props.fragments.map((fragment) => {

    // only proceed with DMessageContentFragment
    if (fragment.ft !== 'content')
      return null;

    switch (fragment.part.pt) {
      case 'text':
        return props.textEditsState ? (
          <ContentPartTextEdit
            key={'edit-' + fragment.fId}
            textPart={fragment.part}
            fragmentId={fragment.fId}
            contentScaling={props.contentScaling}
            editedText={props.textEditsState[fragment.fId]}
            setEditedText={props.setEditedText}
            onEnterPressed={props.onEditsApply}
            onEscapePressed={props.onEditsCancel}
          />
        ) : (
          <ContentPartText
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
            // showAsProgress
          />
        );

      case 'error':
        return (
          <ContentPartPlaceholder
            key={fragment.fId}
            placeholderText={fragment.part.error}
            messageRole={props.messageRole}
            contentScaling={props.contentScaling}
            showAsDanger
            showAsItalic
          />
        );

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
  }).filter(Boolean);
}
