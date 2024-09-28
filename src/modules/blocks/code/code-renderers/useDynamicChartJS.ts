/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Hooks, state centralizer and utility functions to load Chart.js dynamically
 * from CDN instead of bundling it with the app.
 */

import * as React from 'react';
import { create } from 'zustand';

import { themeFontFamilyCss } from '~/common/app.theme';


// Configuration
const CHARTJS_VERSION = '4.4.4';
const CHARTJS_CDN_URL = `https://cdn.jsdelivr.net/npm/chart.js@${CHARTJS_VERSION}/dist/chart.umd.js`;
const CHARTJS_SCRIPT_ID = 'chartjs-cdn';


// Minimal type definitions for Chart.js - as of 4.4.4

interface ChartConstructorType {
  defaults: ChartDefaults;

  new(context: CanvasRenderingContext2D | HTMLCanvasElement, config: ChartConfiguration): ChartInstanceType;
}

interface ChartDefaults {
  color?: string;
  devicePixelRatio?: number;
  font?: {
    family: string;
    size: number;
  };
  maintainAspectRatio?: boolean;
  responsive?: boolean;
  plugins?: any,

  // [key: string]: any;
}

export interface ChartConfiguration {
  type?: string;
  data?: any;
  options?: ChartDefaults;

  // [key: string]: any;
}

export interface ChartInstanceType {
  destroy(): void;
}


// Code manipulation functions

function _chartJSInitializeDefaults(Chart: ChartConstructorType): ChartConstructorType {

  // Use the application fonts
  if (Chart.defaults.font) {
    Chart.defaults.font.family = themeFontFamilyCss;
    Chart.defaults.font.size = 13;
  }

  // Responsive defaults, to autosize the chart while keeping the aspect ratios
  Chart.defaults.maintainAspectRatio = true; // defaults to 1 for polar and so, 2 for bars and more
  Chart.defaults.responsive = true; // re-draw on resize

  // Set devicePixelRatio to double, to enable downloading/zooming of charts
  // FIXME: there's an issue here, by overriding the default (which invokes getDevicePixelRatio) we stop
  //        the re-render when a window is moved to a different screen with different DPI. In some sense
  //        we are anchoring the DPR to the first screen's x 2.
  if (window.devicePixelRatio)
    Chart.defaults.devicePixelRatio = chartJSPixelRatio();

  // Change the default padding for the title
  Chart.defaults.plugins.title.padding = { top: 8, bottom: 16 };

  return Chart;
}

export function chartJSPixelRatio() {
  return 2 * (window.devicePixelRatio || 1);
}

export function chartJSApplyTheme(Chart: ChartConstructorType, isDarkMode: boolean) {
  // responsive color
  Chart.defaults.color = isDarkMode ? '#CDD7E1' : '#32383E';
}

export function chartJSFixupGeneratedObject(chartConfig: ChartConfiguration): void {
  // Do not remove Font, allow for override
  // delete chartConfig?.options?.font;
  // Remove responsive options - we handle this ourselves by default
  delete chartConfig?.options?.responsive;
  delete chartConfig?.options?.maintainAspectRatio;
  delete chartConfig?.options?.devicePixelRatio;
}


// Singleton promise for loading Chart.js
let chartJSPromise: Promise<ChartConstructorType> | null = null;

function loadCDNScript(): Promise<ChartConstructorType> {
  // Resolve immediately if already loaded
  if ((window as any).Chart)
    return Promise.resolve(_chartJSInitializeDefaults((window as any).Chart));

  // If loading has already started, return the existing promise
  if (chartJSPromise) return chartJSPromise;

  // Ensure the API definitions from package.json match the CDN loaded version
  // NOTE: Disabled because we are not using the package.json version anymore, we replaced the API
  // if (devDependencies['chart.js'] !== CHARTJS_VERSION)
  //   return Promise.reject(new Error(`Chart.js version mismatch: loaded ${CHARTJS_VERSION}, expected ${devDependencies['chart.js']}.`));

  chartJSPromise = new Promise((resolve, reject) => {

    // Create or reuse a script DOM element
    const script = document.createElement('script');
    script.id = CHARTJS_SCRIPT_ID;
    script.src = CHARTJS_CDN_URL;
    script.async = true;

    script.onload = () => {
      if ((window as any).Chart) resolve(_chartJSInitializeDefaults((window as any).Chart));
      else reject(new Error('Chart.js failed to load.'));
    };

    script.onerror = () => {
      console.log(`[DEV] error loading Chart.js from: ${CHARTJS_CDN_URL}`);
      reject(new Error('Failed to load Chart.js from CDN.'));
    };

    document.head.appendChild(script);
  });

  return chartJSPromise;
}


// Store: we share the state across multiple useChartJS hooks
interface ChartApiStore {

  // state
  chartJS: ChartConstructorType | null;
  loadingError: string | null;
  isLoading: boolean;

  // actions
  loadChartJS: () => void;

}

const useChartApiStore = create<ChartApiStore>((set, get) => ({

  // initial state
  chartJS: null,
  loadingError: null,
  isLoading: false,

  // actions
  loadChartJS: () => {

    // Prevent redundant calls
    const { chartJS, loadingError, isLoading } = get();
    if (chartJS || loadingError || isLoading) return;
    set({ isLoading: true });

    // Load and save the constructor to the store
    loadCDNScript()
      .then((Chart) =>
        set({ chartJS: Chart, loadingError: null, isLoading: false }),
      )
      .catch((error) =>
        set({ chartJS: null, loadingError: error.message, isLoading: false }),
      );
  },

}));


/**
 * Hook to load Chart.js and make it available to the component.
 */
export function useDynamicChartJS() {
  const { chartJS, loadingError, isLoading } = useChartApiStore();

  // Load the library upon first access
  const needsLoading = !chartJS && !loadingError && !isLoading;
  React.useEffect(() => {
    if (needsLoading)
      useChartApiStore.getState().loadChartJS();
  }, [needsLoading]);

  return { chartJS, loadingError, isLoading };
}
