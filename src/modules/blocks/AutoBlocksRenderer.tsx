import * as React from 'react';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { useRenderDecay } from '~/common/render-decay/RenderDecayZone';

import { BLOCK_CODE_MERMAID_TITLE, BLOCK_CODE_PLANTUML_TITLE, BLOCK_CODE_SVG_TITLE, RenderCodeMemo } from './code/RenderCode';
import { BlocksContainer } from './BlocksContainers';
import { EnhancedRenderCode } from './enhanced-code/EnhancedRenderCode';
import { RenderImageURL } from './image/RenderImageURL';
import { RenderMarkdownMemo } from './markdown/RenderMarkdown';
import { RenderPlainText } from './plaintext/RenderPlainText';
import { RenderWordsDiff, WordsDiff } from './wordsdiff/RenderWordsDiff';
import { ToggleExpansionButton } from './ToggleExpansionButton';
import { heuristicIsBlockPureHTML, RenderDangerousHtml } from './danger-html/RenderDangerousHtml';
import { useAutoBlocksMemoSemiStable, useTextCollapser } from './blocks.hooks';
import { useScaledCodeSx, useScaledImageSx, useScaledTypographySx, useToggleExpansionButtonSx } from './blocks.styles';


// configuration
const DISABLE_MARKDOWN_PROGRESSIVE_PREPROCESS = true; // set to false to render LaTeX inline formulas as they come in, not at the end of the message
const STREAMING_TAIL_MAX_HIDDEN_CHARS = 280; // safety: stop hiding the post-newline tail if it grows past this (~2 classic tweets)
// import '~/common/util/forceTouchToDoubleClick'; // Future: Mac trackpad: force press → double-click


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

  /** disables the >8 lines user-text collapser - e.g. print/export trees must render in full */
  disableTextCollapser?: boolean;

  /**
   * optimization: allow memo to all individual blocks except the last one
   * work in progress on that
   */
  optiAllowSubBlocksMemo?: boolean;

  /**
   * optimization: streaming + last content fragment: clip last md block to last newline
   * to avoid inline-markdown flicker
   */
  optiStreamingLastFragment?: boolean;

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
  const collapseUserText = fromUser && !fixUserHtmlPaste && !props.disableTextCollapser; // probably less important now that we have ERCs with collapse, may even get in the way
  const { text, isTextCollapsed, forceTextExpanded, handleToggleExpansion } = useTextCollapser(props.text, collapseUserText);
  const autoBlocksStable = useAutoBlocksMemoSemiStable(
    text,
    props.inputAsCodeWithTitle || (fixUserHtmlPaste ? 'HTML' : undefined),
    fromSystem,
    props.inputAsWordsDiff,
    props.blocksProcessor === 'diagram',
  );

  // render decay: while in flux this is a live stream of the enclosing zone; the in-flux block reports its parse cost,
  // and renders lighter once the zone is over budget
  const { active: decayActive, onParseCost: decayOnParseCost } = useRenderDecay(props.optiAllowSubBlocksMemo === true);

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


  return (
    <BlocksContainer
      // ref={ref /* this will assign the ref, now not needed anymore */}
      // data-edit-intent={props.onDoubleClick ? true : undefined /* Future: Mac Force Touch */}
      onDoubleClick={props.onDoubleClick}
    >

      {/* sequence of render components, for each Block */}
      {autoBlocksStable.map((bkInput, index) => {

        // Optimization: Code being written won't get tooltips or snap to page
        const optimizeLightweightLastBlock = props.optiAllowSubBlocksMemo === true && index === (autoBlocksStable.length - 1);
        // Optimization: disable the markdown preprocessor on the last block, only do it at the end not while in progress
        const optimizeDisableProcessorsOnLast = DISABLE_MARKDOWN_PROGRESSIVE_PREPROCESS && props.optiAllowSubBlocksMemo === true && index === (autoBlocksStable.length - 1);

        switch (bkInput.bkt) {

          case 'md-bk':
            // streaming smoothness: parse up to last newline only (tail reappears on next newline; full on completion)
            let mdContent = bkInput.content;
            if (props.optiStreamingLastFragment && index === (autoBlocksStable.length - 1)) {
              const lastNewline = bkInput.content.lastIndexOf('\n');
              if (lastNewline >= 0 && bkInput.content.length - lastNewline - 1 < STREAMING_TAIL_MAX_HIDDEN_CHARS)
                mdContent = bkInput.content.slice(0, lastNewline + 1);
            }
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
                content={mdContent}
                disablePreprocessor={optimizeDisableProcessorsOnLast}
                lite={optimizeLightweightLastBlock && decayActive}
                onParseCost={optimizeLightweightLastBlock ? decayOnParseCost : undefined}
                replaceContent={(!setText || isTextCollapsed /* IMPORTANT: do not allow replacing text if collapsed - will chop! */) ? undefined : handleReplaceCode}
                sx={scaledTypographySx}
              />
            );

          case 'code-bk':
            // Custom handling for some of our blocks
            const disableBecauseInProgress = bkInput.isPartial && props.optiAllowSubBlocksMemo === true;
            const disableBecauseTooShort = !bkInput.title && bkInput.lines <= 3;
            let disableEnhancedRender = disableBecauseInProgress || disableBecauseTooShort;
            let enhancedStartCollapsed = false;

            // Pre-collapsing of special blocks
            let lowerCaseTitle = bkInput.title.toLowerCase();
            switch (lowerCaseTitle) {

              // start as a collapsed ERC, then remove the border and go normal
              case BLOCK_CODE_MERMAID_TITLE:
              case BLOCK_CODE_PLANTUML_TITLE:
                disableEnhancedRender = !bkInput.isPartial;
                // un-collapses when the fence closes: the block switches from Enhanced to plain RenderCode
                enhancedStartCollapsed = bkInput.isPartial;
                break;

              // do never ERC
              case BLOCK_CODE_SVG_TITLE:
                disableEnhancedRender = true;
                break;
            }

            // Pre-collapsing of user pasted HTML
            if (fixUserHtmlPaste) {
              // disableEnhancedRender = false;
              enhancedStartCollapsed = true;
            }

            return (props.codeRenderVariant === 'enhanced' && !disableEnhancedRender) ? (
              <EnhancedRenderCode
                // EnhancedRenderCode props
                contentScaling={props.contentScaling}
                initialIsCollapsed={enhancedStartCollapsed}
                isMobile={props.isMobile}
                noApplyButton={props.blocksProcessor === 'diagram' || fromUser}
                // RenderCode pass through
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial || isTextCollapsed}
                fitScreen={props.fitScreen}
                initialRenderHTML={props.htmlRenderVariant === 'render' || (props.htmlRenderVariant === 'render-at-end' && !bkInput.isPartial)}
                noCopyButton={props.blocksProcessor === 'diagram' || isTextCollapsed}
                optimizeLightweight={optimizeLightweightLastBlock}
                onReplaceInCode={(!setText || isTextCollapsed) ? undefined : handleReplaceCode}
                codeSx={scaledCodeSx}
              />
            ) : (
              <RenderCodeMemo
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial || isTextCollapsed}
                fitScreen={props.fitScreen}
                initialRenderHTML={props.htmlRenderVariant === 'render' || (props.htmlRenderVariant === 'render-at-end' && !bkInput.isPartial)}
                noCopyButton={props.blocksProcessor === 'diagram' || isTextCollapsed}
                optimizeLightweight={optimizeLightweightLastBlock}
                onReplaceInCode={(!setText || isTextCollapsed) ? undefined : handleReplaceCode}
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

      {(isTextCollapsed || forceTextExpanded) && (
        <ToggleExpansionButton
          color={props.codeRenderVariant === 'embedded-plain' ? 'neutral' : undefined}
          isCollapsed={isTextCollapsed}
          onToggle={handleToggleExpansion}
          sx={toggleExpansionButtonSx}
        />
      )}

    </BlocksContainer>
  );
}