import * as React from 'react';
import type { Diff as SanityTextDiff } from '@sanity/diff-match-patch';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageRole } from '~/common/stores/chat/chat.message';

import { BLOCK_CODE_VND_AGI_CHARTJS, renderCodeMemoOrNot } from './code/RenderCode';
import { BlocksContainer } from './BlocksContainers';
import { EnhancedRenderCode } from './enhanced-code/EnhancedRenderCode';
import { RenderDangerousHtml } from './danger-html/RenderDangerousHtml';
import { RenderImageURL } from './image/RenderImageURL';
import { RenderMarkdown, RenderMarkdownMemo } from './markdown/RenderMarkdown';
import { RenderPlainText } from './plaintext/RenderPlainText';
import { RenderTextDiff } from './textdiff/RenderTextDiff';
import { ToggleExpansionButton } from './ToggleExpansionButton';
import { useAutoBlocksMemoSemiStable, useTextCollapser } from './blocks.hooks';
import { useScaledCodeSx, useScaledImageSx, useScaledTypographySx, useToggleExpansionButtonSx } from './blocks.styles';


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
  renderSanityTextDiffs?: SanityTextDiff[];

  blocksProcessor?: 'diagram',
  codeRenderVariant?: AutoBlocksCodeRenderVariant /* default: outlined */,
  textRenderVariant: 'markdown' | 'text',

  /**
   * optimization: allow memo to all individual blocks except the last one
   * work in progress on that
   */
  optiAllowSubBlocksMemo?: boolean;

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
  let autoBlocksStable =
    useAutoBlocksMemoSemiStable(text, props.renderAsCodeWithTitle, fromSystem, props.renderSanityTextDiffs);

  // handlers
  const { setText } = props;
  const handleReplaceCode = React.useCallback((search: string, replace: string): boolean => {
    if (setText) {
      const newText = text.replace(search, replace);
      if (newText !== text) {
        setText(newText);
        return true;
      }
    }
    return false;
  }, [setText, text]);


  // apply specialDiagramMode filter if applicable
  if (props.blocksProcessor === 'diagram')
    autoBlocksStable = autoBlocksStable.filter(({ bkt }) => bkt === 'code-bk' || autoBlocksStable.length === 1);


  // Memo the styles, to minimize re-renders
  const scaledCodeSx = useScaledCodeSx(fromAssistant, props.contentScaling, props.codeRenderVariant || 'outlined');
  const scaledImageSx = useScaledImageSx(props.contentScaling);
  const scaledTypographySx = useScaledTypographySx(props.contentScaling, !!props.showAsDanger, !!props.showAsItalic);
  const toggleExpansionButtonSx = useToggleExpansionButtonSx(props.contentScaling, props.codeRenderVariant || 'outlined');


  return (
    <BlocksContainer
      // ref={ref /* this will assign the ref, now not needed anymore */}
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
    >

      {/* sequence of render components, for each Block */}
      {autoBlocksStable.map((bkInput, index) => {

        // Optimization: only memo the non-currently-rendered components, if the message is still in flux
        const optimizeMemoBeforeLastBlock = props.optiAllowSubBlocksMemo === true && index < (autoBlocksStable.length - 1);

        switch (bkInput.bkt) {

          case 'md-bk':
            const RenderMarkdownMemoOrNot = optimizeMemoBeforeLastBlock ? RenderMarkdownMemo : RenderMarkdown;
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
                content={bkInput.content}
                sx={scaledTypographySx}
              />
            );

          case 'code-bk':
            // NOTE: 2024-09-24: Just memo the code all the time to prevent state loss on the last block when it switches to complete
            // const RenderCodeMemoOrNot = renderCodeMemoOrNot(true /* optimizeMemoBeforeLastBlock */);
            // NOTE: 2024-09-24/2: Keep it for now, as the issue seems to be on the upstream ChatMessage
            const RenderCodeMemoOrNot = renderCodeMemoOrNot(optimizeMemoBeforeLastBlock);

            // Custom handling for some of our blocks
            let disableEnhancedRender = bkInput.isPartial;
            let enhancedStartCollapsed = false;
            if (bkInput.title === BLOCK_CODE_VND_AGI_CHARTJS) {
              disableEnhancedRender = false;
              // For Chart.js charts, at the moment, we use the 'unwanted' refresh at the end of the message to start (that block) without collapse
              enhancedStartCollapsed = bkInput.isPartial;
            }

            return (props.codeRenderVariant === 'enhanced' && !disableEnhancedRender) ? (
              <EnhancedRenderCode
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial}
                contentScaling={props.contentScaling}
                fitScreen={props.fitScreen}
                isMobile={props.isMobile}
                initialShowHTML={props.showUnsafeHtmlCode}
                initialIsCollapsed={enhancedStartCollapsed}
                noCopyButton={props.blocksProcessor === 'diagram'}
                optimizeLightweight={optimizeMemoBeforeLastBlock}
                onReplaceInCode={setText ? handleReplaceCode : undefined}
                codeSx={scaledCodeSx}
              />
            ) : (
              <RenderCodeMemoOrNot
                key={'code-bk-' + index}
                semiStableId={bkInput.bkId}
                code={bkInput.code} title={bkInput.title} isPartial={bkInput.isPartial}
                fitScreen={props.fitScreen}
                initialShowHTML={props.showUnsafeHtmlCode /* && !bkInput.isPartial NOTE: with this, it would be only auto-rendered at the end, preventing broken renders */}
                noCopyButton={props.blocksProcessor === 'diagram'}
                optimizeLightweight={optimizeMemoBeforeLastBlock}
                onReplaceInCode={setText ? handleReplaceCode : undefined}
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