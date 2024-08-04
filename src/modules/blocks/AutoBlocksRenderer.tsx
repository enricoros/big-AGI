import * as React from 'react';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { ContentScaling } from '~/common/app.theme';

import type { Block, CodeBlock, HtmlBlock, ImageBlock, TextBlock } from './blocks.types';
import { BlocksContainer } from './BlocksContainers';
import { RenderHtmlResponse } from './html/RenderHtmlResponse';
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


function areBlocksEqual(a: Block, b: Block): boolean {
  if (a.type !== b.type)
    return false;

  switch (a.type) {
    case 'codeb':
      return a.blockTitle === (b as CodeBlock).blockTitle && a.blockCode === (b as CodeBlock).blockCode && a.complete === (b as CodeBlock).complete;
    case 'diffb':
      return false; // diff blocks are never equal
    case 'htmlb':
      return a.html === (b as HtmlBlock).html;
    case 'imageb':
      return a.url === (b as ImageBlock).url && a.alt === (b as ImageBlock).alt;
    case 'textb':
      return a.content === (b as TextBlock).content;
  }
}


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

  renderAsCodeTitle?: string;
  renderTextAsMarkdown: boolean;
  renderTextDiff?: TextDiff[];

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
  const prevBlocksRef = React.useRef<Block[]>([]);

  // derived state
  const { text: _text, renderTextDiff } = props;
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
    const newBlocks: Block[] =
      props.renderAsCodeTitle ? [{ type: 'codeb', blockTitle: props.renderAsCodeTitle, blockCode: text, complete: true }]
        : fromSystem ? [{ type: 'textb', content: text }]
          : (renderTextDiff && renderTextDiff.length >= 1) ? [{ type: 'diffb', textDiffs: renderTextDiff }]
            : parseBlocksFromText(text);

    // recycle the previous blocks if they are the same, for stable references to React
    const recycledBlocks: Block[] = [];
    for (let i = 0; i < newBlocks.length; i++) {
      const newBlock = newBlocks[i];
      const prevBlock: Block | undefined = prevBlocksRef.current[i];

      // Check if the new block can be replaced by the previous block to maintain reference stability
      if (prevBlock && areBlocksEqual(prevBlock, newBlock)) {
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
      ? recycledBlocks.filter(block => block.type === 'codeb' || recycledBlocks.length === 1)
      : recycledBlocks;
  }, [fromSystem, props.renderAsCodeTitle, props.specialDiagramMode, renderTextDiff, text]);


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
      {autoBlocksMemo.map((block, index) => {
        // Optimization: only memo the non-currently-rendered components, if the message is still in flux
        const optimizeSubBlockWithMemo = props.optiAllowSubBlocksMemo === true && index < (autoBlocksMemo.length - 1);
        const RenderCodeMemoOrNot = renderCodeMemoOrNot(optimizeSubBlockWithMemo);
        const RenderMarkdownMemoOrNot = optimizeSubBlockWithMemo ? RenderMarkdownMemo : RenderMarkdown;
        return block.type === 'htmlb' ? <RenderHtmlResponse key={'html-' + index} htmlBlock={block} sx={scaledCodeSx} />
          : block.type === 'codeb' ? <RenderCodeMemoOrNot key={'code-' + index} codeBlock={block} fitScreen={props.fitScreen} initialShowHTML={props.showUnsafeHtml} noCopyButton={props.specialDiagramMode} optimizeLightweight={optimizeSubBlockWithMemo} sx={scaledCodeSx} />
            : block.type === 'imageb' ? <RenderImageURL key={'image-' + index} imageURL={block.url} expandableText={block.alt} onImageRegenerate={undefined /* we'd need to have selective fragment editing as there could be many of these URL images in a fragment */} scaledImageSx={scaledImageSx} variant='content-part' />
              : block.type === 'diffb' ? <RenderTextDiff key={'text-diff-' + index} textDiffBlock={block} sx={scaledTypographySx} />
                : (props.renderTextAsMarkdown && !fromSystem && !isUserCommand)
                  ? <RenderMarkdownMemoOrNot key={'text-md-' + index} textBlock={block} sx={scaledTypographySx} />
                  : <RenderPlainChatText key={'text-' + index} textBlock={block} sx={scaledTypographySx} />;
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
