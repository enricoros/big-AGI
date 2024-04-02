import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ButtonGroup, IconButton, Sheet, Tooltip, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import HtmlIcon from '@mui/icons-material/Html';
import SchemaIcon from '@mui/icons-material/Schema';
import ShapeLineOutlinedIcon from '@mui/icons-material/ShapeLineOutlined';

import { copyToClipboard } from '~/common/util/clipboardUtils';
import { frontendSideFetch } from '~/common/util/clientFetchers';

import type { CodeBlock } from '../blocks';
import { ButtonCodePen, isCodePenSupported } from './ButtonCodePen';
import { ButtonJsFiddle, isJSFiddleSupported } from './ButtonJSFiddle';
import { ButtonStackBlitz, isStackBlitzSupported } from './ButtonStackBlitz';
import { heuristicIsHtml, IFrameComponent } from '../RenderHtml';
import { patchSvgString, RenderCodeMermaid } from './RenderCodeMermaid';

export function getPlantUmlServerUrl(): string {
  // set at nextjs build time
  return process.env.NEXT_PUBLIC_PLANTUML_SERVER_URL || 'https://www.plantuml.com/plantuml/svg/';
}

async function fetchPlantUmlSvg(plantUmlCode: string): Promise<string | null> {
  // Get the PlantUML server from inline env var
  let plantUmlServerUrl = getPlantUmlServerUrl();
  if (!plantUmlServerUrl.endsWith('/'))
    plantUmlServerUrl += '/';

  // fetch the PlantUML SVG
  let text: string = '';
  try {
    // Dynamically import the PlantUML encoder - it's a large library that slows down app loading
    const { encode: plantUmlEncode } = await import('plantuml-encoder');

    // retrieve and manually adapt the SVG, to remove the background
    const encodedPlantUML: string = plantUmlEncode(plantUmlCode);
    const response = await frontendSideFetch(`${plantUmlServerUrl}${encodedPlantUML}`);
    text = await response.text();
  } catch (error) {
    console.error('Error rendering PlantUML on server:', plantUmlServerUrl, error);
    return null;
  }

  // validate/extract the SVG
  const start = text.indexOf('<svg ');
  const end = text.indexOf('</svg>');
  if (start < 0 || end <= start)
    throw new Error('Could not render PlantUML');

  // remove the background color
  const svg = text
    .slice(start, end + 6) // <svg ... </svg>
    .replace('background:#FFFFFF;', '');

  // check for syntax errors
  if (svg.includes('>Syntax Error?</text>'))
    throw new Error('llm syntax issue (it happens!). Please regenerate or change the language model.');

  return svg;
}


export const overlayButtonsSx: SxProps = {
  position: 'absolute', top: 0, right: 0, zIndex: 2, /* top of message and its chips */
  display: 'flex', flexDirection: 'row', gap: 1,
  opacity: 0, transition: 'opacity 0.2s cubic-bezier(.17,.84,.44,1)',
  // buttongroup: background
  '& > div > button': {
    backgroundColor: 'background.surface',
    // backdropFilter: 'blur(12px)',
  },
};


interface RenderCodeBaseProps {
  codeBlock: CodeBlock,
  fitScreen?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,
  initialShowHTML?: boolean,
  sx?: SxProps,
}

interface RenderCodeImplProps extends RenderCodeBaseProps {
  highlightCode: (inferredCodeLanguage: string | null, blockCode: string) => string,
  inferCodeLanguage: (blockTitle: string, code: string) => string | null,
}

function RenderCodeImpl(props: RenderCodeImplProps) {

  // state
  const [fitScreen, setFitScreen] = React.useState(!!props.fitScreen);
  const [showHTML, setShowHTML] = React.useState(props.initialShowHTML === true);
  const [showMermaid, setShowMermaid] = React.useState(true);
  const [showPlantUML, setShowPlantUML] = React.useState(true);
  const [showSVG, setShowSVG] = React.useState(true);

  // derived props
  const {
    codeBlock: { blockTitle, blockCode, complete: blockComplete },
    highlightCode, inferCodeLanguage,
    optimizeLightweight,
  } = props;

  // heuristic for language, and syntax highlight
  const { highlightedCode, inferredCodeLanguage } = React.useMemo(() => {
    const inferredCodeLanguage = inferCodeLanguage(blockTitle, blockCode);
    const highlightedCode = highlightCode(inferredCodeLanguage, blockCode);
    return { highlightedCode, inferredCodeLanguage };
  }, [inferCodeLanguage, blockTitle, blockCode, highlightCode]);


  // heuristics for specialized rendering

  const isHTML = heuristicIsHtml(blockCode);
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
  const { data: plantUmlHtmlData, error: plantUmlError } = useQuery({
    enabled: renderPlantUML,
    queryKey: ['plantuml', blockCode],
    queryFn: () => fetchPlantUmlSvg(blockCode),
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
  renderPlantUML = renderPlantUML && (!!plantUmlHtmlData || !!plantUmlError);

  const isSVG = (blockCode.startsWith('<svg') || blockCode.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')) && blockCode.endsWith('</svg>');
  const renderSVG = isSVG && showSVG;
  const canScaleSVG = renderSVG && blockCode.includes('viewBox="');


  const canCodePen = blockComplete && isCodePenSupported(inferredCodeLanguage, isSVG);
  const canJSFiddle = blockComplete && isJSFiddleSupported(inferredCodeLanguage, blockCode);
  const canStackBlitz = blockComplete && isStackBlitzSupported(inferredCodeLanguage);


  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(blockCode, 'Code');
  };

  return (
    <Box sx={{
      position: 'relative', /* for overlay buttons to stick properly */
    }}>

      {/* Code render */}
      <Box
        component='code'
        className={`language-${inferredCodeLanguage || 'unknown'}`}
        sx={{
          whiteSpace: 'pre', // was 'break-spaces' before we implemented per-block scrolling
          mx: 0, p: 1.5, // this block gets a thicker border
          display: 'block',
          overflowX: 'auto',
          minWidth: 160,
          '&:hover > .overlay-buttons': { opacity: 1 },
          ...(props.sx || {}),
        }}>

        {/* Markdown Title (File/Type) */}
        {blockTitle != inferredCodeLanguage && blockTitle.includes('.') && (
          <Sheet sx={{ boxShadow: 'sm', borderRadius: 'sm', mb: 1 }}>
            <Typography level='title-sm' sx={{ px: 1, py: 0.5 }}>
              {blockTitle}
              {/*{inferredCodeLanguage}*/}
            </Typography>
          </Sheet>
        )}

        {/* Renders HTML, or inline SVG, inline plantUML rendered, or highlighted code */}
        {renderHTML
          ? <IFrameComponent htmlString={blockCode} />
          : renderMermaid
            ? <RenderCodeMermaid mermaidCode={blockCode} fitScreen={fitScreen} />
            : <Box component='div'
                   dangerouslySetInnerHTML={{
                     __html:
                       renderSVG
                         ? (patchSvgString(fitScreen, blockCode) || 'No SVG code')
                         : renderPlantUML
                           ? (patchSvgString(fitScreen, plantUmlHtmlData) || (plantUmlError as string) || 'No PlantUML rendering.')
                           : highlightedCode,
                   }}
                   sx={{
                     ...(renderSVG ? { lineHeight: 0 } : {}),
                     ...(renderPlantUML ? { textAlign: 'center' } : {}),
                   }}
            />}

        {/* Buttons */}
        <Box className='overlay-buttons' sx={{ ...overlayButtonsSx, p: 0.5 }}>
          {isHTML && (
            <Tooltip title={optimizeLightweight ? null : renderHTML ? 'Hide' : 'Show Web Page'}>
              <IconButton variant={renderHTML ? 'solid' : 'soft'} color='danger' onClick={() => setShowHTML(!showHTML)}>
                <HtmlIcon />
              </IconButton>
            </Tooltip>
          )}
          {isMermaid && (
            <Tooltip title={optimizeLightweight ? null : renderMermaid ? 'Show Code' : 'Render Mermaid'}>
              <IconButton variant={renderMermaid ? 'solid' : 'soft'} onClick={() => setShowMermaid(!showMermaid)}>
                <SchemaIcon />
              </IconButton>
            </Tooltip>
          )}
          {isPlantUML && (
            <Tooltip title={optimizeLightweight ? null : renderPlantUML ? 'Show Code' : 'Render PlantUML'}>
              <IconButton variant={renderPlantUML ? 'solid' : 'soft'} onClick={() => setShowPlantUML(!showPlantUML)}>
                <SchemaIcon />
              </IconButton>
            </Tooltip>
          )}
          {isSVG && (
            <Tooltip title={optimizeLightweight ? null : renderSVG ? 'Show Code' : 'Render SVG'}>
              <IconButton variant={renderSVG ? 'solid' : 'soft'} onClick={() => setShowSVG(!showSVG)}>
                <ShapeLineOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          {((isMermaid && showMermaid) || (isPlantUML && showPlantUML && !plantUmlError) || (isSVG && showSVG && canScaleSVG)) && (
            <Tooltip title={optimizeLightweight ? null : fitScreen ? 'Original Size' : 'Fit Screen'}>
              <IconButton variant={fitScreen ? 'solid' : 'soft'} onClick={() => setFitScreen(on => !on)}>
                <FitScreenIcon />
              </IconButton>
            </Tooltip>
          )}
          {(canJSFiddle || canCodePen || canStackBlitz) && (
            <ButtonGroup aria-label='Open code in external editors' sx={{ cornerRadius: 'md' }}>
              {canJSFiddle && <ButtonJsFiddle code={blockCode} language={inferredCodeLanguage!} />}
              {canCodePen && <ButtonCodePen code={blockCode} language={inferredCodeLanguage!} />}
              {canStackBlitz && <ButtonStackBlitz code={blockCode} title={blockTitle} language={inferredCodeLanguage!} />}
            </ButtonGroup>
          )}
          {props.noCopyButton !== true && (
            <Tooltip title={optimizeLightweight ? null : 'Copy Code'}>
              <IconButton variant='soft' onClick={handleCopyToClipboard}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

      </Box>
    </Box>
  );
}

// Dynamically import the heavy prism functions
const RenderCodeDynamic = React.lazy(async () => {

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
      <RenderCodeDynamic {...props} />
    </React.Suspense>
  );
}

export const RenderCodeMemo = React.memo(RenderCode);