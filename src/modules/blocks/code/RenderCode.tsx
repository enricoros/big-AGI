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
import { RenderCodeHtmlIFrame } from './RenderCodeHtmlIFrame';
import { RenderCodeMermaid } from './RenderCodeMermaid';
import { RenderCodePlantUML, usePlantUmlSvg } from './RenderCodePlantUML';
import { RenderCodeSVG } from './RenderCodeSVG';
import { RenderCodeSyntax } from './RenderCodeSyntax';
import { heuristicIsBlockTextHTML } from '../html/RenderHtmlResponse';


// style for line-numbers
import './RenderCode.css';
import { OverlayButton, overlayButtonsActiveSx, overlayButtonsClassName, overlayButtonsSx } from '~/modules/blocks/OverlayButton';


interface RenderCodeBaseProps {
  codeBlock: CodeBlock,
  fitScreen?: boolean,
  initialShowHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,
  sx?: SxProps,
}

interface RenderCodeImplProps extends RenderCodeBaseProps {
  highlightCode: (inferredCodeLanguage: string | null, blockCode: string, addLineNumbers: boolean) => string,
  inferCodeLanguage: (blockTitle: string, code: string) => string | null,
}

function RenderCodeImpl(props: RenderCodeImplProps) {

  // state
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

  // heuristics for specialized rendering

  const isHTML = heuristicIsBlockTextHTML(blockCode);
  const renderHTML = isHTML && showHTML;

  const isMermaid = blockTitle === 'mermaid' && blockComplete;
  const renderMermaid = isMermaid && showMermaid;

  const isPlantUML =
    (blockCode.startsWith('@startuml') && blockCode.endsWith('@enduml'))
    || (blockCode.startsWith('@startmindmap') && blockCode.endsWith('@endmindmap'))
    || (blockCode.startsWith('@startsalt') && blockCode.endsWith('@endsalt'))
    || (blockCode.startsWith('@startwbs') && blockCode.endsWith('@endwbs'))
    || (blockCode.startsWith('@startgantt') && blockCode.endsWith('@endgantt'));

  let renderPlantUML = isPlantUML && showPlantUML;
  const { data: plantUmlSvgData, error: plantUmlError } = usePlantUmlSvg(renderPlantUML, blockCode);
  renderPlantUML = renderPlantUML && (!!plantUmlSvgData || !!plantUmlError);

  const isSVG = (blockCode.startsWith('<svg') || blockCode.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')) && blockCode.endsWith('</svg>');
  const renderSVG = isSVG && showSVG;
  const canScaleSVG = renderSVG && blockCode.includes('viewBox="');

  const renderCode = !renderHTML && !renderMermaid && !renderPlantUML && !renderSVG;


  const cannotRenderLineNumbers = !renderCode || showSoftWrap;
  const renderLineNumbers = showLineNumbers && !cannotRenderLineNumbers;

  // heuristic for language, and syntax highlight
  const { highlightedCode, inferredCodeLanguage } = React.useMemo(() => {
    const inferredCodeLanguage = inferCodeLanguage(blockTitle, blockCode);
    const highlightedCode = highlightCode(inferredCodeLanguage, blockCode, renderLineNumbers);
    return { highlightedCode, inferredCodeLanguage };
  }, [inferCodeLanguage, blockTitle, blockCode, highlightCode, renderLineNumbers]);


  const canCodePen = blockComplete && isCodePenSupported(inferredCodeLanguage, isSVG);
  const canJSFiddle = blockComplete && isJSFiddleSupported(inferredCodeLanguage, blockCode);
  const canStackBlitz = blockComplete && isStackBlitzSupported(inferredCodeLanguage);


  let showBlockTitle = (blockTitle != inferredCodeLanguage) && (blockTitle.includes('.') || blockTitle.includes('://'));
  // hide the block title when rendering HTML
  if (renderHTML)
    showBlockTitle = false;
  const isBorderless = (renderHTML || renderSVG) && !showBlockTitle;


  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(blockCode, 'Code');
  };

  return (
    <Box
      component='code'
      className={`language-${inferredCodeLanguage || 'unknown'}${renderLineNumbers ? ' line-numbers' : ''}`}
      sx={{
        // position the overlay buttons
        position: 'relative',

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

      {/* Overlay Buttons */}
      <Box className={overlayButtonsClassName} sx={overlayButtonsSx}>

        {/* Show HTML */}
        {isHTML && (
          <Tooltip title={optimizeLightweight ? null : renderHTML ? 'Hide' : 'Show Web Page'}>
            <OverlayButton variant={renderHTML ? 'solid' : 'outlined'} color='danger' onClick={() => setShowHTML(!showHTML)}>
              <HtmlIcon sx={{ fontSize: 'xl2' }} />
            </OverlayButton>
          </Tooltip>
        )}

        {/* Show SVG */}
        {isSVG && (
          <Tooltip title={optimizeLightweight ? null : renderSVG ? 'Show Code' : 'Render SVG'}>
            <OverlayButton variant={renderSVG ? 'solid' : 'outlined'} onClick={() => setShowSVG(!showSVG)}>
              <ChangeHistoryTwoToneIcon />
            </OverlayButton>
          </Tooltip>
        )}

        {/* Show Diagrams */}
        {(isMermaid || isPlantUML) && (
          <ButtonGroup aria-label='Diagram'>
            {/* Toggle rendering */}
            <Tooltip title={optimizeLightweight ? null : (renderMermaid || renderPlantUML) ? 'Show Code' : 'Render Mermaid'}>
              <OverlayButton variant={(renderMermaid || renderPlantUML) ? 'solid' : 'outlined'} onClick={() => {
                if (isMermaid) setShowMermaid(on => !on);
                if (isPlantUML) setShowPlantUML(on => !on);
              }}>
                <SchemaIcon />
              </OverlayButton>
            </Tooltip>

            {/* Fit-To-Screen */}
            {((isMermaid && showMermaid) || (isPlantUML && showPlantUML && !plantUmlError) || (isSVG && showSVG && canScaleSVG)) && (
              <Tooltip title={optimizeLightweight ? null : fitScreen ? 'Original Size' : 'Fit Screen'}>
                <OverlayButton variant={fitScreen ? 'solid' : 'outlined'} onClick={() => setFitScreen(on => !on)}>
                  <FitScreenIcon />
                </OverlayButton>
              </Tooltip>
            )}
          </ButtonGroup>
        )}

        {/* New Code Window Buttons */}
        {(canJSFiddle || canCodePen || canStackBlitz) && (
          <ButtonGroup aria-label='Open code in external editors'>
            {canJSFiddle && <ButtonJsFiddle code={blockCode} language={inferredCodeLanguage!} />}
            {canCodePen && <ButtonCodePen code={blockCode} language={inferredCodeLanguage!} />}
            {canStackBlitz && <ButtonStackBlitz code={blockCode} title={blockTitle} language={inferredCodeLanguage!} />}
          </ButtonGroup>
        )}

        <ButtonGroup aria-label='Text Options'>
          {/* Soft Wrap toggle */}
          {renderCode && (
            <Tooltip title={optimizeLightweight ? null : 'Toggle Soft Wrap'}>
              <OverlayButton disabled={!renderCode} variant={(showSoftWrap && renderCode) ? 'solid' : 'outlined'} onClick={() => setShowSoftWrap(!showSoftWrap)}>
                <WrapTextIcon />
              </OverlayButton>
            </Tooltip>
          )}

          {/* Line Numbers toggle */}
          {renderCode && (
            <Tooltip title={optimizeLightweight ? null : 'Toggle Line Numbers'}>
              <OverlayButton disabled={cannotRenderLineNumbers} variant={(renderLineNumbers && renderCode) ? 'solid' : 'outlined'} onClick={() => setShowLineNumbers(!showLineNumbers)}>
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
  );
}

// Dynamically import the heavy prism functions
const DynamicPrism = React.lazy(async () => {

  // Dynamically import the code highlight functions
  const { highlightCode, inferCodeLanguage } = await import('./codePrism');

  return {
    default: (props: RenderCodeBaseProps) =>
      <RenderCodeImpl highlightCode={highlightCode} inferCodeLanguage={inferCodeLanguage} {...props} />,
  };
});

export function RenderCode(props: RenderCodeBaseProps) {
  return (
    <React.Suspense fallback={<Box component='code' sx={{ p: 1.5, display: 'block', ...props.sx }} />}>
      <DynamicPrism {...props} />
    </React.Suspense>
  );
}

export const RenderCodeMemo = React.memo(RenderCode);
