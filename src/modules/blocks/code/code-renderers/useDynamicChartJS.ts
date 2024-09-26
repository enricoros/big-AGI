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
  devicePixelRatio?: number;
  font?: {
    family: string;
    size: number;
  };
  maintainAspectRatio?: boolean;
  responsive?: boolean;

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

export function fixupChartJSObject(chartConfig: ChartConfiguration): void {
  // Do not remove Font, allow for override
  // delete chartConfig?.options?.font;
  // Remove responsive options - we handle this ourselves by default
  delete chartConfig?.options?.responsive;
  delete chartConfig?.options?.maintainAspectRatio;
  delete chartConfig?.options?.devicePixelRatio;
}

function _initializeChartJS(Chart: ChartConstructorType): ChartConstructorType {
  Chart.defaults.font = {
    ...Chart.defaults.font,
    family: themeFontFamilyCss,
    size: 13,
  };
  Chart.defaults.maintainAspectRatio = true; // defaults to 1 for polar and so, 2 for bars and more
  Chart.defaults.responsive = true; // re-draw on resize
  // Chart.defaults.layout.autoPadding = true; // default padding
  if (window.devicePixelRatio)
    Chart.defaults.devicePixelRatio = 2 * window.devicePixelRatio;
  return Chart;
}


// Singleton promise for loading Chart.js
let chartJSPromise: Promise<ChartConstructorType> | null = null;

function loadCDNScript(): Promise<ChartConstructorType> {
  // Resolve immediately if already loaded
  if ((window as any).Chart)
    return Promise.resolve(_initializeChartJS((window as any).Chart));

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
      if ((window as any).Chart) resolve(_initializeChartJS((window as any).Chart));
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
