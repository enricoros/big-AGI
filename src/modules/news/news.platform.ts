// Codeline seam: the one News file that differs between codelines. Open-source builds ask as 'open',
// never ask for previews, honor the build-time remote-feeds switch, and take the after-build policy
// from the deployment type.

import { Release } from '~/common/app.release';

import type { NewsAudience } from './news.feed';


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


/** What a build does about the changes it does not have (dated after it, past the grace) */
export interface NewsAfterBuildPolicy {
  band: boolean;         // the hub lists them, folded, under "N changes since this build"
  hint: string | null;   // under that title: what gets them; null when there is nothing to do yet
  action?: { label: string, onClick: () => void }; // a button on the band, e.g. the hosted codeline's gated reload
  nudge: boolean;        // the empty-chat row says the build is behind, once it is buildBehindNudgeDays old
}

// Docker images are cut every few months: the fact, no instruction, no nudge. A fork on Vercel or a
// local build redeploys in minutes: the action, and the nudge.
const _deploymentType = Release.buildInfo('frontend').deploymentType ?? 'local';
const _afterBuild: NewsAfterBuildPolicy =
  _deploymentType === 'docker' ? { band: true, hint: null, nudge: false }
    : _deploymentType.startsWith('vercel') ? { band: true, hint: 'Sync your fork to redeploy', nudge: true }
      : { band: true, hint: 'Pull and rebuild', nudge: true };

/** The after-build policy. A hook so the hosted codeline can follow its newer-build signal. */
export function useNewsAfterBuild(): NewsAfterBuildPolicy {
  return _afterBuild;
}
