import * as React from 'react';

import { Box } from '@mui/joy';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { useRenderDecay } from '~/common/render-decay/RenderDecayZone';

import { BLOCK_CODE_MERMAID_TITLE, BLOCK_CODE_PLANTUML_TITLE, BLOCK_CODE_SVG_TITLE, RenderCodeMemo } from './code/RenderCode';
import { BlocksContainer } from './BlocksContainers';
import { EnhancedRenderCodeMemo } from './enhanced-code/EnhancedRenderCode';
import { RenderImageURL } from './image/RenderImageURL';
import { RenderMarkdownMemo } from './markdown/RenderMarkdown';
import { RenderPlainText } from './plaintext/RenderPlainText';
import { RenderWordsDiff, WordsDiff } from './wordsdiff/RenderWordsDiff';
import { ToggleExpansionButton } from './ToggleExpansionButton';
import { heuristicIsBlockPureHTML, RenderDangerousHtml } from './danger-html/RenderDangerousHtml';
import { useAutoBlocksMemoSemiStable, useHeightCollapser } from './blocks.hooks';
import { useScaledCodeSx, useScaledImageSx, useScaledTypographySx, useToggleExpansionButtonSx } from './blocks.styles';


// configuration
const DEFER_MARKDOWN_PREPROCESS = true; // set to false to render LaTeX inline formulas as they come in, not at the end of the message
// import '~/common/util/forceTouchToDoubleClick'; // Future: Mac trackpad: force press → double-click


const _styles = {
  collapsible: {
    // takes the grid slot of BlocksContainer: same width, and minWidth 0 so wide code scrolls inside instead of widening the grid
    width: '100%',
    minWidth: 0,
  },
} as const;


// To get to the 'ref' version (which doesn't seem to be used anymore, and was used to isolate the source of the bubble bar):
// export const AutoBlocksRenderer = React.forwardRef<HTMLDivElement, BlocksRendererProps>((props, ref) => {
// AutoBlocksRenderer.displayName = 'AutoBlocksRenderer';

export type AutoBlocksCodeRenderVariant = 'outlined' | 'embedded-plain' | 'enhanced';

export type AutoBlocksHtmlRenderVariant = 'show-code' | 'render-at-end' | 'render';

/**
 * Features: collapse/expand, auto-detects HTML, SVG, Code, etc..
 * Used by (and more):
 * - BlockPartText_AutoBlocks - the main text blocks in ChatMessage > ContentFragments > *
 * - DocAttachmentFragmentPane - when not editing and with a switch to show text/fenced (which could be rendered)
 * - DiagramsModal - for the diagram blocks
 */
export function AutoBlocksRenderer(props: {
  // required
  text: string;
  fromRole: DMessageRole;

  contentScaling: ContentScaling;
  fitScreen: boolean;
  isMobile: boolean;

  showAsDanger?: boolean;
  showAsItalic?: boolean;

  blocksProcessor?: 'diagram',
  inputAsCodeWithTitle?: string;
  inputAsWordsDiff?: WordsDiff;

  codeRenderVariant?: AutoBlocksCodeRenderVariant /* default: outlined */,
  htmlRenderVariant?: AutoBlocksHtmlRenderVariant /* default: show-code */,
  textRenderVariant: 'markdown' | 'text',

  /** disables the height collapse of long user text - e.g. print/export trees and document panes render in full */
  disableTextCollapser?: boolean;

  /** The text is still being appended to: render its last block in streaming mode. */
  inFlux?: boolean;

  onDoubleClick?: (event: React.MouseEvent) => void;

  /**
   * If defined, this will replace the Fragment text with the new one.
   */
  setText?: (newText: string) => void;

}) {

  // props-derived state
  const fromAssistant = props.fromRole === 'assistant';
  const fromSystem = props.fromRole === 'system';
  const fromUser = props.fromRole === 'user';
  // const isUserCommand = fromUser && props.text.startsWith('/'); // disabled, the heuristic is so poor

  // state
  const isPureHTML = heuristicIsBlockPureHTML(props.text);
  const fixUserHtmlPaste = fromUser && isPureHTML;
  const collapseUserText = fromUser && !fixUserHtmlPaste && !props.disableTextCollapser;
  const { contentRef, clipSx, isCollapsed, showToggle, handleToggleExpansion } = useHeightCollapser(collapseUserText, props.contentScaling);
  const { text } = props;
  const autoBlocksStable = useAutoBlocksMemoSemiStable(
    text,
    props.inputAsCodeWithTitle || (fixUserHtmlPaste ? 'HTML' : undefined),
    fromSystem,
    props.inputAsWordsDiff,
    props.blocksProcessor === 'diagram',
  );

  // render decay: while in flux this is a live stream of the enclosing zone; the in-flux block reports its parse cost,
  // and renders lighter once the zone is over budget
  const { active: decayActive, onParseCost: decayOnParseCost } = useRenderDecay(props.inFlux === true);

  // handlers
  const { setText } = props;

  // Perf: stabilize text alteration callbacks. During streaming, `text` changes every packet, and we don't want to
  // re-render completed non-last Code/Markdown blocks.
  const curTextRef = React.useRef(text);
  curTextRef.current = text;

  const handleReplaceCode = React.useCallback((search: string, replace: string): boolean => {
    if (setText) {
      const text = curTextRef.current;
      const newText = text.replace(search, replace);
      if (newText !== text) {
        setText(newText);
        return true;
      }
    }
    return false;
  }, [setText]);


  // Memo the styles, to minimize re-renders
  const scaledCodeSx = useScaledCodeSx(fromAssistant, props.contentScaling, props.codeRenderVariant || 'outlined');
  const scaledImageSx = useScaledImageSx(props.contentScaling);
  const scaledTypographySx = useScaledTypographySx(props.contentScaling, !!props.showAsDanger, !!props.showAsItalic);
  const toggleExpansionButtonSx = useToggleExpansionButtonSx(props.contentScaling, props.codeRenderVariant || 'outlined');


  const blocksContainer = (
    <BlocksContainer
      ref={contentRef /* measured by the height collapser, when enabled */}
      // data-edit-intent={props.onDoubleClick ? true : undefined /* Future: Mac Force Touch */}
      onDoubleClick={props.onDoubleClick}
    >

      {/* sequence of render components, for each Block */}
      {autoBlocksStable.map((bkInput, index) => {

        // Optimization: Code being written won't get tooltips or snap to page
        const lastBlockInFlux = props.inFlux === true && index === (autoBlocksStable.length - 1);
        // Optimization: disable the markdown preprocessor on the last block, only do it at the end not while in progress
        const deferPreprocessor = DEFER_MARKDOWN_PREPROCESS && lastBlockInFlux;

        switch (bkInput.bkt) {

          case 'md-bk':
            return (props.textRenderVariant === 'text' || fromSystem /*|| isUserCommand*/) ? (
              // Keep in sync with ScaledPlainTextRenderer
              <RenderPlainText
                key={'txt-bk-' + index}
                content={bkInput.content}
                renderHighlightCommands={index === 0}
                sx={scaledTypographySx}
              />
            ) : (
              // Keep in sync with ScaledMarkdownRenderer
              <RenderMarkdownMemo
                key={'md-bk-' + index}
                content={bkInput.content}
                disablePreprocessor={deferPreprocessor}
                lite={lastBlockInFlux && decayActive}
                onParseCost={lastBlockInFlux ? decayOnParseCost : undefined}
                replaceContent={!setText ? undefined : handleReplaceCode}
                sx={scaledTypographySx}
              />
            );

          case 'code-bk':
            // Keep the component type stable across fence closure, completion and resume.
            // Content controls the frame, while the renderer keeps its DOM, iframe and toggles.
            const lowerCaseTitle = bkInput.title.toLowerCase();
            const isDiagram = lowerCaseTitle === BLOCK_CODE_MERMAID_TITLE || lowerCaseTitle === BLOCK_CODE_PLANTUML_TITLE;
            const frameless = isDiagram
              ? !bkInput.isPartial // diagrams: framed and collapsed while written, bare once they render
              : (bkInput.isPartial && lastBlockInFlux) || (!bkInput.title && bkInput.lines <= 3) || lowerCaseTitle === BLOCK_CODE_SVG_TITLE;
            const startCollapsed = (isDiagram && bkInput.isPartial) || fixUserHtmlPaste;

            return props.codeRenderVariant === 'enhanced' ? (
              <EnhancedRenderCodeMemo
                // EnhancedRenderCode props
                frameless={frameless}
                contentScaling={props.contentScaling}
                initialIsCollapsed={startCollapsed}
                isMobile={props.isMobile}
                noApplyButton={props.blocksProcessor === 'diagram' || fromUser}
                // RenderCode pass through
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial}
                fitScreen={props.fitScreen}
                initialRenderHTML={props.htmlRenderVariant === 'render' || (props.htmlRenderVariant === 'render-at-end' && !bkInput.isPartial)}
                noCopyButton={props.blocksProcessor === 'diagram'}
                optimizeLightweight={lastBlockInFlux}
                onReplaceInCode={!setText ? undefined : handleReplaceCode}
                codeSx={scaledCodeSx}
              />
            ) : (
              <RenderCodeMemo
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial}
                fitScreen={props.fitScreen}
                initialRenderHTML={props.htmlRenderVariant === 'render' || (props.htmlRenderVariant === 'render-at-end' && !bkInput.isPartial)}
                noCopyButton={props.blocksProcessor === 'diagram'}
                optimizeLightweight={lastBlockInFlux}
                onReplaceInCode={!setText ? undefined : handleReplaceCode}
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
              <RenderWordsDiff
                key={'txt-diffs-bk-' + index}
                wordsDiff={bkInput.wordsDiff}
                sx={scaledTypographySx}
              />
            );
        }
      })}

    </BlocksContainer>
  );

  if (!collapseUserText)
    return blocksContainer;

  // long user text: clipped by height, with the toggle outside the clip; stable structure, so measuring never remounts blocks
  return (
    <Box sx={_styles.collapsible}>
      <Box sx={clipSx}>
        {blocksContainer}
      </Box>
      {showToggle && (
        <ToggleExpansionButton
          color={props.codeRenderVariant === 'embedded-plain' ? 'neutral' : undefined}
          isCollapsed={isCollapsed}
          onToggle={handleToggleExpansion}
          sx={toggleExpansionButtonSx}
        />
      )}
    </Box>
  );
}
