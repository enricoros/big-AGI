import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Box, IconButton, Sheet, Tooltip, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SchemaIcon from '@mui/icons-material/Schema';
import ShapeLineOutlinedIcon from '@mui/icons-material/ShapeLineOutlined';

import { copyToClipboard } from '~/common/util/copyToClipboard';

import { CodeBlock } from './blocks';
import { OpenInCodepen } from './OpenInCodepen';
import { OpenInReplit } from './OpenInReplit';


function RenderCodeImpl(props: {
  codeBlock: CodeBlock, sx?: SxProps,
  highlightCode: (inferredCodeLanguage: string | null, blockCode: string) => string,
  inferCodeLanguage: (blockTitle: string, code: string) => string | null,
}) {
  // state
  const [showSVG, setShowSVG] = React.useState(true);
  const [showPlantUML, setShowPlantUML] = React.useState(true);

  // derived props
  const { codeBlock: { blockTitle, blockCode }, highlightCode, inferCodeLanguage } = props;

  const isSVG = blockCode.startsWith('<svg') && blockCode.endsWith('</svg>');
  const renderSVG = isSVG && showSVG;

  const isPlantUML = blockCode.startsWith('@startuml') && blockCode.endsWith('@enduml');
  let renderPlantUML = isPlantUML && showPlantUML;
  const { data: plantUmlHtmlData } = useQuery({
    enabled: renderPlantUML,
    queryKey: ['plantuml', blockCode],
    queryFn: async () => {
      try {
        // Dynamically import the PlantUML encoder - it's a large library that slows down app loading
        const { encode: plantUmlEncode } = await import('plantuml-encoder');

        // retrieve and manually adapt the SVG, to remove the background
        const encodedPlantUML: string = plantUmlEncode(blockCode);
        const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encodedPlantUML}`);
        const svg = await response.text();
        const start = svg.indexOf('<svg ');
        const end = svg.indexOf('</svg>');
        if (start < 0 || end <= start)
          return null;
        return svg.slice(start, end + 6).replace('background:#FFFFFF;', '');
      } catch (e) {
        // ignore errors, and disable the component in that case
        return null;
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
  renderPlantUML = renderPlantUML && !!plantUmlHtmlData;

  // heuristic for language, and syntax highlight
  const { highlightedCode, inferredCodeLanguage } = React.useMemo(
    () => {
      const inferredCodeLanguage = inferCodeLanguage(blockTitle, blockCode);
      const highlightedCode = highlightCode(inferredCodeLanguage, blockCode);
      return { highlightedCode, inferredCodeLanguage };
    }, [inferCodeLanguage, blockTitle, blockCode, highlightCode]);


  const languagesCodepen = ['html', 'css', 'javascript', 'json', 'typescript'];
  const canCodepen = isSVG || (!!inferredCodeLanguage && languagesCodepen.includes(inferredCodeLanguage));

  const languagesReplit = ['python', 'java', 'csharp'];
  const canReplit = !!inferredCodeLanguage && languagesReplit.includes(inferredCodeLanguage);

  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(blockCode);
  };

  return (
    <Box
      component='code'
      className={`language-${inferredCodeLanguage || 'unknown'}`}
      sx={{
        position: 'relative', mx: 0, p: 1.5, // this block gets a thicker border
        display: 'block', fontWeight: 500,
        whiteSpace: 'pre', // was 'break-spaces' before we implmented per-block scrolling
        overflowX: 'auto',
        '&:hover > .code-buttons': { opacity: 1 },
        ...(props.sx || {}),
      }}>

      {/* Overlay Buttons */}
      <Box
        className='code-buttons'
        sx={{
          backdropFilter: 'blur(8px)', // '... grayscale(0.8)
          position: 'absolute', top: 0, right: 0, zIndex: 10, p: 0.5,
          display: 'flex', flexDirection: 'row', gap: 1,
          opacity: 0, transition: 'opacity 0.3s',
          // '& > button': { backdropFilter: 'blur(6px)' },
        }}>
        {isSVG && (
          <Tooltip title={renderSVG ? 'Show Code' : 'Render SVG'} variant='solid'>
            <IconButton variant={renderSVG ? 'solid' : 'soft'} color='neutral' onClick={() => setShowSVG(!showSVG)}>
              <ShapeLineOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
        {isPlantUML && (
          <Tooltip title={renderPlantUML ? 'Show Code' : 'Render PlantUML'} variant='solid'>
            <IconButton variant={renderPlantUML ? 'solid' : 'soft'} color='neutral' onClick={() => setShowPlantUML(!showPlantUML)}>
              <SchemaIcon />
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

      {/* Title (highlighted code) */}
      {blockTitle != inferredCodeLanguage && blockTitle.includes('.') && <Sheet sx={{ boxShadow: 'sm', borderRadius: 'sm', mb: 1 }}>
        <Typography level='title-sm' sx={{ px: 1, py: 0.5 }}>
          {blockTitle}
          {/*{inferredCodeLanguage}*/}
        </Typography>
      </Sheet>}

      {/* Renders SVG, plantUML code, or Highlighted Code */}
      <Box
        dangerouslySetInnerHTML={{
          __html:
            renderSVG ? blockCode
              : (renderPlantUML && plantUmlHtmlData) ? plantUmlHtmlData
                : highlightedCode,
        }}
        sx={{
          ...(renderSVG ? { lineHeight: 0 } : {}),
          ...(renderPlantUML ? { textAlign: 'center' } : {}),
        }}
      />
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