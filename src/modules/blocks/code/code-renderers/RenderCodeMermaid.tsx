import * as React from 'react';
import { create } from 'zustand';
import { useQuery } from '@tanstack/react-query';

import { Box, Typography } from '@mui/joy';

import { isBrowser } from '~/common/util/pwaUtils';
import { themeCodeFontFamilyCss, themeFontFamilyCss } from '~/common/app.theme';

import { diagramErrorSx, diagramSx } from './RenderCodePlantUML';
import { patchSvgString } from './RenderCodeSVG';


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

const useMermaidStore = create<MermaidAPIStore>()(
  () => ({
    mermaidAPI: null,
    loadingError: null,
  }),
);

let loadingStarted: boolean = false;
let loadingError: string | null = null;


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

    // gfx options
    fontFamily: themeCodeFontFamilyCss,
    altFontFamily: themeFontFamilyCss,

    // style configuration
    htmlLabels: true,
    securityLevel: 'loose',
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
  const { mermaidAPI } = useMermaidStore();

  React.useEffect(() => {
    if (!mermaidAPI)
      _loadMermaidFromCDN();
  }, [mermaidAPI]);

  return { mermaidAPI, isSuccess: !!mermaidAPI, hasStartedLoading: loadingStarted, error: loadingError };
}

type MermaidResult =
  | { success: true; svg: string }
  | { success: false; error: string };


export function RenderCodeMermaid(props: { mermaidCode: string, fitScreen: boolean }) {

  // state
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
        return svg ? { success: true, svg } : { success: false, error: 'No SVG returned.' };
      } catch (error: any) {
        return { success: false, error: error?.message ?? error?.toString() ?? 'unknown error' };
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 1 day
  });

  // derived
  const hasMermaidLoadError = !!mermaidLoadError;

  return (
    <Box component='div'>
      {data?.success === false && (
        <Typography level='body-sm' color='danger' variant='plain' sx={{ mb: 2, borderRadius: 'xs' }}>
          Unable to display diagram. Issue with the generated Mermaid code.
        </Typography>
      )}
      <Box
        component='div'
        ref={mermaidContainerRef}
        dangerouslySetInnerHTML={{
          __html:
            hasMermaidLoadError ? mermaidLoadError
              : data?.success === false ? data.error
                : patchSvgString(props.fitScreen, data?.svg) || 'Loading Diagram...',
        }}
        sx={data?.success === false ? diagramErrorSx : diagramSx}
      />
    </Box>
  );
}
