import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { encode as plantUmlEncode } from 'plantuml-encoder';

import { Box, IconButton, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SchemaIcon from '@mui/icons-material/Schema';
import ShapeLineOutlinedIcon from '@mui/icons-material/ShapeLineOutlined';

import { copyToClipboard } from '~/common/util/copyToClipboard';

import { CodeBlock } from './Block';
import { OpenInCodepen } from './OpenInCodepen';
import { OpenInReplit } from './OpenInReplit';


export function RenderCode(props: { codeBlock: CodeBlock, sx?: SxProps }) {
  const [showSVG, setShowSVG] = React.useState(true);
  const [showPlantUML, setShowPlantUML] = React.useState(true);

  const hasSVG = props.codeBlock.code.startsWith('<svg') && props.codeBlock.code.endsWith('</svg>');
  const renderSVG = hasSVG && showSVG;

  const hasPlantUML = props.codeBlock.code.startsWith('@startuml') && props.codeBlock.code.endsWith('@enduml');
  let renderPlantUML = hasPlantUML && showPlantUML;
  const { data: plantUmlSvgData } = useQuery({
    enabled: renderPlantUML,
    queryKey: ['plantuml', props.codeBlock.code],
    queryFn: async () => {
      try {
        // retrieve and manually adapt the SVG, to remove the background
        const encodedPlantUML: string = plantUmlEncode(props.codeBlock.code);
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
  renderPlantUML = renderPlantUML && !!plantUmlSvgData;

  const languagesCodepen = ['html', 'css', 'javascript', 'json', 'typescript'];
  const hasCodepenLanguage = hasSVG || (props.codeBlock.language && languagesCodepen.includes(props.codeBlock.language));

  const languagesReplit = ['python', 'java', 'csharp'];
  const hasReplitLanguage = props.codeBlock.language && languagesReplit.includes(props.codeBlock.language);

  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(props.codeBlock.code);
  };

  return (
    <Box
      component='code'
      sx={{
        position: 'relative', mx: 0, p: 1.5, // this block gets a thicker border
        display: 'block', fontWeight: 500,
        whiteSpace: 'break-spaces',
        '&:hover > .code-buttons': { opacity: 1 },
        ...(props.sx || {}),
      }}>

      {/* Buttons */}
      <Box
        className='code-buttons'
        sx={{
          backdropFilter: 'blur(6px) grayscale(0.8)',
          position: 'absolute', top: 0, right: 0, zIndex: 10, pt: 0.5, pr: 0.5,
          display: 'flex', flexDirection: 'row', gap: 1,
          opacity: 0, transition: 'opacity 0.3s',
        }}>
        {hasSVG && (
          <Tooltip title={renderSVG ? 'Show Code' : 'Render SVG'} variant='solid'>
            <IconButton variant={renderSVG ? 'solid' : 'soft'} color='neutral' onClick={() => setShowSVG(!showSVG)}>
              <ShapeLineOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
        {hasPlantUML && (
          <Tooltip title={renderPlantUML ? 'Show Code' : 'Render PlantUML'} variant='solid'>
            <IconButton variant={renderPlantUML ? 'solid' : 'soft'} color='neutral' onClick={() => setShowPlantUML(!showPlantUML)}>
              <SchemaIcon />
            </IconButton>
          </Tooltip>
        )}
        {hasCodepenLanguage &&
          <OpenInCodepen codeBlock={{ code: props.codeBlock.code, language: props.codeBlock.language || undefined }} />
        }
        {hasReplitLanguage &&
          <OpenInReplit codeBlock={{ code: props.codeBlock.code, language: props.codeBlock.language || undefined }} />
        }
        <Tooltip title='Copy Code' variant='solid'>
          <IconButton variant='outlined' color='neutral' onClick={handleCopyToClipboard}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Highlighted Code / SVG render */}
      <Box
        dangerouslySetInnerHTML={{ __html: (renderPlantUML && plantUmlSvgData) ? plantUmlSvgData : renderSVG ? props.codeBlock.code : props.codeBlock.content }}
        sx={{
          ...(renderSVG ? { lineHeight: 0 } : {}),
          ...(renderPlantUML ? { textAlign: 'center' } : {}),
        }}
      />
    </Box>
  );
}