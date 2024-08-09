import * as React from 'react';
import type { Diff as SanityTextDiff } from '@sanity/diff-match-patch';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import { BlocksContainer } from './BlocksContainers';
import { RenderBlockInputs } from './blocks.types';
import { RenderDangerousHtml } from './danger-html/RenderDangerousHtml';
import { RenderImageURL } from './image/RenderImageURL';
import { RenderMarkdown, RenderMarkdownMemo } from './markdown/RenderMarkdown';
import { RenderPlainChatText } from './plaintext/RenderPlainChatText';
import { RenderTextDiff } from './textdiff/RenderTextDiff';
import { ToggleExpansionButton } from './ToggleExpansionButton';
import { parseBlocksFromText } from './blocks.textparser';
import { renderCodeMemoOrNot } from './code/RenderCode';
import { useScaledCodeSx, useScaledImageSx, useScaledTypographySx, useToggleExpansionButtonSx } from './blocks.styles';


// How long is the user collapsed message
const USER_COLLAPSED_LINES: number = 8;


type BlocksRendererProps = {
  // required
  text: string;
  fromRole: DMessageRole;

  contentScaling: ContentScaling;
  fitScreen?: boolean;
  showAsDanger?: boolean;
  showAsItalic?: boolean;
  showUnsafeHtml?: boolean;
  specialCodePlain?: boolean;
  specialDiagramMode?: boolean;

  renderAsCodeWithTitle?: string;
  renderTextAsMarkdown: boolean;
  renderSanityTextDiffs?: SanityTextDiff[];

  /**
   * optimization: allow memo to all individual blocks except the last one
   * work in progress on that
   */
  optiAllowSubBlocksMemo?: boolean;

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
};


/**
 * Features: collpase/expand, auto-detects HTML, SVG, Code, etc..
 * Used by (and more):
 * - DocAttachmentFragmentEditor
 * - ContentPartPlaceholder
 */
export const AutoBlocksRenderer = React.forwardRef<HTMLDivElement, BlocksRendererProps>((props, ref) => {

  // state
  const [forceUserExpanded, setForceUserExpanded] = React.useState(false);
  const prevBlocksRef = React.useRef<RenderBlockInputs>([]);

  // derived state
  const { text: _text, renderSanityTextDiffs } = props;
  const fromAssistant = props.fromRole === 'assistant';
  const fromSystem = props.fromRole === 'system';
  const fromUser = props.fromRole === 'user';
  const isUserCommand = fromUser && _text.startsWith('/');


  // Memo text, which could be 'collapsed' to a few lines in case of user messages

  const { text, isTextCollapsed } = React.useMemo(() => {
    if (fromUser && !forceUserExpanded) {
      const textLines = _text.split('\n');
      if (textLines.length > USER_COLLAPSED_LINES)
        return { text: textLines.slice(0, USER_COLLAPSED_LINES).join('\n'), isTextCollapsed: true };
    }
    return { text: _text, isTextCollapsed: false };
  }, [forceUserExpanded, fromUser, _text]);

  const handleToggleExpansion = React.useCallback(() => {
    setForceUserExpanded(on => !on);
  }, []);


  // Block splitter, with memo and special recycle of former blocks, to help React minimize render work

  const autoBlocksMemo = React.useMemo(() => {

    // follow outside direction, or activate the auto-splitter based on content
    const newBlocks: RenderBlockInputs = [];
    if (props.renderAsCodeWithTitle)
      newBlocks.push({ bkt: 'code-bk', title: props.renderAsCodeWithTitle, code: text, isPartial: false });
    else if (fromSystem)
      newBlocks.push({ bkt: 'md-bk', content: text });
    else if (renderSanityTextDiffs && renderSanityTextDiffs.length >= 1)
      newBlocks.push({ bkt: 'txt-diffs-bk', sanityTextDiffs: renderSanityTextDiffs });
    else
      newBlocks.push(...parseBlocksFromText(text));

    // recycle the previous blocks if they are the same, for stable references to React
    const recycledBlocks: RenderBlockInputs = [];
    for (let i = 0; i < newBlocks.length; i++) {
      const newBlock = newBlocks[i];
      const prevBlock = prevBlocksRef.current[i] ?? undefined;

      // Check if the new block can be replaced by the previous block to maintain reference stability
      if (prevBlock && shallowEquals(prevBlock, newBlock)) {
        recycledBlocks.push(prevBlock);
      } else {
        // Once a block doesn't match, we use the new blocks from this point forward.
        recycledBlocks.push(...newBlocks.slice(i));
        break;
      }
    }

    // Update prevBlocksRef with the current blocks for the next render
    prevBlocksRef.current = recycledBlocks;

    // Apply specialDiagramMode filter if applicable
    return props.specialDiagramMode
      ? recycledBlocks.filter(({ bkt }) => bkt === 'code-bk' || recycledBlocks.length === 1)
      : recycledBlocks;
  }, [fromSystem, props.renderAsCodeWithTitle, props.specialDiagramMode, renderSanityTextDiffs, text]);


  // Memo the styles, to minimize re-renders

  const scaledCodeSx = useScaledCodeSx(fromAssistant, props.contentScaling, !!props.specialCodePlain);
  const scaledImageSx = useScaledImageSx(props.contentScaling);
  const scaledTypographySx = useScaledTypographySx(props.contentScaling, !!props.showAsDanger, !!props.showAsItalic);
  const toggleExpansionButtonSx = useToggleExpansionButtonSx(props.contentScaling, !!props.specialCodePlain);


  return (
    <BlocksContainer
      ref={ref}
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
    >

      {/* sequence of render components, for each Block */}
      {autoBlocksMemo.map((bkInput, index) => {

        // Optimization: only memo the non-currently-rendered components, if the message is still in flux
        const optimizeMemoBeforeLastBlock = props.optiAllowSubBlocksMemo === true && index < (autoBlocksMemo.length - 1);

        switch (bkInput.bkt) {

          case 'md-bk':
            const RenderMarkdownMemoOrNot = optimizeMemoBeforeLastBlock ? RenderMarkdownMemo : RenderMarkdown;
            return (props.renderTextAsMarkdown && !fromSystem && !isUserCommand) ? (
              <RenderMarkdownMemoOrNot
                key={'md-bk-' + index}
                content={bkInput.content}
                sx={scaledTypographySx}
              />
            ) : (
              <RenderPlainChatText
                key={'txt-bk-' + index}
                content={bkInput.content}
                sx={scaledTypographySx}
              />
            );

          case 'code-bk':
            const RenderCodeMemoOrNot = renderCodeMemoOrNot(optimizeMemoBeforeLastBlock);
            return (
              <RenderCodeMemoOrNot
                key={'code-bk-' + index}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial}
                fitScreen={props.fitScreen}
                initialShowHTML={props.showUnsafeHtml}
                noCopyButton={props.specialDiagramMode}
                optimizeLightweight={optimizeMemoBeforeLastBlock}
                sx={scaledCodeSx}
              />
            );

          case 'dang-html-bk':
            return (
              <RenderDangerousHtml
                key={'dang-html-bk-' + index}
                html={bkInput.html}
                sx={scaledCodeSx}
              />
            );

          case 'img-url-bk':
            return (
              <RenderImageURL
                key={'img-url-bk-' + index}
                imageURL={bkInput.url}
                expandableText={bkInput.alt}
                onImageRegenerate={undefined /* we'd need to have selective fragment editing as there could be many of these URL images in a fragment */}
                scaledImageSx={scaledImageSx}
                variant='content-part'
              />
            );

          case 'txt-diffs-bk':
            return (
              <RenderTextDiff
                key={'txt-diffs-bk-' + index}
                sanityTextDiffs={bkInput.sanityTextDiffs}
                sx={scaledTypographySx}
              />
            );
        }
      })}

      {(isTextCollapsed || forceUserExpanded) && (
        <ToggleExpansionButton
          color={props.specialCodePlain ? 'neutral' : undefined}
          isCollapsed={isTextCollapsed}
          onToggle={handleToggleExpansion}
          sx={toggleExpansionButtonSx}
        />
      )}

    </BlocksContainer>
  );
});

AutoBlocksRenderer.displayName = 'AutoBlocksRenderer';