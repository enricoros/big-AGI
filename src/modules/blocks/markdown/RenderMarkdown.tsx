import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, styled } from '@mui/joy';

import { lineHeightChatTextMd } from '~/common/app.theme';
import { isChunkLoadError } from '~/common/util/errorUtils';
import { posthogCaptureException } from '~/common/components/3rdparty/PostHogAnalytics';

import { RenderMarkdownLite } from './RenderMarkdownLite';


const _liteDebugStyle: React.CSSProperties = { backgroundColor: 'red' }; // lite 'debug', when labsAdaptiveRendering is 'debug'


export interface RenderMarkdownRendererProps {
  content: string;

  /**
   * Optional flag to disable the markdown preprocessor. Useful for progressive
   * messages that are being rendered.
   *
   * OK: Very safe for Highlight/Strikeout.
   * MEH: A little loss for progressive rendering of inline formulas, but those regex are
   * extremely expensive and it's not worth to keep re-running them at every new input token.
   */
  disablePreprocessor?: boolean;

  /** Typed by a person, not generated: keeps line breaks, and indents and <tags> stay text. */
  userTextFlavor?: boolean;

  /**
   * Optionals function to enable interactive rendering of the markdown.
   * @param currentContent shall be equal to content
   * @param newContent the new markdown to put in place of the current content
   */
  replaceContent?: (currentContent: string, newContent: string) => void;

  /**
   * In-flux block measured by a render decay zone: receives the time spent parsing each render.
   */
  onParseCost?: (parseMs: number) => void;
}


/*
 * For performance reasons, we style this component here and copy the equivalent of 'props.sx' (the lineHeight) locally.
 */
const RenderMarkdownBox = styled(Box, { name: 'RenderMarkdownBox' })({
  // same look as the other RenderComponents
  marginInline: '0.75rem !important',                             // margin: 1.5 like other blocks
  // Embedded previews get their inset from the containing panel.
  '&[data-no-gutter]': { marginInline: '0 !important' },
  // this is here for usage outside of the Blocks (which set it in `sx`)
  lineHeight: lineHeightChatTextMd,

  // patch the CSS
  // fontFamily: `inherit !important`,                    // (not needed anymore, as CSS is under our control) use the default font family
  // '--color-canvas-default': 'transparent !important',  // (not needed anymore) remove the default background color
  '& table': { width: 'inherit !important' },           // un-break auto-width (tables have 'max-content', which overflows)
});


const DynamicMarkdownRenderer = React.lazy(() => import('./CustomMarkdownRenderer').catch((error: unknown) => {
  // the chunk did not arrive (network, timeout): lite markdown until the page reloads, in place of the boundary's forced reload;
  // a module that threw stays an error
  if (!isChunkLoadError(error)) throw error;
  console.warn('[RenderMarkdown] renderer did not load, rendering lite markdown:', error);
  posthogCaptureException(error, { agi_domain: 'client-chunk-fallback', agi_runtime: 'browser', component: 'RenderMarkdown' });
  return { default: (props: RenderMarkdownRendererProps) => <RenderMarkdownLite content={props.content} /> };
}));

export function RenderMarkdown(props: RenderMarkdownRendererProps & { lite?: boolean | 'debug', noGutter?: boolean, sx?: SxProps }) {
  const { lite, noGutter, sx, ...rendererProps } = props;
  return (
    <RenderMarkdownBox
      // NOTE: we moved the `className='markdown-body'` to the CustomMarkdownRenderer, as we have an extra div,
      // which would require to change CSS rules
      // className='markdown-body' /* NOTE: see GithubMarkdown.css for the dark/light switch, synced with Joy's */
      data-no-gutter={noGutter || undefined}
      sx={sx}
      style={lite === 'debug' ? _liteDebugStyle : undefined}
    >
      {lite ? (
        // in flux in a decayed render zone: skip the markdown parse
        <RenderMarkdownLite content={props.content} />
      ) : (
        <React.Suspense fallback={<div>Loading...</div>}>
          <DynamicMarkdownRenderer {...rendererProps} />
        </React.Suspense>
      )}
    </RenderMarkdownBox>
  );
}

export const RenderMarkdownMemo = React.memo(RenderMarkdown);
