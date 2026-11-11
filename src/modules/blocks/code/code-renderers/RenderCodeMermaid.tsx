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
 * options are updated accordingly. Update the version and the integrity together.
 *
 * Mermaid 12 is not adopted: it declares Safari 17.4+ (above our floor), restyles every diagram (ELK layout, 'neo' look)
 * and adds ~600 KB gzipped to this script.
 */
const MERMAID_CDN_FILE: string = 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js';
const MERMAID_CDN_INTEGRITY: string = 'sha384-EOXBFmc3gx5mb+vn0vPvvGqACToJD24hhacX5Yx+8NUUQrHIle/Qi5Bg9o3zKwW2';

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
    script.integrity = MERMAID_CDN_INTEGRITY;
    script.crossOrigin = 'anonymous';
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
 * Pass the current font families at loading time (see ~/common/styles/fonts/app.fonts.ts):
 * - code: "'JetBrains Mono', 'JetBrains Mono Fallback', monospace",
 * - text: "'Inter', 'Inter Fallback', Helvetica, Arial, sans-serif"
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
    securityLevel: 'strict', // diagrams come from models and shared chats: sanitizes labels, drops javascript: links
    // Mermaid's defaults plus htmlLabels: a diagram turning HTML labels back on gets foreignObject labels, which the sanitizer drops
    secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges', 'htmlLabels'],
    theme: 'forest',
    // 11.x leaves the label of [ ] ( ) (( )) {{ }} mindmap nodes at x=0 when htmlLabels is false; fixed in Mermaid 12.2
    themeCSS: '.mindmap-node .label[transform^="translate(0,"] text { text-anchor: middle; }',

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
  const svgCode = data?.success === true ? data.svg : null;
  const patchedSvgCode = useFittedSvgString(svgCode, props.fitScreen);

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
      if (!svgCode) return null;
      const blob = await renderSVGToPNGBlob(svgCode, transparentBackground, 2)
        .catch((error) => {
          console.warn('Error converting Mermaid SVG to PNG:', error);
          return null;
        });
      return !blob ? null : { blob, prefix: 'diagram' };
    },
  }), [svgCode]);


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
