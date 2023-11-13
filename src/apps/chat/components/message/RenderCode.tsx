import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Box, IconButton, Sheet, Tooltip, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HtmlIcon from '@mui/icons-material/Html';
import SchemaIcon from '@mui/icons-material/Schema';
import ShapeLineOutlinedIcon from '@mui/icons-material/ShapeLineOutlined';

import { copyToClipboard } from '~/common/util/copyToClipboard';

import { CodeBlock } from './blocks';
import { OpenInCodepen } from './OpenInCodepen';
import { OpenInReplit } from './OpenInReplit';
import { RenderCodeMermaid } from './RenderCodeMermaid';
import { heuristicIsHtml, IFrameComponent } from './RenderHtml';


export const overlayButtonsSx: SxProps = {
  position: 'absolute', top: 0, right: 0, zIndex: 10,
  display: 'flex', flexDirection: 'row', gap: 1,
  opacity: 0, transition: 'opacity 0.2s',
  '& > button': { backdropFilter: 'blur(12px)' },
};

function RenderCodeImpl(props: {
  codeBlock: CodeBlock, sx?: SxProps,
  highlightCode: (inferredCodeLanguage: string | null, blockCode: string) => string,
  inferCodeLanguage: (blockTitle: string, code: string) => string | null,
}) {

  // state
  const [showHTML, setShowHTML] = React.useState(false);
  const [showMermaid, setShowMermaid] = React.useState(true);
  const [showPlantUML, setShowPlantUML] = React.useState(true);
  const [showSVG, setShowSVG] = React.useState(true);

  // derived props
  const {
    codeBlock: { blockTitle, blockCode, complete: blockComplete },
    highlightCode, inferCodeLanguage,
  } = props;

  // heuristic for language, and syntax highlight
  const { highlightedCode, inferredCodeLanguage } = React.useMemo(
    () => {
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
    queryFn: async () => {
      // fetch the PlantUML SVG
      let text: string = '';
      try {
        // Dynamically import the PlantUML encoder - it's a large library that slows down app loading
        const { encode: plantUmlEncode } = await import('plantuml-encoder');

        // retrieve and manually adapt the SVG, to remove the background
        const encodedPlantUML: string = plantUmlEncode(blockCode);
        const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encodedPlantUML}`);
        text = await response.text();
      } catch (e) {
        return null;
      }
      // validate/extract the SVG
      const start = text.indexOf('<svg ');
      const end = text.indexOf('</svg>');
      if (start < 0 || end <= start)
        throw new Error('Could not render PlantUML');
      const svg = text
        .slice(start, end + 6) // <svg ... </svg>
        .replace('background:#FFFFFF;', ''); // transparent background

      // check for syntax errors
      if (svg.includes('>Syntax Error?</text>'))
        throw new Error('syntax issue (it happens!). Please regenerate or change generator model.');

      return svg;
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
  renderPlantUML = renderPlantUML && (!!plantUmlHtmlData || !!plantUmlError);

  const isSVG = blockCode.startsWith('<svg') && blockCode.endsWith('</svg>');
  const renderSVG = isSVG && showSVG;


  const languagesCodepen = ['html', 'css', 'javascript', 'json', 'typescript'];
  const canCodepen = isSVG || (!!inferredCodeLanguage && languagesCodepen.includes(inferredCodeLanguage));

  const languagesReplit = ['python', 'java', 'csharp'];
  const canReplit = !!inferredCodeLanguage && languagesReplit.includes(inferredCodeLanguage);

  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(blockCode);
  };

  return (
    <Box sx={{ position: 'relative' /* for overlay buttons to stick properly */ }}>
      <Box
        component='code'
        className={`language-${inferredCodeLanguage || 'unknown'}`}
        sx={{
          fontWeight: 500, whiteSpace: 'pre', // was 'break-spaces' before we implemented per-block scrolling
          mx: 0, p: 1.5, // this block gets a thicker border
          display: 'block',
          overflowX: 'auto',
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
            ? <RenderCodeMermaid mermaidCode={blockCode} />
            : <Box component='div'
                   dangerouslySetInnerHTML={{
                     __html:
                       renderSVG
                         ? blockCode
                         : renderPlantUML
                           ? (plantUmlHtmlData || (plantUmlError as string) || 'No PlantUML rendering.')
                           : highlightedCode,
                   }}
                   sx={{
                     ...(renderSVG ? { lineHeight: 0 } : {}),
                     ...(renderPlantUML ? { textAlign: 'center' } : {}),
                   }}
            />}

        {/* Code Buttons */}
        <Box className='overlay-buttons' sx={{ ...overlayButtonsSx, p: 0.5 }}>
          {isHTML && (
            <Tooltip title={renderHTML ? 'Hide' : 'Show Web Page'} variant='solid'>
              <IconButton variant={renderHTML ? 'solid' : 'outlined'} color='danger' onClick={() => setShowHTML(!showHTML)}>
                <HtmlIcon />
              </IconButton>
            </Tooltip>
          )}
          {isMermaid && (
            <Tooltip title={renderMermaid ? 'Show Code' : 'Render Mermaid'} variant='solid'>
              <IconButton variant={renderMermaid ? 'solid' : 'outlined'} color='neutral' onClick={() => setShowMermaid(!showMermaid)}>
                <SchemaIcon />
              </IconButton>
            </Tooltip>
          )}
          {isPlantUML && (
            <Tooltip title={renderPlantUML ? 'Show Code' : 'Render PlantUML'} variant='solid'>
              <IconButton variant={renderPlantUML ? 'solid' : 'outlined'} color='neutral' onClick={() => setShowPlantUML(!showPlantUML)}>
                <SchemaIcon />
              </IconButton>
            </Tooltip>
          )}
          {isSVG && (
            <Tooltip title={renderSVG ? 'Show Code' : 'Render SVG'} variant='solid'>
              <IconButton variant={renderSVG ? 'solid' : 'outlined'} color='neutral' onClick={() => setShowSVG(!showSVG)}>
                <ShapeLineOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          {canCodepen && <OpenInCodepen codeBlock={{ code: blockCode, language: inferredCodeLanguage || undefined }} />}
          {canReplit && <OpenInReplit codeBlock={{ code: blockCode, language: inferredCodeLanguage || undefined }} />}
          <Tooltip title='Copy Code' variant='solid'>
            <IconButton variant='outlined' color='neutral' onClick={handleCopyToClipboard}>
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
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
    default: (props: { codeBlock: CodeBlock, sx?: SxProps }) =>
      <RenderCodeImpl highlightCode={highlightCode} inferCodeLanguage={inferCodeLanguage} {...props} />,
  };
});

export const RenderCode = (props: { codeBlock: CodeBlock, sx?: SxProps }) =>
  <React.Suspense fallback={<Box component='code' sx={{ p: 1.5, display: 'block', ...(props.sx || {}) }} />}>
    <RenderCodeDynamic {...props} />
  </React.Suspense>;