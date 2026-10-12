// Vendored from https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz (Apache-2.0).
// Update the asset, version and integrity together. The mini build supports XLSX, not legacy XLS.
const XLSX_VERSION = '0.20.3';
const XLSX_SCRIPT = '/vendor/sheetjs/xlsx-0.20.3.mini.min.js';
const XLSX_INTEGRITY = 'sha384-NG/W3xvO3ynQEcDQYIOcZTXRtwUs83cLv1FIl9PuqWPDuNhsMRF6wutlNLFwlb71';

/** Only the SheetJS surface used by the converter; no npm or bundled parser dependency. */
export interface XlsxAPI {
  version: string;
  read: (input: ArrayBuffer, options: { type: 'array', cellHTML: boolean }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_csv: (sheet: unknown, options: { blankrows: boolean }) => string;
  };
}

declare global {
  interface Window {
    XLSX?: XlsxAPI;
  }
}

let loading: Promise<XlsxAPI> | null = null;

export function loadXlsx(): Promise<XlsxAPI> {
  if (typeof window === 'undefined')
    return Promise.reject(new Error('XLSX conversion requires a browser.'));

  if (!loading) {
    loading = new Promise<XlsxAPI>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_SCRIPT;
      script.integrity = XLSX_INTEGRITY;
      script.crossOrigin = 'anonymous';
      script.async = true;

      const timeout = setTimeout(() => fail(), 30_000);
      const cleanup = () => {
        clearTimeout(timeout);
        script.onload = null;
        script.onerror = null;
      };
      const fail = () => {
        cleanup();
        script.remove();
        reject(new Error('Could not load the XLSX reader. Please try attaching the file again.'));
      };
      script.onerror = fail;
      script.onload = () => {
        const api = window.XLSX;
        if (api?.version !== XLSX_VERSION || typeof api.read !== 'function' || typeof api.utils?.sheet_to_csv !== 'function') {
          fail();
          return;
        }
        cleanup();
        resolve(api);
      };
      try {
        document.head.appendChild(script);
      } catch {
        fail();
      }
    }).catch(error => {
      loading = null;
      throw error;
    });
  }
  return loading;
}
