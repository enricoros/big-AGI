import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Typography, useColorScheme } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useAgiFixupCode } from '~/modules/aifn/agicodefixup/useAgiFixupCode';

import { asyncCanvasToBlobWithValidation } from '~/common/util/canvasUtils';
import { themeFontFamilyCss } from '~/common/app.theme';

import type { IRenderHandle } from './IRenderHandle';
import { ChartConfiguration, ChartInstanceType, chartJSApplyTheme, chartJSFixupGeneratedObject, chartJSPixelRatio, useDynamicChartJS } from './useDynamicChartJS';


const chartContainerSx: SxProps = {
  // required by Chart.js
  position: 'relative',

  // to try to regain the chart size after shrinking
  width: '100%',
  // to better get resized when fullscreen
  flex: 1,

  // center
  display: 'grid',
  justifyContent: 'center',

  // limit height of the canvas or it can too large easily
  '& canvas': {
    // this would work, but slows things down for some reasons
    // display: 'inline!important',
    maxHeight: '640px',
  },
};


export const RenderCodeChartJS = React.forwardRef(function RenderCodeChartJS(props: {
  chartJSCode: string;
  onReplaceInCode?: (search: string, replace: string) => boolean;
}, ref: React.Ref<IRenderHandle>) {

  // state
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [fixupFailure, setFixupFailure] = React.useState<{ code: string; message: string } | null>(null);
  const fixupError = fixupFailure?.code === props.chartJSCode ? fixupFailure.message : null;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = React.useRef<ChartInstanceType | null>(null);

  // external state
  const isDarkMode = useColorScheme().mode === 'dark';
  const { chartJS, loadingError, isLoading: isLibraryLoading } = useDynamicChartJS();

  // immediate parsing (note, this could be done with useEffect and state, but we save a render cycle)
  const parseResult = React.useMemo(() => {
    try {
      const config = JSON.parse(props.chartJSCode) as ChartConfiguration;
      if (!config || typeof config !== 'object' || Array.isArray(config))
        throw new Error('Expected a Chart.js configuration object.');
      chartJSFixupGeneratedObject(config);
      return { chartConfig: config, parseError: null };
    } catch (error: any) {
      return { chartConfig: null, parseError: error.message as string || 'Unknown error.' };
    }
  }, [props.chartJSCode]);

  // AI functions
  const { isFetching, refetch } = useAgiFixupCode('chartjs-issue', false, props.chartJSCode, parseResult.parseError);


  // Rendering
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!chartJS || !parseResult.chartConfig || !canvas) return;

    try {
      // Destroy previous chart instance if it exists
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;

      // React to the theme
      chartJSApplyTheme(chartJS, isDarkMode);

      // Create new chart instance
      chartInstanceRef.current = new chartJS(canvas, parseResult.chartConfig);
      setRenderError(null);

    } catch (error: any) {
      // A failed constructor can still register a chart and reserve the canvas.
      chartJS.getChart(canvas)?.destroy();
      setRenderError('Error rendering chart: ' + (error.message || 'Unknown error.'));
    }

    // Cleanup on unmount
    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, [chartJS, parseResult.chartConfig, isDarkMode]);


  // Expose control methods
  React.useImperativeHandle(ref, () => ({
    renderAsPNGBlob: async (transparentBackground: boolean) => {

      const chartCanvas = canvasRef.current;
      if (!chartCanvas || !chartInstanceRef.current || renderError || parseResult.parseError) return null;

      // Create a new canvas
      const pngCanvas = document.createElement('canvas');
      pngCanvas.width = chartCanvas.width;
      pngCanvas.height = chartCanvas.height;
      const ctx = pngCanvas.getContext('2d', { alpha: true });
      if (!ctx) {
        // Fallback to the original chart if we can't create a new canvas to draw on
        try {
          const { blob: chartBlob } = await asyncCanvasToBlobWithValidation(chartCanvas, 'image/png', undefined);
          return !chartBlob ? null : { blob: chartBlob, prefix: 'chart' };
        } catch (error) {
          console.error('Error creating PNG blob from chart canvas:', error);
          return null;
        }
      }

      // Omit the background layer
      if (!transparentBackground) {
        // ctx.fillStyle = isDarkMode ? '#171A1C' : '#F0F4F8';
        ctx.fillStyle = isDarkMode ? '#000' : '#FFF';
        ctx.fillRect(0, 0, pngCanvas.width, pngCanvas.height);
      }

      // Draw the chart
      ctx.drawImage(chartCanvas, 0, 0);

      // Great work Big-AGI!
      const pr = chartJSPixelRatio();
      ctx.font = `${10 * pr}px ${themeFontFamilyCss}`;
      ctx.fillStyle = isDarkMode ? '#9FA6AD' : '#555E68';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Big-AGI.com', 7 * pr, pngCanvas.height - 6 * pr);
      try {
        const { blob: annotatedBlob } = await asyncCanvasToBlobWithValidation(pngCanvas, 'image/png', undefined);
        return !annotatedBlob ? null : { blob: annotatedBlob, prefix: 'chart' };
      } catch (error) {
        console.error('Error creating PNG blob from chart canvas:', error);
        return null;
      }
    },
  }), [isDarkMode, parseResult.parseError, renderError]);


  // handlers

  const { onReplaceInCode } = props;

  const handleChartRegenerate = React.useCallback(async () => {
    if (!onReplaceInCode) return;
    setFixupFailure(null);
    refetch().then((result) => {
      if (result.data) {
        // Keep a closing Markdown fence on its own line when replacing the block body.
        const correctedCode = props.chartJSCode.endsWith('\n') && !result.data.endsWith('\n') ? result.data + '\n' : result.data;
        onReplaceInCode(props.chartJSCode, correctedCode);
      } else if (result.error)
        setFixupFailure({ code: props.chartJSCode, message: result.error.message || 'Unknown error.' });
      else
        setFixupFailure({ code: props.chartJSCode, message: 'Unknown Fixup error.' });
    });
  }, [onReplaceInCode, props.chartJSCode, refetch]);


  // Handle all the non-chart states
  switch (true) {
    case isLibraryLoading:
      // DISABLED: reduce visual noise
      // return <Typography level='body-xs'>Loading Chart.js...</Typography>;
      return null;
    case !!loadingError:
      return <Typography level='body-sm' color='danger'>{loadingError}</Typography>;
    case !!parseResult.parseError || !!fixupError:
      return (
        <Box sx={{ display: 'grid', gap: 1, justifyItems: 'start' }}>
          {/* Here we play like if we won't get the callback, but we will */}
          {/*{props.onReplaceInCode && (*/}
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
            {isFetching ? 'Fixing Chart... ' : props.onReplaceInCode ? 'Attempt Fix' : 'Detected Issue'}
          </Button>
          {/*)}*/}
          {fixupError ? (
            <Typography level='body-sm' color='warning' sx={{ ml: 0.5 }}>
              Error fixing chart: {fixupError}
            </Typography>
          ) : (parseResult.parseError && !isFetching) && (
            <Typography level='body-xs' sx={{ ml: 0.5 }}>
              Invalid Chart.js input: {parseResult.parseError}
            </Typography>
          )}
        </Box>
      );

    default:
      // ready: the chart below
      break;
  }

  // Render the chart
  return (
    <Box sx={chartContainerSx}>
      {!!renderError && <Typography level='body-sm' color='warning' variant='plain'>{renderError}</Typography>}
      {/* Keep the canvas mounted so a corrected configuration can recover from a rendering error. */}
      <canvas ref={canvasRef} style={renderError ? { display: 'none' } : undefined} />
    </Box>
  );
});
