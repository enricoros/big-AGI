import { track } from '@vercel/analytics/server';

import { env } from '~/server/env.mjs';


// all the backend analytics flags
type BackendAnalyticsFlag =
  | 'domain';   // logs which domain the initial (capabilities) request is sent to


const checkAnalyticsFlag = (flag: BackendAnalyticsFlag): boolean =>
  env.BACKEND_ANALYTICS?.includes(flag) || false;


export function analyticsListCapabilities(backendHostName: string) {
  if (checkAnalyticsFlag('domain')) {
    // Note: fire-and-forget
    void track('backend-domain', {
      hostname: backendHostName,
      vercel_url: process.env.VERCEL_URL || 'no-vercel',
    });
  }
}