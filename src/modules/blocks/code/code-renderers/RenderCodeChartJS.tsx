import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Typography, useColorScheme } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useAgiFixupCode } from '~/modules/aifn/agicodefixup/useAgiFixupCode';

import { asyncCanvasToBlob } from '~/common/util/canvasUtils';
import { themeFontFamilyCss } from '~/common/app.theme';

import { ChartConfiguration, ChartInstanceType, chartJSApplyTheme, chartJSFixupGeneratedObject, chartJSPixelRatio, useDynamicChartJS } from './useDynamicChartJS';


const chartContainerSx: SxProps = {
  // required by Chart.js
  position: 'relative',

  // to try to regain the chart size after shrinking
  width: '100%',
  // to better get resized when fullscreen
  flex: 1,

  // limit height of the canvas or it can too large easily
  '& canvas': {
    // width: '100% !important',
    // height: '100%',
    // minHeight: '320px',
    maxHeight: '640px',
  },
};


// Exposed API
export type RenderCodeChartJSHandle = {
  getChartPNG: (transparentBackground: boolean) => Promise<Blob | null>;
};


export const RenderCodeChartJS = React.forwardRef(function RenderCodeChartJS(props: {
  chartJSCode: string;
  onReplaceInCode?: (search: string, replace: string) => boolean;
}, ref: React.Ref<RenderCodeChartJSHandle>) {

  // state
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [fixupError, setFixupError] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = React.useRef<ChartInstanceType | null>(null);

  // external state
  const isDarkMode = useColorScheme().mode === 'dark';
  const { chartJS, loadingError, isLoading: isLibraryLoading } = useDynamicChartJS();

  // immediate parsing (note, this could be done with useEffect and state, but we save a render cycle)
  const parseResult = React.useMemo(() => {
    try {
      const config = JSON.parse(props.chartJSCode) as ChartConfiguration;
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
    if (!chartJS || !parseResult.chartConfig || !canvasRef.current) return;

    try {
      // Destroy previous chart instance if it exists
      chartInstanceRef.current?.destroy();

      // React to the theme
      chartJSApplyTheme(chartJS, isDarkMode);

      // Create new chart instance
      chartInstanceRef.current = new chartJS(canvasRef.current, parseResult.chartConfig);
      setRenderError(null);

    } catch (error: any) {
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
    getChartPNG: async (transparentBackground: boolean) => {
      const chartCanvas = canvasRef.current;
      if (!chartCanvas) return null;

      // Create a new canvas
      const pngCanvas = document.createElement('canvas');
      pngCanvas.width = chartCanvas.width;
      pngCanvas.height = chartCanvas.height;
      const ctx = pngCanvas.getContext('2d', { alpha: true });
      if (!ctx)
        return await asyncCanvasToBlob(chartCanvas, 'image/png');

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
      return await asyncCanvasToBlob(pngCanvas, 'image/png');
    },
  }), [isDarkMode]);


  // handlers

  const { onReplaceInCode } = props;

  const handleChartRegenerate = React.useCallback(async () => {
    if (!onReplaceInCode) return;
    setFixupError(null);
    refetch().then((result) => {
      if (result.data)
        onReplaceInCode(props.chartJSCode, result.data);
      else if (result.error)
        setFixupError(result.error.message || 'Unknown error.');
      else
        setFixupError('Unknown Fixup error.');
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
    case !!renderError:
      return <Typography level='body-sm' color='warning' variant='plain'>{renderError}</Typography>;
  }

  // Render the chart
  return (
    <Box sx={chartContainerSx}>
      <canvas ref={canvasRef} />
    </Box>
  );
});