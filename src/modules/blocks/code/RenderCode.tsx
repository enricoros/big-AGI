import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ButtonGroup, Sheet, Typography } from '@mui/joy';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ChangeHistoryTwoToneIcon from '@mui/icons-material/ChangeHistoryTwoTone';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HtmlIcon from '@mui/icons-material/Html';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import PaletteIcon from '@mui/icons-material/Palette';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import SquareTwoToneIcon from '@mui/icons-material/SquareTwoTone';
import WrapTextIcon from '@mui/icons-material/WrapText';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';

import { copyBlobPromiseToClipboard, copyToClipboard } from '~/common/util/clipboardUtils';
import { downloadBlob } from '~/common/util/downloadUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';
import { useFullscreenElement } from '~/common/components/useFullscreenElement';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import type { IRenderHandle } from './code-renderers/IRenderHandle';
import { OVERLAY_BUTTON_RADIUS, OverlayButton, overlayButtonsActiveSx, overlayButtonsClassName, overlayButtonsTopRightSx, overlayGroupWithShadowSx } from '../OverlayButton';
import { RenderCodeHtmlIFrame } from './code-renderers/RenderCodeHtmlIFrame';
import { RenderCodeMarkdown } from './code-renderers/RenderCodeMarkdown';
import { RenderCodeMermaid } from './code-renderers/RenderCodeMermaid';
import { RenderCodeSyntax } from './code-renderers/RenderCodeSyntax';
import { heuristicIsBlockPureHTML } from '../danger-html/RenderDangerousHtml';
import { heuristicIsCodePlantUML, plantUMLCodeCycleTheme, plantUMLCodeToggleDirection, RenderCodePlantUML } from './code-renderers/RenderCodePlantUML';
import { heuristicIsSVGCode, RenderCodeSVG } from './code-renderers/RenderCodeSVG';
import { useERCDiffContext } from '../enhanced-code/ERCDiffContext';
import { useStickyCodeOverlay } from './useStickyCodeOverlay';

// style for line-numbers
import './RenderCode.css';


// configuration
const ALWAYS_SHOW_OVERLAY = true;
const BLOCK_CODE_ENABLE_COMPARISON = true; // TODO: make this opt-in (also, 'false' does not disable the hooks)
export const BLOCK_CODE_MERMAID_TITLE = 'mermaid';
export const BLOCK_CODE_PLANTUML_TITLE = 'plantuml';
export const BLOCK_CODE_SVG_TITLE = 'svg';

const CONTEXT_HIGHLIGHT_START = '__AGI_MARK_START__' as const;
const CONTEXT_HIGHLIGHT_END = '__AGI_MARK_END__' as const;

// Perf: while streaming a large code block, throttle Prism re-highlighting (decimator ~15Hz -> capped here to ~7Hz).
// Set BYTES to 0 to disable the optimization entirely (zero runtime cost when disabled).
const PARTIAL_HIGHLIGHT_THROTTLE_BYTES = 8 * 1024;
const PARTIAL_HIGHLIGHT_THROTTLE_MS = 150;


// RenderCode

export const RenderCodeMemo = React.memo(RenderCode);

interface RenderCodeBaseProps {
  semiStableId: string | undefined,
  title: string,
  code: string,
  isPartial: boolean,
  fitScreen?: boolean,
  initialRenderHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean, // the block being written: throttle highlighting, no tooltips or sticky overlay
  onReattachAsFile?: (file: File) => void;
  onReplaceInCode?: (search: string, replace: string) => boolean;
  renderHideTitle?: boolean,
  sx?: SxProps,
}

function RenderCode(props: RenderCodeBaseProps) {
  return (
    <React.Suspense
      fallback={
        // Mimic the structure of the RenderCodeImpl - to mitigate race conditions that could cause problematic rendering
        // of code (where two components were missing from the structure)
        <Box sx={_styles.renderCodecontainer}>
          <Box component='code' className='language-unknown' aria-label='Displaying Code...' sx={{ p: 1.5, display: 'block', ...props.sx }}>
            <Box component='span' sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box component='span' className='code-container' aria-label='Code block'>
                {/* Just wait until the correct implementation renders */}
              </Box>
            </Box>
          </Box>
        </Box>
      }
    >
      <_DynamicPrism {...props} />
    </React.Suspense>
  );
}


// Lazy loader of the heavy prism functions
const _DynamicPrism = React.lazy(async () => {

  // Dynamically import the code highlight functions
  const { highlightCode, inferCodeLanguage } = await import('~/modules/blocks/code/code-highlight/codePrism');

  return {
    default: (props: RenderCodeBaseProps) => <RenderCodeImpl highlightCode={highlightCode} inferCodeLanguage={inferCodeLanguage} {...props} />,
  };
});


// Actual implemetation of the code rendering

const _styles = {
  renderCodecontainer: {
    // position the overlay buttons - this has to be one level up from the code, otherwise the buttons will h-scroll with the code
    position: 'relative',

    // style
    '--IconButton-radius': OVERLAY_BUTTON_RADIUS,

    // fade in children buttons
    [`&:hover > .${overlayButtonsClassName}`]: overlayButtonsActiveSx,
  },

  blockTitle: {
    backgroundColor: 'background.popup',
    boxShadow: 'xs',
    borderRadius: 'sm',
    border: '1px solid var(--joy-palette-neutral-outlinedBorder)',
    m: -0.5,
    mb: 1.5,
  },
  blockTitleText: {
    px: 1,
    py: 0.5,
    color: 'text.primary',
  },

  fullscreenSyntaxFix: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
} as const satisfies Record<string, SxProps>;

const overlayGridSx: SxProps = {
  ...overlayButtonsTopRightSx,
  display: 'grid',
  gap: 0.5,
  justifyItems: 'end',
};

const overlayFirstRowSx: SxProps = {
  display: 'flex',
  gap: 0.5,
};


// Give the memoized overlay JSX a named Profiler boundary without duplicating its inputs as props.
function RCOverlay(props: { children: React.ReactNode }) {
  return props.children;
}


// Keep deferred catch-up renders inside the syntax subtree. Prism itself remains synchronous.
const RCSyntaxHighlight = React.memo(function RCSyntaxHighlight(props: {
  code: string,
  inferredCodeLanguage: string | null,
  renderLineNumbers: boolean,
  presenterMode: boolean,
  performSymbolHighlight: string | null | undefined,
  highlightCode: (inferredCodeLanguage: string | null, code: string, addLineNumbers: boolean) => string,
}) {
  const { code, inferredCodeLanguage, renderLineNumbers, presenterMode, performSymbolHighlight, highlightCode } = props;
  const deferredCode = React.useDeferredValue(code);
  const codeSyntaxHtml = React.useMemo(() => {
    if (!deferredCode)
      return null;

    // check if the highlight is within domain conditions >= 3 chars, less than 1000 chars, and no newlines
    let codeHighlight = performSymbolHighlight?.trim();
    if (!codeHighlight || codeHighlight.length < 3 || codeHighlight.length > 1000 || codeHighlight.includes('\n'))
      return highlightCode(inferredCodeLanguage, deferredCode, renderLineNumbers);

    // 1. pre-process with enclosing tags to locate later
    let codeToProcess = deferredCode;
    try {
      codeToProcess = codeToProcess.replaceAll(codeHighlight, `${CONTEXT_HIGHLIGHT_START}${codeHighlight}${CONTEXT_HIGHLIGHT_END}`);
    } catch (e) {
      // console.warn('[DEV] Error during string replaceAll for highlighting:', e);
    }

    // 2. let Prism highlight the code (with placeholders inside, which shall be skipped because agnostic - hopefully)
    let prismOutputHtml = highlightCode(inferredCodeLanguage, codeToProcess, renderLineNumbers);

    // 3. post-process: replace markers with <mark> tags
    if (prismOutputHtml)
      prismOutputHtml = prismOutputHtml
        .replaceAll(CONTEXT_HIGHLIGHT_START, `<mark class='agi-highlight'>`)
        .replaceAll(CONTEXT_HIGHLIGHT_END, `</mark>`);

    return prismOutputHtml;
  }, [deferredCode, highlightCode, inferredCodeLanguage, performSymbolHighlight, renderLineNumbers]);

  return <RenderCodeSyntax highlightedSyntaxAsHtml={codeSyntaxHtml} presenterMode={presenterMode} />;
});


function RenderCodeImpl(props: RenderCodeBaseProps & {
  highlightCode: (inferredCodeLanguage: string | null, code: string, addLineNumbers: boolean) => string,
  inferCodeLanguage: (blockTitle: string, code: string) => string | null,
}) {

  // state
  // const [isHovering, setIsHovering] = React.useState(false);
  const [fitScreen, setFitScreen] = React.useState(!!props.fitScreen);
  const [htmlReloadKey, setHtmlReloadKey] = React.useState(0);
  const [showHTML, setShowHTML] = React.useState(props.initialRenderHTML === true);
  const [showMarkdown, setShowMarkdown] = React.useState(true);
  const [showMermaid, setShowMermaid] = React.useState(true);
  const [showPlantUML, setShowPlantUML] = React.useState(true);
  const [showSVG, setShowSVG] = React.useState(true);
  const renderHandleRef = React.useRef<IRenderHandle>(null);
  const fullScreenElementRef = React.useRef<HTMLDivElement>(null);

  // external state
  const diffContext = useERCDiffContext();
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreenElement(fullScreenElementRef);
  const { overlayRef, overlayBoundaryRef } = useStickyCodeOverlay({ disabled: props.optimizeLightweight || isFullscreen });

  // sticky overlay positioning
  const { devsUISymbolHighlight, uiComplexityMode, showLineNumbers, showSoftWrap, setRenderHTMLInitial, setShowLineNumbers, setShowSoftWrap } = useUIPreferencesStore(useShallow(state => ({
    devsUISymbolHighlight: state.devsUISymbolHighlight,
    uiComplexityMode: state.complexityMode,
    showLineNumbers: state.renderCodeLineNumbers,
    showSoftWrap: state.renderCodeSoftWrap,
    setRenderHTMLInitial: state.setRenderHTMLInitial,
    setShowLineNumbers: state.setRenderCodeLineNumbers,
    setShowSoftWrap: state.setRenderCodeSoftWrap,
  })));

  // derived props
  const {
    title: blockTitle,
    code,
    isPartial: blockIsPartial,
    highlightCode,
    inferCodeLanguage,
    onReattachAsFile,
    onReplaceInCode,
  } = props;

  const noTooltips = props.optimizeLightweight /*|| !isHovering*/;


  // handlers

  // const handleMouseOverEnter = React.useCallback(() => setIsHovering(true), []);

  // const handleMouseOverLeave = React.useCallback(() => setIsHovering(false), []);

  // Optimization: stabilize the copy handler
  const codeRef = React.useRef(code);
  codeRef.current = code;
  const handleCopyToClipboard = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(codeRef.current, 'Code');
  }, []);

  const handleHtmlRenderToggle = React.useCallback(() => {
    // persistently save this change, to be used as next initial values
    const nextState = !showHTML;
    setRenderHTMLInitial(nextState);
    setShowHTML(nextState);
  }, [setRenderHTMLInitial, showHTML]);


  const handleRenderHandleCopy = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    // Keep clipboard.write inside the click gesture for Safari; resolve the image through a promise.
    const renderBlob = async (): Promise<Blob> => {
      const render = await renderHandleRef.current?.renderAsPNGBlob(event.shiftKey);
      if (render) return render.blob;
      throw new Error(render === undefined ? 'Nothing to copy yet.' : 'Failed to generate image.');
    };
    const blobPromise = renderBlob();
    // The clipboard API can reject before consuming the image promise.
    void blobPromise.catch(() => undefined);
    void copyBlobPromiseToClipboard('image/png', blobPromise, `Image${event.shiftKey ? ' with transparent background' : ''}`)
      .catch((error: unknown) => alert(error instanceof Error ? error.message : 'Failed to copy image.'));
  }, []);

  const handleRenderHandleDownload = React.useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const render = await renderHandleRef.current?.renderAsPNGBlob(event.shiftKey);
      if (render) downloadBlob(render.blob, `${render.prefix}_${prettyTimestampForFilenames()}.png`);
      else if (render === undefined) alert('Nothing to download yet.');
      else alert('Failed to generate image.');
    } catch {
      alert('Failed to generate image.');
    }
  }, []);


  const handleRenderHandleReattach = React.useCallback(async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!renderHandleRef.current || !onReattachAsFile) return;
    renderHandleRef.current.renderAsPNGBlob(false)
      .then((render) => {
        if (!render) return alert('Failed to convert SVG to PNG.');
        const pngFile = new File([render.blob], 'svg-render.png', { type: render.blob.type || 'image/png' });
        onReattachAsFile(pngFile);
      })
      .catch(() => alert('Failed to convert SVG to PNG.'));
  }, [onReattachAsFile]);


  // comparison handlers

  // Compare uses current content without invalidating the overlay on each stream update.
  const comparisonRef = React.useRef({ diffContext, code, title: blockTitle });
  comparisonRef.current = { diffContext, code, title: blockTitle };
  const showCompareButton = BLOCK_CODE_ENABLE_COMPARISON && !!diffContext;
  const compareBaseSet = !!diffContext?.baseCode;
  const compareThisIsBase = diffContext?.baseCode === props.code;

  const handleCompareClicked = React.useCallback(() => {
    const { diffContext, code, title } = comparisonRef.current;
    if (!diffContext) return;
    if (!diffContext.baseCode) {
      // set this as the diff base
      diffContext.setBase(code, title || '(no title)');
      diffContext.setShowDiff(false); // just to be sure
    } else if (diffContext.baseCode === code) {
      // clear the diff base
      diffContext.setBase('', '');
      diffContext.setShowDiff(false);
    } else {
      // compare this with the diff base
      diffContext.setCompare(code, title || '(no title)');
      diffContext.setShowDiff(true);
    }
  }, []);


  // heuristics for specialized rendering

  const _tCode = code.trim();
  const lcBlockTitle = blockTitle.trim().toLowerCase();

  const isHTMLCode = heuristicIsBlockPureHTML(_tCode);
  const renderHTML = isHTMLCode && showHTML;

  // 'render-at-end' enables HTML at completion without updating state for other code blocks.
  const shouldAutoRenderHTML = isHTMLCode && props.initialRenderHTML === true;
  React.useEffect(() => {
    if (shouldAutoRenderHTML) setShowHTML(true);
  }, [shouldAutoRenderHTML]);

  const isMdCode = !blockIsPartial && (lcBlockTitle === 'md' || lcBlockTitle === 'markdown' || lcBlockTitle.endsWith('.md'));
  const renderMarkdown = isMdCode && showMarkdown;

  const isMermaidCode = lcBlockTitle === BLOCK_CODE_MERMAID_TITLE && !blockIsPartial;
  const renderMermaid = isMermaidCode && showMermaid;

  const isPlantUMLCode = heuristicIsCodePlantUML(_tCode);
  const renderPlantUML = isPlantUMLCode && showPlantUML;

  const isSVGCode = heuristicIsSVGCode(_tCode);
  const renderSVG = isSVGCode && showSVG;
  const canScaleSVG = renderSVG && _tCode.includes('viewBox="');

  const renderSyntaxHighlight = !renderHTML && !renderMarkdown && !renderMermaid && !renderPlantUML && !renderSVG;
  const cannotRenderLineNumbers = !renderSyntaxHighlight || showSoftWrap;
  const renderLineNumbers = !cannotRenderLineNumbers && ((showLineNumbers && uiComplexityMode !== 'minimal') || isFullscreen);


  // Language & Highlight (2-stages)
  const inferredCodeLanguage = React.useMemo(() => {
    // shortcut - this mimics a similar path in inferCodeLanguage
    if (isHTMLCode)
      return 'html';
    // workhorse - could be slow, hence the memo
    return inferCodeLanguage(blockTitle, code);
  }, [blockTitle, code, inferCodeLanguage, isHTMLCode]);


  // Optimization 1: highlight decimation: max 6.6Hz during large partial streams. Flush on stop, even with an unclosed fence.
  const snapRef = React.useRef({ at: 0, code });
  const throttle = !!PARTIAL_HIGHLIGHT_THROTTLE_BYTES && props.optimizeLightweight && blockIsPartial && code.length > PARTIAL_HIGHLIGHT_THROTTLE_BYTES;
  const now = throttle ? performance.now() : 0;
  if (!throttle || now - snapRef.current.at >= PARTIAL_HIGHLIGHT_THROTTLE_MS) {
    snapRef.current.at = now;
    snapRef.current.code = code;
  }
  const throttledCodeForHighlight = snapRef.current.code;

  const performSymbolHighlight = !devsUISymbolHighlight ? undefined : diffContext?.contextHighlightText;


  // Title
  let showBlockTitle = !props.renderHideTitle && (blockTitle != inferredCodeLanguage) && (blockTitle.includes('.') || blockTitle.includes('://'));
  // Beautify: hide the block title when rendering HTML
  if (renderHTML)
    showBlockTitle = false;
  const isBorderless = (renderHTML || renderSVG) && !showBlockTitle;


  // style

  const isRenderingDiagram = renderMermaid || renderPlantUML;

  const codeSx: SxProps = React.useMemo(() => ({

    // style
    p: isBorderless ? 0 : 1.5, // this block gets a thicker border (but we 'fullscreen' html in case there's no title)
    overflowX: 'auto', // ensure per-block x-scrolling
    whiteSpace: showSoftWrap ? 'break-spaces' : 'pre',

    // layout
    display: 'flex',
    flexDirection: 'column',
    // justifyContent: (renderMermaid || renderPlantUML) ? 'center' : undefined,

    // in fullscreen mode, amplify contrast
    ...isFullscreen && { backgroundColor: 'background.surface' },

    // fix for SVG diagrams over dark mode: https://github.com/enricoros/big-AGI/issues/520
    '[data-joy-color-scheme="dark"] &': isRenderingDiagram ? { backgroundColor: 'neutral.500' } : {},

    // lots more style, incl font, background, embossing, radius, etc.
    ...props.sx,

  }), [isBorderless, isFullscreen, isRenderingDiagram, props.sx, showSoftWrap]);


  // Keep the overlay stable across streamed code updates. Copy reads the latest code through codeRef.
  const showFitButton = (isMermaidCode && showMermaid) || (isPlantUMLCode && showPlantUML) || (isSVGCode && showSVG && canScaleSVG);
  const codeOverlay = React.useMemo(() => (<RCOverlay>
    <Box
      ref={overlayRef}
      className={overlayButtonsClassName}
      sx={overlayGridSx}
    >

      {/* [row 1] */}
      <Box sx={overlayFirstRowSx}>

        {/* Show HTML + Reload */}
        {isHTMLCode && (
          <ButtonGroup aria-label='HTML options' sx={overlayGroupWithShadowSx}>
            <OverlayButton tooltip={noTooltips ? null : renderHTML ? 'Show Code' : 'Show Web Page'} variant={renderHTML ? 'solid' : 'outlined'} color='danger' onClick={handleHtmlRenderToggle}>
              <HtmlIcon sx={{ fontSize: 'xl2' }} />
            </OverlayButton>
            {renderHTML && (
              <OverlayButton tooltip={noTooltips ? null : 'Reload'} variant='outlined' color='danger' onClick={() => setHtmlReloadKey(k => k + 1)}>
                <ReplayRoundedIcon />
              </OverlayButton>
            )}
          </ButtonGroup>
        )}

        {/* Show Markdown Preview */}
        {isMdCode && (
          <OverlayButton tooltip={noTooltips ? null : renderMarkdown ? 'Show Code' : 'Show Preview'} variant={renderMarkdown ? 'solid' : 'outlined'} smShadow onClick={() => setShowMarkdown(!showMarkdown)}>
            <DescriptionOutlinedIcon />
          </OverlayButton>
        )}

        {/* SVG, Mermaid, PlantUML -- including a max-out button */}
        {(isSVGCode || isMermaidCode || isPlantUMLCode) && (
          <ButtonGroup aria-label='Diagram' sx={overlayGroupWithShadowSx}>
            {/* Toggle rendering */}
            <OverlayButton
              tooltip={noTooltips ? null
                : (renderSVG || renderMermaid || renderPlantUML) ? 'Show Code'
                  : isSVGCode ? 'Render SVG'
                    : isMermaidCode ? 'Mermaid Diagram'
                      : 'PlantUML Diagram'
              }
              variant={(renderMermaid || renderPlantUML) ? 'solid' : 'outlined'}
              color={isSVGCode ? 'warning' : undefined}
              onClick={() => {
                if (isSVGCode) setShowSVG(on => !on);
                if (isMermaidCode) setShowMermaid(on => !on);
                if (isPlantUMLCode) setShowPlantUML(on => !on);
              }}>
              {isSVGCode ? <ChangeHistoryTwoToneIcon /> : <SquareTwoToneIcon />}
            </OverlayButton>

            {/* PlantUML code-changing buttons */}
            {(isPlantUMLCode && showPlantUML) && (
              <OverlayButton
                disabled={!onReplaceInCode}
                tooltip={noTooltips ? null : 'Switch Direction'}
                onClick={() => onReplaceInCode?.(codeRef.current, plantUMLCodeToggleDirection(codeRef.current))}
              >
                <RotateRightIcon />
              </OverlayButton>
            )}
            {(isPlantUMLCode && showPlantUML) && (
              <OverlayButton
                disabled={!onReplaceInCode}
                tooltip={noTooltips ? null : 'Cycle Theme'}
                onClick={() => onReplaceInCode?.(codeRef.current, plantUMLCodeCycleTheme(codeRef.current))}
              >
                <PaletteIcon />
              </OverlayButton>
            )}

            {/* Fit-Content */}
            {showFitButton && (
              <OverlayButton tooltip={noTooltips ? null : fitScreen ? 'Original Size' : 'Fit Content'} variant={fitScreen ? 'solid' : 'outlined'} onClick={() => setFitScreen(on => !on)}>
                <FitScreenIcon />
              </OverlayButton>
            )}
          </ButtonGroup>
        )}

        {/* Download / Copy Diagram PNG */}
        {props.noCopyButton !== true && (renderMermaid || renderPlantUML) && (
          <ButtonGroup color='neutral' aria-label='Image Actions' sx={overlayGroupWithShadowSx}>
            <OverlayButton
              tooltip={noTooltips ? null : 'Download transparent PNG'}
              tooltipProps={{ color: 'warning' }}
              onClick={handleRenderHandleDownload}
            >
              <FileDownloadOutlinedIcon />
            </OverlayButton>
            <OverlayButton
              tooltip={noTooltips ? null : 'Copy transparent PNG'}
              tooltipProps={{ color: 'warning' }}
              onClick={handleRenderHandleCopy}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            >
              <PhotoLibraryOutlinedIcon />
            </OverlayButton>
          </ButtonGroup>
        )}

        {/* Special Group: Reattach SVG */}
        {isSVGCode && !!props.onReattachAsFile && (
          <ButtonGroup color='neutral' aria-label='SVG Actions' sx={overlayGroupWithShadowSx}>
            <OverlayButton
              tooltip={noTooltips ? null : 'Attach as image'}
              onClick={handleRenderHandleReattach}
            >
              <AddPhotoAlternateIcon />
            </OverlayButton>
          </ButtonGroup>
        )}

        {/* Group: Text Options */}
        <ButtonGroup aria-label='Text and code options' sx={overlayGroupWithShadowSx}>

          {/* Fullscreen */}
          <OverlayButton tooltip={noTooltips ? null : isFullscreen ? 'Exit Fullscreen' : !renderSyntaxHighlight ? 'Fullscreen' : 'Present'} variant={isFullscreen ? 'solid' : 'outlined'} onClick={isFullscreen ? exitFullscreen : enterFullscreen}>
            <ZoomOutMapIcon sx={{ fontSize: 'xl' }} />
          </OverlayButton>

          {/* Soft Wrap toggle */}
          {renderSyntaxHighlight && (
            <OverlayButton tooltip={noTooltips ? null : 'Wrap Lines'} disabled={!renderSyntaxHighlight} variant={(showSoftWrap && renderSyntaxHighlight) ? 'solid' : 'outlined'} onClick={() => setShowSoftWrap(!showSoftWrap)}>
              <WrapTextIcon />
            </OverlayButton>
          )}

          {/* Line Numbers toggle */}
          {renderSyntaxHighlight && uiComplexityMode !== 'minimal' && (
            <OverlayButton tooltip={noTooltips ? null : 'Line Numbers'} disabled={cannotRenderLineNumbers} variant={(renderLineNumbers && renderSyntaxHighlight) ? 'solid' : 'outlined'} onClick={() => setShowLineNumbers(!showLineNumbers)}>
              <NumbersRoundedIcon />
            </OverlayButton>
          )}

          {/* Comparison button: single button to initiate comparison if no base is set, shows as solid if this is the base (instead of formerly having a clear comparison button), and shows as 'color=success' or outlined if clicking it will compare this against the base */}
          {showCompareButton && (
            <OverlayButton
              tooltip={noTooltips ? null :
                !compareBaseSet ? 'Compare this code'
                  : compareThisIsBase ? 'Cancel comparison'
                    : 'Compare with this code'
              }
              variant={!compareBaseSet ? 'outlined' : compareThisIsBase ? 'solid' : 'outlined'}
              color={!compareBaseSet ? undefined : 'warning'}
              onClick={handleCompareClicked}
            >
              <CompareArrowsIcon />
            </OverlayButton>
          )}

          {/* Copy */}
          {props.noCopyButton !== true && (
            <OverlayButton tooltip={noTooltips ? null : 'Copy Code'} variant='outlined' onClick={handleCopyToClipboard}>
              <ContentCopyIcon />
            </OverlayButton>
          )}
        </ButtonGroup>

      </Box>

    </Box></RCOverlay>
  ), [
    handleRenderHandleReattach, props.onReattachAsFile,
    compareBaseSet, compareThisIsBase, handleCompareClicked, showCompareButton,
    cannotRenderLineNumbers, enterFullscreen, exitFullscreen, fitScreen, handleCopyToClipboard, handleHtmlRenderToggle,
    handleRenderHandleCopy, handleRenderHandleDownload, onReplaceInCode, showPlantUML,
    isFullscreen, isHTMLCode, isMdCode, isMermaidCode, isPlantUMLCode, isSVGCode, noTooltips, overlayRef, props.noCopyButton,
    renderHTML, renderLineNumbers, renderMarkdown, renderMermaid, renderPlantUML, renderSVG, renderSyntaxHighlight,
    setShowLineNumbers, setShowSoftWrap, showFitButton, showLineNumbers, showMarkdown, showSoftWrap, uiComplexityMode,
  ]);


  return (
    <Box
      ref={overlayBoundaryRef}
      // onMouseEnter={handleMouseOverEnter}
      // onMouseLeave={handleMouseOverLeave}
      sx={_styles.renderCodecontainer}
    >

      <Box
        ref={fullScreenElementRef}
        component='code'
        className={`language-${inferredCodeLanguage || 'unknown'}${renderLineNumbers ? ' line-numbers' : ''}`}
        sx={codeSx}
      >

        {/* Markdown Title (File/Type) */}
        {showBlockTitle && (
          <Sheet sx={_styles.blockTitle}>
            <Typography level='body-sm' sx={_styles.blockTitleText} className='agi-ellipsize'>
              {blockTitle}
              {/*{inferredCodeLanguage}*/}
            </Typography>
          </Sheet>
        )}

        {/* NOTE: this 'div' is only here to avoid some sort of collapse of the RenderCodeSyntax,
            which box disappears for some reason and the parent flex layout ends up lining up
            chars in a non-proper way.
            Since this damages the 'fullscreen' operation, we restore it somehow.
        */}
        <span style={!isFullscreen ? undefined : _styles.fullscreenSyntaxFix}>
          {/* Renders HTML, or inline SVG, inline plantUML rendered, or highlighted code */}
          {renderHTML ? <RenderCodeHtmlIFrame key={htmlReloadKey} htmlCode={code} isFullscreen={isFullscreen} />
            : renderMarkdown ? <RenderCodeMarkdown mdCode={code} />
              : renderMermaid ? <RenderCodeMermaid ref={renderHandleRef} mermaidCode={code} fitScreen={fitScreen} onReplaceInCode={onReplaceInCode} />
                : renderSVG ? <RenderCodeSVG ref={renderHandleRef} svgCode={code} fitScreen={fitScreen} />
                  : renderPlantUML ? <RenderCodePlantUML ref={renderHandleRef} plantUMLCode={code} fitContainer={fitScreen} allowDetails={uiComplexityMode === 'extra'} onReplaceInCode={onReplaceInCode} />
                    : <RCSyntaxHighlight
                        code={throttledCodeForHighlight}
                        inferredCodeLanguage={inferredCodeLanguage}
                        renderLineNumbers={renderLineNumbers}
                        presenterMode={isFullscreen}
                        performSymbolHighlight={performSymbolHighlight}
                        highlightCode={highlightCode}
                      />}
        </span>

      </Box>

      {/* [overlay] Buttons (Code blocks (SVG, diagrams, HTML, syntax, ...)) */}
      {(ALWAYS_SHOW_OVERLAY /*|| isHovering*/) && codeOverlay}

    </Box>
  );
}
