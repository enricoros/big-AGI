import * as React from 'react';
import { create } from 'zustand';
import type { Chart as ChartType } from 'chart.js/auto';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography } from '@mui/joy';
import { patchSvgString } from '~/modules/blocks/code/code-renderers/RenderCodeSVG';
import { diagramErrorSx, diagramSx } from '~/modules/blocks/code/code-renderers/RenderCodePlantUML';

// configuration
/**
 * We are loading Chart.js from the CDN (and spending all the work to dynamically load it
 * and strong type it), because the Chart.js dependencies (npm i chart.js) are too heavy
 * and would slow down development for everyone.
 */
const CHARTJS_CDN_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js';
const CHARTJS_ERROR_PREFIX = '[Chart.js]';


// Store to react to loading of the library

interface ChartJSApiState {
  chartJSAPI: any /* FIXME */ | null;
  loadingError: string | null;
}

export const useChartJSStore = create<ChartJSApiState>(() => ({
  chartJSAPI: null,
  loadingError: null,
}));


// Dynamic loading of the Chart.js library

// extend the Window interface, to allow for the mermaid API to be found
// declare global {
//   // noinspection JSUnusedGlobalSymbols
//   interface Window {
//     Chart: ;
//   }
// }

let loadingStarted = false;

export function useChartJSLoader() {
  const { chartJSAPI, loadingError } = useChartJSStore();

  React.useEffect(() => {
    if (!chartJSAPI && !loadingError && !loadingStarted) {
      loadingStarted = true;
      const script = document.createElement('script');
      script.src = CHARTJS_CDN_URL;
      script.async = true;
      script.onload = () => {
        if (window.Chart) {
          useChartJSStore.setState({ chartJSAPI: window.Chart, loadingError: null });
        } else {
          useChartJSStore.setState({ chartJSAPI: null, loadingError: 'Chart.js failed to load.' });
        }
      };
      script.onerror = () => {
        useChartJSStore.setState({ chartJSAPI: null, loadingError: 'Failed to load Chart.js library.' });
      };
      document.head.appendChild(script);
    }
  }, [chartJSAPI, loadingError]);

  return { chartJSAPI, loadingError };
}





interface RenderCodeChartJSProps {
  chartJSCode: string;
  fitScreen: boolean;
}

export function RenderCodeChartJS({ chartJSCode, fitScreen }: RenderCodeChartJSProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = React.useRef<import('chart.js').Chart | null>(null);

  const { chartJSAPI, loadingError } = useChartJSLoader();

  const [chartConfig, setChartConfig] = React.useState<import('chart.js').ChartConfiguration | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [renderError, setRenderError] = React.useState<string | null>(null);

  // Parse the Chart.js configuration
  React.useEffect(() => {
    try {
      const config = JSON.parse(chartJSCode) as import('chart.js').ChartConfiguration;
      setChartConfig(config);
      setParseError(null);
    } catch (error: any) {
      console.error('Chart.js configuration parse error:', error);
      setChartConfig(null);
      setParseError('Invalid Chart.js configuration: ' + (error.message || 'Unknown error.'));
    }
  }, [chartJSCode]);

  // Render the chart
  React.useEffect(() => {
    if (chartJSAPI && chartConfig && canvasRef.current) {
      try {
        // Destroy previous chart instance
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }

        // Create new chart instance
        chartInstanceRef.current = new chartJSAPI(canvasRef.current, chartConfig);
        setRenderError(null);
      } catch (error: any) {
        console.error('Chart.js rendering error:', error);
        setRenderError('Error rendering chart: ' + (error.message || 'Unknown error.'));
      }
    }

    return () => {
      // Cleanup on unmount
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [chartJSAPI, chartConfig]);

  // Handle error messages
  if (loadingError) {
    return (
      <Typography color='danger' variant='plain' sx={{ mb: 2 }}>
        {loadingError}
      </Typography>
    );
  }

  if (parseError) {
    return (
      <Typography color='danger' variant='plain' sx={{ mb: 2 }}>
        {parseError}
      </Typography>
    );
  }

  if (renderError) {
    return (
      <Typography color='danger' variant='plain' sx={{ mb: 2 }}>
        {renderError}
      </Typography>
    );
  }

  // Render the chart
  return (
    <Box sx={fitScreen ? { width: '100%', height: '100%' } : {}}>
      <canvas ref={canvasRef} />
    </Box>
  );
}