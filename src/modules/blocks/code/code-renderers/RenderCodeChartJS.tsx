import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useAgiFixupCode } from '~/modules/aifn/agicodefixup/useAgiFixupCode';

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
  const [fixupError, setFixupError] = React.useState<string | null>(null);
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
          {props.onReplaceInCode && (
            <Button
              size='sm'
              variant='outlined'
              color='success'
              onClick={handleChartRegenerate}
              loading={isFetching}
              loadingPosition='end'
              sx={{
                minWidth: 160,
                backgroundColor: 'background.surface',
                boxShadow: 'xs',
              }}
              endDecorator={<AutoAwesomeIcon />}
            >
              {isFetching ? 'Fixing Chart...' : 'Fix Chart'}
            </Button>
          )}
          {fixupError ? (
            <Typography level='body-sm' color='danger'>
              Error fixing chart: {fixupError}
            </Typography>
          ) : (parseResult.parseError && !isFetching) && (
            <Typography level='body-xs'>
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
}