// Codeline seam: the one News file that differs between codelines. Open-source builds ask as 'open',
// never ask for previews, and honor the build-time remote-feeds switch.

import { Release } from '~/common/app.release';

import type { NewsAudience } from './news.feed';


export const NewsPlatform = {
  /** Shown next to the changes this build does not have yet */
  afterBuildHint: Release.buildInfo('frontend').deploymentType === 'docker'
    ? 'Pull the latest image to get them.'
    : 'Update your deployment to get them.',
} as const;

// NEXT_PUBLIC_BIG_AGI_REMOTE_FEEDS=off at build time: the app never contacts big-agi.com on its own
const _audience: NewsAudience = {
  off: process.env.NEXT_PUBLIC_BIG_AGI_REMOTE_FEEDS === 'off',
  tier: 'open',
  channel: null,
};

/** Who asks the feeds. A hook so the hosted codeline can read the user's plan. */
export function useNewsAudience(): NewsAudience {
  return _audience;
}
