import * as React from 'react';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';

import { BlocksContainer } from './BlocksContainers';
import { EnhancedRenderCode } from './enhanced-code/EnhancedRenderCode';
import { RenderDangerousHtml } from './danger-html/RenderDangerousHtml';
import { RenderImageURL } from './image/RenderImageURL';
import { RenderMarkdown, RenderMarkdownMemo } from './markdown/RenderMarkdown';
import { RenderPlainText } from './plaintext/RenderPlainText';
import { RenderWordsDiff, WordsDiff } from './wordsdiff/RenderWordsDiff';
import { ToggleExpansionButton } from './ToggleExpansionButton';
import { renderCodeMemoOrNot } from './code/RenderCode';
import { useAutoBlocksMemoSemiStable, useTextCollapser } from './blocks.hooks';
import { useScaledCodeSx, useScaledImageSx, useScaledTypographySx, useToggleExpansionButtonSx } from './blocks.styles';


// configuration
const DISABLE_MARKDOWN_PROGRESSIVE_PREPROCESS = true; // set to false to render LaTeX inline formulas as they come in, not at the end of the message
const STREAMING_TAIL_MAX_HIDDEN_CHARS = 280; // safety: stop hiding the post-newline tail if it grows past this (~2 classic tweets)
// import '~/common/util/forceTouchToDoubleClick'; // Future: Mac trackpad: force press → double-click


// To get to the 'ref' version (which doesn't seem to be used anymore, and was used to isolate the source of the bubble bar):
// export const AutoBlocksRenderer = React.forwardRef<HTMLDivElement, BlocksRendererProps>((props, ref) => {
// AutoBlocksRenderer.displayName = 'AutoBlocksRenderer';

export type AutoBlocksCodeRenderVariant = 'outlined' | 'plain' | 'enhanced';

/**
 * Features: collpase/expand, auto-detects HTML, SVG, Code, etc..
 * Used by (and more):
 * - DocAttachmentFragmentEditor
 * - ContentPartPlaceholder
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
  showUnsafeHtmlCode?: boolean;

  renderAsCodeWithTitle?: string;
  renderAsWordsDiff?: WordsDiff;

  blocksProcessor?: 'diagram',
  codeRenderVariant?: AutoBlocksCodeRenderVariant /* default: outlined */,
  textRenderVariant: 'markdown' | 'text',

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

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;

  /**
   * If defined, this is a function that will replace the first occurrence of
   * the search string with the replace string.
   */
  setText?: (newText: string) => void;

}) {

  // props-derived state
  const fromAssistant = props.fromRole === 'assistant';
  const fromSystem = props.fromRole === 'system';
  const fromUser = props.fromRole === 'user';
  const isUserCommand = fromUser && props.text.startsWith('/');

  // state
  const { text, isTextCollapsed, forceTextExpanded, handleToggleExpansion } =
    useTextCollapser(props.text, fromUser);
  const autoBlocksStable = useAutoBlocksMemoSemiStable(
    text,
    props.renderAsCodeWithTitle,
    fromSystem,
    props.renderAsWordsDiff,
    props.blocksProcessor === 'diagram',
  );

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
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
    >

      {/* sequence of render components, for each Block */}
      {autoBlocksStable.map((bkInput, index) => {

        // Optimization: only memo the non-currently-rendered components, if the message is still in flux
        const optimizeMemoBeforeLastBlock = props.optiAllowSubBlocksMemo === true && index < (autoBlocksStable.length - 1);
        // Optimization: Code being written won't get tooltips or snap to page
        const optimizeLightweightLastBlock = props.optiAllowSubBlocksMemo === true && index === (autoBlocksStable.length - 1);
        // Optimization: disable the markdown preprocessor on the last block, only do it at the end not while in progress
        const optimizeDisableProcessorsOnLast = DISABLE_MARKDOWN_PROGRESSIVE_PREPROCESS && props.optiAllowSubBlocksMemo === true && index === (autoBlocksStable.length - 1);

        switch (bkInput.bkt) {

          case 'md-bk':
            const RenderMarkdownMemoOrNot = optimizeMemoBeforeLastBlock ? RenderMarkdownMemo : RenderMarkdown;
            // streaming smoothness: parse up to last newline only (tail reappears on next newline; full on completion)
            let mdContent = bkInput.content;
            if (props.optiStreamingLastFragment && index === (autoBlocksStable.length - 1)) {
              const lastNewline = bkInput.content.lastIndexOf('\n');
              if (lastNewline >= 0 && bkInput.content.length - lastNewline - 1 < STREAMING_TAIL_MAX_HIDDEN_CHARS)
                mdContent = bkInput.content.slice(0, lastNewline + 1);
            }
            return (props.textRenderVariant === 'text' || fromSystem || isUserCommand) ? (
              // Keep in sync with ScaledPlainTextRenderer
              <RenderPlainText
                key={'txt-bk-' + index}
                content={bkInput.content}
                sx={scaledTypographySx}
              />
            ) : (
              // Keep in sync with ScaledMarkdownRenderer
              <RenderMarkdownMemoOrNot
                key={'md-bk-' + index}
                content={mdContent}
                disablePreprocessor={optimizeDisableProcessorsOnLast}
                sx={scaledTypographySx}
              />
            );

          case 'code-bk':
            // NOTE: 2024-09-24: Just memo the code all the time to prevent state loss on the last block when it switches to complete
            // const RenderCodeMemoOrNot = renderCodeMemoOrNot(true /* optimizeMemoBeforeLastBlock */);
            // NOTE: 2024-09-24/2: Keep it for now, as the issue seems to be on the upstream ChatMessage
            const RenderCodeMemoOrNot = renderCodeMemoOrNot(optimizeMemoBeforeLastBlock);

            // Custom handling for some of our blocks
            const disableBecauseInProgress = bkInput.isPartial && props.optiAllowSubBlocksMemo === true;
            const disableBecauseTooShort = !bkInput.title && bkInput.lines <= 3;
            let disableEnhancedRender = disableBecauseInProgress || disableBecauseTooShort;
            let enhancedStartCollapsed = false;

            return (props.codeRenderVariant === 'enhanced' && !disableEnhancedRender) ? (
              <EnhancedRenderCode
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial || isTextCollapsed}
                contentScaling={props.contentScaling}
                fitScreen={props.fitScreen}
                isMobile={props.isMobile}
                initialShowHTML={props.showUnsafeHtmlCode}
                initialIsCollapsed={enhancedStartCollapsed}
                noCopyButton={props.blocksProcessor === 'diagram' || isTextCollapsed}
                optimizeLightweight={optimizeLightweightLastBlock}
                onReplaceInCode={(!setText || isTextCollapsed) ? undefined : handleReplaceCode}
                codeSx={scaledCodeSx}
              />
            ) : (
              <RenderCodeMemoOrNot
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial || isTextCollapsed}
                fitScreen={props.fitScreen}
                initialShowHTML={props.showUnsafeHtmlCode /* && !bkInput.isPartial NOTE: with this, it would be only auto-rendered at the end, preventing broken renders */}
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
          color={props.codeRenderVariant === 'plain' ? 'neutral' : undefined}
          isCollapsed={isTextCollapsed}
          onToggle={handleToggleExpansion}
          sx={toggleExpansionButtonSx}
        />
      )}

    </BlocksContainer>
  );
}