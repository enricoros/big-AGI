import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useAgiFixupCode } from '~/modules/aifn/agicodefixup/useAgiFixupCode';

import { frontendSideFetch } from '~/common/util/clientFetchers';
import { renderSVGToPNGBlob } from '~/common/util/imageUtils';

import { encodeWithCompressionStream } from './plantuml.utils';
import type { IRenderHandle } from './IRenderHandle';
import { useFittedSvgString } from './RenderCodeSVG';


// configuration
const PLANTUML_THEMES = ['plain', 'blueprint', 'crt-amber', 'aws-orange', 'superhero', 'hacker', 'sketchy', 'vibrant', 'mars']; // good-looking, high-contrast, and diverse themes for PlantUML


export function heuristicIsCodePlantUML(code: string) {
  return (code.startsWith('@startuml') && code.endsWith('@enduml'))
    || (code.startsWith('@startmindmap') && code.endsWith('@endmindmap'))
    || (code.startsWith('@startsalt') && code.endsWith('@endsalt'))
    || (code.startsWith('@startwbs') && code.endsWith('@endwbs'))
    || (code.startsWith('@startgantt') && code.endsWith('@endgantt'));
}


// Styles for the diagram
export const diagramSx: SxProps = {
  textAlign: 'center',
  mx: 'auto',
  minHeight: 100,
};

// Styles for displaying errors
export const diagramErrorSx: SxProps = {
  ...diagramSx,
  mt: 1,
  mx: undefined,
  textAlign: undefined,
  // whiteSpace: 'break-spaces',
};

const defaultIssue = 'Syntax issue in generated PlantUML code. Please retry with a different Model.';

// Function to get the PlantUML server URL
export function getPlantUmlServerUrl(): string {
  // Set at Next.js build time
  return process.env.NEXT_PUBLIC_PLANTUML_SERVER_URL || 'https://www.plantuml.com/plantuml/svg/';
}


type _ErrorInfo = { message: string; line: number | null; codeContext?: string[] };


// compose a well-formatted error message for AI consumption
function _composeErrorDetails(info: _ErrorInfo): string {
  // a. header error with line number but no code context
  if (info.line !== null && !info.codeContext?.length)
    return `Error on line ${info.line}: ${info.message}`;

  // b. fallback
  if (!info.codeContext || info.codeContext.length <= 0)
    return `PlantUML Error: ${info.message}`;

  // c. code context available
  const l: string[] = [];
  l.push('PlantUML rendering failed with the following context:');
  l.push('```error');
  l.push(info.codeContext.join('\n'));
  l.push('```');
  if (info.line === null) {
    l.push(`^^^^ ${info.message}`);
    l.push('(The error is related to the line immediately above)');
  } else
    l.push(`Error on line ${info.line}: ${info.message}`);
  return l.join('\n');
}

function _extractErrorFromHeaders(response: Response): _ErrorInfo | null {
  const errorHeaders = response.headers.get('X-PlantUML-Diagram-Error');
  if (!errorHeaders) return null;

  const lineHeader = response.headers.get('X-PlantUML-Diagram-Error-Line');
  const lineNumber = lineHeader ? parseInt(lineHeader, 10) : null;

  return {
    message: errorHeaders,
    line: lineNumber,
  };
}

function _extractErrorFromSVG(svgText: string): _ErrorInfo | null {
  if (!svgText.includes('fill="#FF0000"')) return null;
  try {
    // Parse SVG and extract all text
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const textElements = doc.querySelectorAll('text');

    const texts: string[] = [];
    textElements.forEach(el => {
      const content = el.textContent;
      texts.push(content ? content.trim() : '');
    });

    // Find key information
    const errorMessage = texts.find(t => t.includes('Syntax Error?') || t.includes('Error')) || defaultIssue;
    const location = texts.find(t => /\[From .+ \(line \d+\)/.test(t));
    const version = texts.find(t => t.includes('PlantUML'));

    // Get code context (everything except metadata) - don't trust the line number from SVG
    const codeContext = texts.filter(t =>
      t !== version &&
      t !== location &&
      t !== errorMessage &&
      t.length > 0,
    );

    return {
      message: errorMessage,
      line: null, // SVG line numbers are not reliable, only use header line numbers
      codeContext: codeContext.length > 0 ? codeContext : undefined,
    };
  } catch (error) {
    console.warn('Failed to parse error SVG:', error);
    return null;
  }
}


// Transform PlantUML code to SVG
async function fetchPlantUmlSvg(plantUmlCode: string): Promise<{ svg: string | null; errorText: string | null; errorCause: string | null; }> {
  // Get the PlantUML server from inline env var
  let plantUmlServerUrl = getPlantUmlServerUrl();
  if (!plantUmlServerUrl.endsWith('/'))
    plantUmlServerUrl += '/';

  // fetch the PlantUML SVG
  let text: string = '';
  try {
    const encodedPlantUML: string = await encodeWithCompressionStream(plantUmlCode);

    // retrieve the SVG with a simple REST request
    const response = await frontendSideFetch(`${plantUmlServerUrl}${encodedPlantUML}`);
    text = await response.text();

    // if the response is not ok, extract error from headers or SVG
    if (!response.ok) {
      const headerError = _extractErrorFromHeaders(response);
      const svgError = _extractErrorFromSVG(text);

      // Merge both sources: prefer header line number, but use SVG code context if available
      const error: _ErrorInfo | null = headerError && svgError
        ? { message: headerError.message, line: headerError.line, codeContext: svgError.codeContext }
        : svgError || headerError;

      return {
        svg: null,
        errorText: error?.message || defaultIssue,
        errorCause: error ? _composeErrorDetails(error) : text,
      };
    }

  } catch (error) {
    console.error('Error rendering PlantUML on server:', plantUmlServerUrl, error);
    throw new Error('Error fetching PlantUML diagram.');
  }

  // validate/extract the SVG
  const start = text.indexOf('<svg ');
  const end = text.indexOf('</svg>');
  if (start < 0 || end <= start)
    return { svg: null, errorText: 'Could not convert the PlantUML to SVG', errorCause: text };

  // remove the background color
  const svg = text
    .slice(start, end + 6) // <svg ... </svg>
    .replace('background:#FFFFFF;', '');

  // check for syntax errors (final safety check)
  if (svg.includes('>Syntax Error?</text>')) {
    const svgError = _extractErrorFromSVG(text);
    return {
      svg: null,
      errorText: svgError?.message || defaultIssue,
      errorCause: svgError ? _composeErrorDetails(svgError) : text,
    };
  }

  // success case
  return { svg, errorText: null, errorCause: null };
}


/**
 * Two-state toggle the layout direction of a PlantUML diagram: default (top-to-bottom) vs. left-to-right
 */
export function plantUMLCodeToggleDirection(code: string): string {
  const hasLR = /left to right direction/i.test(code);

  if (hasLR) {
    // Remove LR directive to go back to default (top-to-bottom)
    return code.replace(/left to right direction\s*\n?/i, '');
  } else {
    // Override any existing TB directive with LR
    const cleanCode = code.replace(/top to bottom direction\s*\n?/i, '');
    return cleanCode.replace(/(@start\w+.*)/i, '$1\nleft to right direction');
  }
}


/**
 * Cycles through a predefined list of PlantUML themes, including removing it.
 */
export function plantUMLCodeCycleTheme(code: string): string {
  const themeRegex = /!theme\s+([a-zA-Z0-9_-]+)/i;
  const match = code.match(themeRegex);
  const currentTheme = match ? match[1].toLowerCase() : null;

  // no theme: apply first
  if (!currentTheme)
    return code.replace(/(@start\w+.*)/i, `$1\n!theme ${PLANTUML_THEMES[0]}`);

  // unknown theme: replace with first known theme
  const currentIndex = PLANTUML_THEMES.indexOf(currentTheme);
  if (currentIndex === -1)
    return code.replace(themeRegex, `!theme ${PLANTUML_THEMES[0]}`);

  // last theme: remove the theme directive
  if (currentIndex === PLANTUML_THEMES.length - 1)
    return code.replace(/!theme\s+[a-zA-Z0-9_-]+\s*\n?/i, '');

  // advance theme
  return code.replace(themeRegex, `!theme ${PLANTUML_THEMES[currentIndex + 1]}`);
}


export const RenderCodePlantUML = React.forwardRef(function RenderCodePlantUML(props: {
  plantUMLCode: string;
  fitContainer: boolean;
  allowDetails?: boolean;
  onReplaceInCode?: (search: string, replace: string) => boolean;
}, ref: React.Ref<IRenderHandle>) {

  // state
  const [fixupError, setFixupError] = React.useState<string | null>(null);

  // external state: the PlantUML SVG
  const { data: conversion, error: serverError, isLoading } = useQuery({
    enabled: !!props.plantUMLCode,
    queryKey: ['plantuml', props.plantUMLCode],
    queryFn: () => fetchPlantUmlSvg(props.plantUMLCode),
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
  const patchedSvgCode = useFittedSvgString(conversion?.svg ?? null, props.fitContainer);

  // AI Fixup function - pass full error context (errorCause) for better AI analysis
  const tryFixError = conversion?.errorCause || conversion?.errorText || serverError?.message || null;
  const { isFetching, refetch } = useAgiFixupCode('plantuml-issue', false, props.plantUMLCode,
    tryFixError ? `---\n${tryFixError}\n---\n` : null,
  );

  // handlers
  const { onReplaceInCode } = props;

  const handleDiagramRegenerate = React.useCallback(async () => {
    if (!onReplaceInCode) return;

    setFixupError(null);
    refetch()
      .then((result) => {
        if (result.data)
          onReplaceInCode(props.plantUMLCode, result.data);
        else if (result.error)
          setFixupError(result.error.message || 'Unknown error.');
        else
          setFixupError('Unknown Fixup error.');
      });
  }, [onReplaceInCode, props.plantUMLCode, refetch]);


  // Expose control methods
  React.useImperativeHandle(ref, () => ({
    renderAsPNGBlob: async (transparentBackground: boolean) => {
      if (!patchedSvgCode) return null;
      const blob = await renderSVGToPNGBlob(patchedSvgCode, transparentBackground, 2);
      return !blob ? null : { blob, prefix: 'uml' };
    },
  }), [patchedSvgCode]);


  // Loading state
  if (isLoading)
    return <Typography level='body-sm'>Drawing diagram...</Typography>;

  // Error state
  if (serverError || conversion?.errorText) {
    return (
      <Box component='div'>
        {onReplaceInCode && (
          <Box sx={{ display: 'grid', gap: 1, justifyItems: 'start' }}>
            <Button
              size='sm'
              variant='outlined'
              color='success'
              disabled={!onReplaceInCode}
              onClick={handleDiagramRegenerate}
              loading={isFetching}
              loadingPosition='end'
              sx={{
                minWidth: 160,
                backgroundColor: 'background.surface',
                boxShadow: 'xs',
              }}
              endDecorator={<AutoAwesomeIcon />}
            >
              {isFetching ? 'Fixing Diagram...' : 'Attempt Fix'}
            </Button>
            {fixupError && (
              <Typography level='body-sm' color='warning'>
                Error fixing diagram: {fixupError}
              </Typography>
            )}
          </Box>
        )}
        <Typography component='div' level='body-sm' color='warning' sx={diagramErrorSx}>
          {conversion?.errorText || serverError?.message || 'Unknown error'}
          {!!conversion?.errorCause && !!props.allowDetails && (
            <details>
              <summary>Details</summary>
              <Box sx={{ whiteSpace: 'break-spaces' }}>{conversion.errorCause}</Box>
            </details>
          )}
        </Typography>
      </Box>
    );
  }

  // Conversion errors
  if (!patchedSvgCode)
    return (
      <Typography component='div' level='body-sm' color='warning' sx={diagramErrorSx}>
        {conversion?.errorText || 'Unknown error'}
        {!!conversion?.errorCause && !!props.allowDetails && (
          <details>
            <summary>Details</summary>
            <Box sx={{ whiteSpace: 'break-spaces' }}>{conversion.errorCause}</Box>
          </details>
        )}
      </Typography>
    );

  return (
    <Box
      component='div'
      className='code-container'
      dangerouslySetInnerHTML={{ __html: patchedSvgCode || 'No PlantUML / rendered code.' }}
      sx={diagramSx}
    />
  );
});