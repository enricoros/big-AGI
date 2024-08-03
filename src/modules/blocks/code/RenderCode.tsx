import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ButtonGroup, Sheet, Tooltip, Typography } from '@mui/joy';
import ChangeHistoryTwoToneIcon from '@mui/icons-material/ChangeHistoryTwoTone';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import HtmlIcon from '@mui/icons-material/Html';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import SchemaIcon from '@mui/icons-material/Schema';
import WrapTextIcon from '@mui/icons-material/WrapText';

import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import type { CodeBlock } from '../blocks.types';
import { ButtonCodePen, isCodePenSupported } from './ButtonCodePen';
import { ButtonJsFiddle, isJSFiddleSupported } from './ButtonJSFiddle';
import { ButtonStackBlitz, isStackBlitzSupported } from './ButtonStackBlitz';
import { OverlayButton, overlayButtonsActiveSx, overlayButtonsClassName, overlayButtonsSx } from '../OverlayButton';
import { RenderCodeHtmlIFrame } from './RenderCodeHtmlIFrame';
import { RenderCodeMermaid } from './RenderCodeMermaid';
import { RenderCodeSVG } from './RenderCodeSVG';
import { RenderCodeSyntax } from './RenderCodeSyntax';
import { heuristicIsBlockPlantUML, RenderCodePlantUML, usePlantUmlSvg } from './RenderCodePlantUML';
import { heuristicIsBlockPureHTML } from '../html/RenderHtmlResponse';


// style for line-numbers
import './RenderCode.css';


// RenderCode

export const renderCodeMemoOrNot = (memo: boolean) => memo ? RenderCodeMemo : RenderCode;

const RenderCodeMemo = React.memo(RenderCode);

interface RenderCodeBaseProps {
  codeBlock: CodeBlock,
  fitScreen?: boolean,
  initialShowHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,
  sx?: SxProps,
}

function RenderCode(props: RenderCodeBaseProps) {
  return (
    <React.Suspense fallback={<Box component='code' sx={{ p: 1.5, display: 'block', ...props.sx }} />}>
      <_DynamicPrism {...props} />
    </React.Suspense>
  );
}


// Lazy loader of the heavy prism functions
const _DynamicPrism = React.lazy(async () => {

  // Dynamically import the code highlight functions
  const { highlightCode, inferCodeLanguage } = await import('./codePrism');

  return {
    default: (props: RenderCodeBaseProps) => <RenderCodeImpl highlightCode={highlightCode} inferCodeLanguage={inferCodeLanguage} {...props} />,
  };
});


//

function RenderCodeImpl(props: RenderCodeBaseProps & {
  highlightCode: (inferredCodeLanguage: string | null, blockCode: string, addLineNumbers: boolean) => string,
  inferCodeLanguage: (blockTitle: string, code: string) => string | null,
}) {

  // state
  // const [isHovering, setIsHovering] = React.useState(false);
  const [fitScreen, setFitScreen] = React.useState(!!props.fitScreen);
  const [showHTML, setShowHTML] = React.useState(props.initialShowHTML === true);
  const [showMermaid, setShowMermaid] = React.useState(true);
  const [showPlantUML, setShowPlantUML] = React.useState(true);
  const [showSVG, setShowSVG] = React.useState(true);
  const { showLineNumbers, showSoftWrap, setShowLineNumbers, setShowSoftWrap } = useUIPreferencesStore(useShallow(state => ({
    showLineNumbers: state.renderCodeLineNumbers,
    showSoftWrap: state.renderCodeSoftWrap,
    setShowLineNumbers: state.setRenderCodeLineNumbers,
    setShowSoftWrap: state.setRenderCodeSoftWrap,
  })));

  // derived props
  const {
    codeBlock: { blockTitle, blockCode, complete: blockComplete },
    highlightCode, inferCodeLanguage,
    optimizeLightweight,
  } = props;


  // handlers

  const handleCopyToClipboard = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(blockCode, 'Code');
  }, [blockCode]);


  // heuristics for specialized rendering

  const isHTMLCode = heuristicIsBlockPureHTML(blockCode);
  const renderHTML = isHTMLCode && showHTML;

  const isMermaidCode = blockTitle === 'mermaid' && blockComplete;
  const renderMermaid = isMermaidCode && showMermaid;

  const isPlantUMLCode = heuristicIsBlockPlantUML(blockCode);
  let renderPlantUML = isPlantUMLCode && showPlantUML;
  const { data: plantUmlSvgData, error: plantUmlError } = usePlantUmlSvg(renderPlantUML, blockCode);
  renderPlantUML = renderPlantUML && (!!plantUmlSvgData || !!plantUmlError);

  const isSVGCode = (blockCode.startsWith('<svg') || blockCode.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')) && blockCode.endsWith('</svg>');
  const renderSVG = isSVGCode && showSVG;
  const canScaleSVG = renderSVG && blockCode.includes('viewBox="');

  const renderSyntaxHighlight = !renderHTML && !renderMermaid && !renderPlantUML && !renderSVG;


  const cannotRenderLineNumbers = !renderSyntaxHighlight || showSoftWrap;
  const renderLineNumbers = showLineNumbers && !cannotRenderLineNumbers;


  // Language & Highlight
  const { highlightedCode, inferredCodeLanguage } = React.useMemo(() => {
    const inferredCodeLanguage = inferCodeLanguage(blockTitle, blockCode);
    const highlightedCode = !renderSyntaxHighlight ? null : highlightCode(inferredCodeLanguage, blockCode, renderLineNumbers);
    return { highlightedCode, inferredCodeLanguage };
  }, [blockCode, blockTitle, highlightCode, inferCodeLanguage, renderLineNumbers, renderSyntaxHighlight]);

  // Title
  let showBlockTitle = (blockTitle != inferredCodeLanguage) && (blockTitle.includes('.') || blockTitle.includes('://'));
  // Beautify: hide the block title when rendering HTML
  if (renderHTML)
    showBlockTitle = false;
  const isBorderless = (renderHTML || renderSVG) && !showBlockTitle;


  const canCodePen = blockComplete && isCodePenSupported(inferredCodeLanguage, isSVGCode);
  const canJSFiddle = blockComplete && isJSFiddleSupported(inferredCodeLanguage, blockCode);
  const canStackBlitz = blockComplete && isStackBlitzSupported(inferredCodeLanguage);
  const canOpenExternally = canCodePen || canJSFiddle || canStackBlitz;


  return (
    <Box sx={{
      // position the overlay buttons - this has to be one level up from the code, otherwise the buttons will h-scroll with the code
      position: 'relative',
    }}>

      <Box
        component='code'
        // onMouseEnter={props.isMobile ? undefined : () => setIsHovering(true)}
        // onMouseLeave={props.isMobile ? undefined : () => setIsHovering(false)}
        className={`language-${inferredCodeLanguage || 'unknown'}${renderLineNumbers ? ' line-numbers' : ''}`}
        sx={{

          // style
          p: isBorderless ? 0 : 1.5, // this block gets a thicker border (but we 'fullscreen' html in case there's no title)
          overflowX: 'auto', // ensure per-block x-scrolling
          whiteSpace: showSoftWrap ? 'break-spaces' : 'pre',

          // layout
          display: 'flex',
          flexDirection: 'column',
          // justifyContent: (renderMermaid || renderPlantUML) ? 'center' : undefined,

          // fix for SVG diagrams over dark mode: https://github.com/enricoros/big-AGI/issues/520
          '[data-joy-color-scheme="dark"] &': (renderPlantUML || renderMermaid) ? { backgroundColor: 'neutral.500' } : {},

          // fade in children buttons
          [`&:hover > .${overlayButtonsClassName}`]: overlayButtonsActiveSx,

          // lots more style, incl font, background, embossing, radius, etc.
          ...props.sx,
        }}
      >

        {/* Markdown Title (File/Type) */}
        {showBlockTitle && (
          <Sheet sx={{ backgroundColor: 'background.popup', boxShadow: 'xs', borderRadius: 'sm', border: '1px solid var(--joy-palette-neutral-outlinedBorder)', m: -0.5, mb: 1.5 }}>
            <Typography level='body-sm' sx={{ px: 1, py: 0.5, color: 'text.primary' }}>
              {blockTitle}
              {/*{inferredCodeLanguage}*/}
            </Typography>
          </Sheet>
        )}

        {/* Renders HTML, or inline SVG, inline plantUML rendered, or highlighted code */}
        {renderHTML ? <RenderCodeHtmlIFrame htmlCode={blockCode} />
          : renderMermaid ? <RenderCodeMermaid mermaidCode={blockCode} fitScreen={fitScreen} />
            : renderSVG ? <RenderCodeSVG svgCode={blockCode} fitScreen={fitScreen} />
              : (renderPlantUML && plantUmlSvgData) ? <RenderCodePlantUML svgCode={plantUmlSvgData} error={plantUmlError} fitScreen={fitScreen} />
                : <RenderCodeSyntax highlightedSyntaxAsHtml={highlightedCode} />}


        {/* [overlay] Buttons (Code blocks (SVG, diagrams, HTML, syntax, ...)) */}
        <Box className={overlayButtonsClassName} sx={overlayButtonsSx}>

          {/* Show HTML */}
          {isHTMLCode && (
            <Tooltip title={optimizeLightweight ? null : renderHTML ? 'Hide' : 'Show Web Page'}>
              <OverlayButton variant={renderHTML ? 'solid' : 'outlined'} color='danger' onClick={() => setShowHTML(!showHTML)}>
                <HtmlIcon sx={{ fontSize: 'xl2' }} />
              </OverlayButton>
            </Tooltip>
          )}

          {/* Show SVG */}
          {isSVGCode && (
            <Tooltip title={optimizeLightweight ? null : renderSVG ? 'Show Code' : 'Render SVG'}>
              <OverlayButton variant={renderSVG ? 'solid' : 'outlined'} onClick={() => setShowSVG(!showSVG)}>
                <ChangeHistoryTwoToneIcon />
              </OverlayButton>
            </Tooltip>
          )}

          {/* Show Diagrams */}
          {(isMermaidCode || isPlantUMLCode) && (
            <ButtonGroup aria-label='Diagram'>
              {/* Toggle rendering */}
              <Tooltip title={optimizeLightweight ? null : (renderMermaid || renderPlantUML) ? 'Show Code' : 'Render Mermaid'}>
                <OverlayButton variant={(renderMermaid || renderPlantUML) ? 'solid' : 'outlined'} onClick={() => {
                  if (isMermaidCode) setShowMermaid(on => !on);
                  if (isPlantUMLCode) setShowPlantUML(on => !on);
                }}>
                  <SchemaIcon />
                </OverlayButton>
              </Tooltip>

              {/* Fit-To-Screen */}
              {((isMermaidCode && showMermaid) || (isPlantUMLCode && showPlantUML && !plantUmlError) || (isSVGCode && showSVG && canScaleSVG)) && (
                <Tooltip title={optimizeLightweight ? null : fitScreen ? 'Original Size' : 'Fit Screen'}>
                  <OverlayButton variant={fitScreen ? 'solid' : 'outlined'} onClick={() => setFitScreen(on => !on)}>
                    <FitScreenIcon />
                  </OverlayButton>
                </Tooltip>
              )}
            </ButtonGroup>
          )}

          {/* Group: Open Externally */}
          {canOpenExternally && (
            <ButtonGroup aria-label='Open code in external editors'>
              {canJSFiddle && <ButtonJsFiddle code={blockCode} language={inferredCodeLanguage!} />}
              {canCodePen && <ButtonCodePen code={blockCode} language={inferredCodeLanguage!} />}
              {canStackBlitz && <ButtonStackBlitz code={blockCode} title={blockTitle} language={inferredCodeLanguage!} />}
            </ButtonGroup>
          )}

          {/* Group: Text Options */}
          <ButtonGroup aria-label='Text Options'>
            {/* Soft Wrap toggle */}
            {renderSyntaxHighlight && (
              <Tooltip title={optimizeLightweight ? null : 'Toggle Soft Wrap'}>
                <OverlayButton disabled={!renderSyntaxHighlight} variant={(showSoftWrap && renderSyntaxHighlight) ? 'solid' : 'outlined'} onClick={() => setShowSoftWrap(!showSoftWrap)}>
                  <WrapTextIcon />
                </OverlayButton>
              </Tooltip>
            )}

            {/* Line Numbers toggle */}
            {renderSyntaxHighlight && (
              <Tooltip title={optimizeLightweight ? null : 'Toggle Line Numbers'}>
                <OverlayButton disabled={cannotRenderLineNumbers} variant={(renderLineNumbers && renderSyntaxHighlight) ? 'solid' : 'outlined'} onClick={() => setShowLineNumbers(!showLineNumbers)}>
                  <NumbersRoundedIcon />
                </OverlayButton>
              </Tooltip>
            )}

            {/* Copy */}
            {props.noCopyButton !== true && (
              <Tooltip title={optimizeLightweight ? null : 'Copy Code'}>
                <OverlayButton variant='outlined' onClick={handleCopyToClipboard}>
                  <ContentCopyIcon />
                </OverlayButton>
              </Tooltip>
            )}
          </ButtonGroup>
        </Box>

      </Box>
    </Box>
  );
}
