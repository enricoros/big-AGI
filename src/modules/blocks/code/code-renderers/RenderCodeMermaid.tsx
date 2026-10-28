import * as React from 'react';
import { create as createStoreForReactiveGlobals } from 'zustand';
import { useQuery } from '@tanstack/react-query';

import { Box, Button, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useAgiFixupCode } from '~/modules/aifn/agicodefixup/useAgiFixupCode';

import { isBrowser } from '~/common/util/pwaUtils';
import { renderSVGToPNGBlob } from '~/common/util/imageUtils';
import { sanitizeSvgMarkup } from '~/common/util/svgSanitizeUtils';
import { themeCodeFontFamilyCss, themeFontFamilyCss } from '~/common/app.theme';

import type { IRenderHandle } from './IRenderHandle';
import { useFittedSvgString } from './RenderCodeSVG';


/// Mermaid Loading / Using

/**
 * We are loading Mermaid from the CDN (and spending all the work to dynamically load it
 * and strong type it), because the Mermaid dependencies (npm i mermaid) are too heavy
 * and would slow down development for everyone.
 *
 * If you update this file, also make sure the interfaces/type definitions and initialization
 * options are updated accordingly.
 */
const MERMAID_CDN_FILE: string = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';

interface MermaidAPI {
  initialize: (config: any) => void;
  render: (id: string, text: string, svgContainingElement?: Element) => Promise<{ svg: string, bindFunctions?: (element: Element) => void }>;
}

// extend the Window interface, to allow for the mermaid API to be found
declare global {
  // noinspection JSUnusedGlobalSymbols
  interface Window {
    mermaid: MermaidAPI;
  }
}


interface MermaidAPIStore {
  mermaidAPI: MermaidAPI | null,
  loadingError: string | null,
}

const useMermaidStore = createStoreForReactiveGlobals<MermaidAPIStore>()(
  () => ({
    mermaidAPI: null,
    loadingError: null,
  }),
);


let loadingStarted: boolean = false;

function _loadMermaidFromCDN() {
  if (isBrowser && !loadingStarted) {
    loadingStarted = true;
    const script = document.createElement('script');
    script.src = MERMAID_CDN_FILE;
    script.defer = true;
    script.onload = () => {
      useMermaidStore.setState({
        mermaidAPI: _initializeMermaid(window.mermaid),
        loadingError: null,
      });
    };
    script.onerror = () => {
      useMermaidStore.setState({
        mermaidAPI: null,
        loadingError: `Script load error for ${script.src}`,
      });
    };
    document.head.appendChild(script);
  }
}

/**
 * Pass the current font families at loading time. Note that the font families will be compiled by next to something like this:
 * - code: "'__JetBrains_Mono_dc2b2d', '__JetBrains_Mono_Fallback_dc2b2d', monospace",
 * - text: "'__Inter_1870e5', '__Inter_Fallback_1870e5', Helvetica, Arial, sans-serif"
 */
function _initializeMermaid(mermaidAPI: MermaidAPI): MermaidAPI {
  mermaidAPI.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,

    // gfx options
    fontFamily: themeCodeFontFamilyCss,
    altFontFamily: themeFontFamilyCss,

    // style configuration
    htmlLabels: false,
    securityLevel: 'strict',
    theme: 'forest',

    // per-chart configuration
    mindmap: { useMaxWidth: false },
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    timeline: { useMaxWidth: false },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false },
    pie: { useMaxWidth: false },
    er: { useMaxWidth: false },
    gantt: { useMaxWidth: false },
    gitGraph: { useMaxWidth: false },
  });
  return mermaidAPI;
}

function useMermaidLoader() {
  const { mermaidAPI, loadingError } = useMermaidStore();

  React.useEffect(() => {
    if (!mermaidAPI)
      _loadMermaidFromCDN();
  }, [mermaidAPI]);

  return { mermaidAPI, isSuccess: !!mermaidAPI, hasStartedLoading: loadingStarted, error: loadingError };
}

function _cleanMermaidSVG(svgCode: string): string {

  // parse the SVG string
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgCode, 'image/svg+xml');

  // find foreignObject
  // noinspection CssInvalidHtmlTagReference
  const foreignObjects = doc.querySelectorAll('foreignObject');

  // Replace each foreignObject with a text element
  foreignObjects.forEach(fo => {
    // get the text content
    const div = fo?.querySelector('div');
    const text = div?.textContent?.trim() || '';

    // create new text element
    const textElement = doc.createElementNS('http://www.w3.org/2000/svg', 'text');

    // copy relevant attributes from parent g element
    const parentG = fo?.parentElement;
    const transform = parentG?.getAttribute('transform');
    if (transform)
      textElement.setAttribute('transform', transform);

    // set text properties
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('dominant-baseline', 'middle');
    textElement.textContent = text;

    // replace foreignObject's parent g with new text element
    if (parentG?.parentElement)
      parentG.parentElement.replaceChild(textElement, parentG);
  });

  // serialize back to string
  return new XMLSerializer().serializeToString(doc);
}


// Mermaid Rendering Component

type MermaidResult =
  | { success: true; svg: string }
  | { success: false; error: string };

export const RenderCodeMermaid = React.forwardRef(function RenderCodeMermaid(props: {
  mermaidCode: string;
  fitScreen: boolean;
  onReplaceInCode?: (search: string, replace: string) => boolean;
}, ref: React.Ref<IRenderHandle>) {

  // state
  const [fixupFailure, setFixupFailure] = React.useState<{ code: string; message: string } | null>(null);
  const fixupError = fixupFailure?.code === props.mermaidCode ? fixupFailure.message : null;
  const mermaidContainerRef = React.useRef<HTMLDivElement>(null);

  // external state
  const { mermaidAPI, error: mermaidLoadError } = useMermaidLoader();

  // [effect] re-render on code changes
  const { data } = useQuery<MermaidResult>({
    enabled: !!mermaidAPI && !!props.mermaidCode,
    queryKey: ['mermaid', props.mermaidCode],
    queryFn: async (): Promise<MermaidResult> => {
      try {
        const elementId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaidAPI!.render(elementId, props.mermaidCode, mermaidContainerRef.current!);
        const safeSvg = !svg ? '' : sanitizeSvgMarkup(svg.replaceAll('&amp;quot;', '&quot;').replaceAll('&amp;amp;', '&amp;'), { allowExternalLinks: true });
        return safeSvg ? { success: true, svg: safeSvg } : { success: false, error: 'No SVG returned.' };
      } catch (error: any) {
        return { success: false, error: error?.message ?? error?.toString() ?? 'unknown error' };
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 1 day
  });
  const patchedSvgCode = useFittedSvgString(data?.success === true ? data.svg : null, props.fitScreen);

  // AI Fixup function
  const renderError = mermaidLoadError || (data?.success === false ? data.error : null) || null;
  const { isFetching, refetch } = useAgiFixupCode('mermaid-issue', false, props.mermaidCode, renderError);


  // handlers

  const { onReplaceInCode } = props;

  const handleChartRegenerate = React.useCallback(async () => {
    if (!onReplaceInCode) return;
    setFixupFailure(null);
    refetch().then((result) => {
      if (result.data)
        onReplaceInCode(props.mermaidCode, result.data);
      else if (result.error)
        setFixupFailure({ code: props.mermaidCode, message: result.error.message || 'Unknown error.' });
      else
        setFixupFailure({ code: props.mermaidCode, message: 'Unknown Fixup error.' });
    });
  }, [onReplaceInCode, props.mermaidCode, refetch]);


  // Expose control methods
  React.useImperativeHandle(ref, () => ({
    renderAsPNGBlob: async (transparentBackground: boolean) => {
      if (!patchedSvgCode) return null;
      const hotfixedMermaidCode = _cleanMermaidSVG(patchedSvgCode);
      const blob = await renderSVGToPNGBlob(hotfixedMermaidCode, transparentBackground, 2)
        .catch((error) => {
          console.warn('Error converting Mermaid SVG to PNG:', error);
          return null;
        });
      return !blob ? null : { blob, prefix: 'diagram' };
    },
  }), [patchedSvgCode]);


  return (
    <Box component='div'>
      {(!!renderError || !!fixupError) && (
        <Box sx={{ display: 'grid', gap: 1, justifyItems: 'start' }}>
          <Button
            size='sm'
            variant='outlined'
            color='success'
            disabled={!props.onReplaceInCode}
            onClick={handleChartRegenerate}
            loading={isFetching}
            loadingPosition='end'
            sx={{
              minWidth: 160,
              backgroundColor: 'background.surface',
              boxShadow: 'xs',
            }}
            endDecorator={props.onReplaceInCode ? <AutoAwesomeIcon /> : undefined}
          >
            {isFetching ? 'Fixing Diagram... ' : props.onReplaceInCode ? 'Attempt Fix' : 'Detected Issue'}
          </Button>
          {fixupError ? (
            <Typography level='body-sm' color='warning'>
              Error fixing diagram: {fixupError}
            </Typography>
          ) : (renderError && !isFetching) && (
            <Typography level='body-sm' color='warning' variant='plain'>
              Unable to display diagram. Issue with the generated Mermaid code.
            </Typography>
          )}
        </Box>
      )}
      {renderError ? (
        <Typography level='body-sm' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {renderError}
        </Typography>
      ) : !patchedSvgCode && (
        <Typography level='body-sm'>
          {data?.success === true ? 'Invalid SVG...' : 'Loading Diagram...'}
        </Typography>
      )}
      <Box
        component='div'
        ref={mermaidContainerRef}
        dangerouslySetInnerHTML={{ __html: (!renderError && patchedSvgCode) || '' }}
      />
    </Box>
  );
});
