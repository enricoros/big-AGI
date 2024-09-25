import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Typography } from '@mui/joy';

import { ChartConstructorType, fixupChartJSObject, useDynamicChartJS } from './useDynamicChartJS';


const chartContainerSx: SxProps = {
  // required by Chart.js
  position: 'relative',

  // width: '100%',

  // limit height of the canvas or it can too large easily
  '& canvas': {
    // width: '100% !important',
    // height: '100%',
    // minHeight: '320px',
    maxHeight: '640px',
  },
};


export function RenderCodeChartJS(props: {
  chartJSCode: string;
  onReplaceInCode?: (search: string, replace: string) => boolean;
}) {

  // state
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = React.useRef<ChartConstructorType | null>(null);

  // external state
  const { chartJS, loadingError, isLoading: isLibraryLoading } = useDynamicChartJS();


  // immediate parsing (note, this could be done with useEffect and state, but we save a render cycle)
  const parseResult = React.useMemo(() => {
    try {
      const config = JSON.parse(props.chartJSCode) as ChartConstructorType['config'];
      fixupChartJSObject(config);
      return { chartConfig: config, parseError: null };
    } catch (error: any) {
      return { chartConfig: null, parseError: 'Invalid Chart.js input: ' + (error.message || 'Unknown error.') };
    }
  }, [props.chartJSCode]);


  // Rendering
  React.useEffect(() => {
    if (!chartJS || !parseResult.chartConfig || !canvasRef.current) return;

    try {
      // Destroy previous chart instance if it exists
      chartInstanceRef.current?.destroy();

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
  }, [chartJS, parseResult.chartConfig]);


  // Handle all the non-chart states
  switch (true) {
    case isLibraryLoading:
      // DISABLED: reduce visual noise
      // return <Typography level='body-xs'>Loading Chart.js...</Typography>;
      return null;
    case !!loadingError:
      return <Typography level='body-sm' color='danger'>{loadingError}</Typography>;
    case !!parseResult.parseError:
      return <Typography level='body-sm' color='warning'>{parseResult.parseError}</Typography>;
    case !!renderError:
      return <Typography level='body-sm' color='warning' variant='plain'>{renderError}</Typography>;
  }

  // Render the chart
  return (
    <Box sx={chartContainerSx}>
      <canvas ref={canvasRef} />
    </Box>
  );
}