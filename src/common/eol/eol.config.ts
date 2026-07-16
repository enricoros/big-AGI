import { sendGAEvent } from '@next/third-parties/google';

import { hasGoogleAnalytics } from '~/common/components/GoogleAnalytics';
import { clientUtmSource, isBrowser } from '~/common/util/pwaUtils';


/**
 * Big-AGI v1 End-of-Life configuration
 *
 * V1 reached end-of-life in October 2025 (v1.16.11 is the final release).
 * The hosted v1 instance (*.big-agi.com) goes OFFLINE on August 15, 2026,
 * and from that date automatically redirects to the new Big-AGI.
 * Users shall export their data and continue on the new Big-AGI.
 */

// the hosted v1 service goes offline on this date (Pacific) and auto-redirects to the new Big-AGI
const EOL_HOSTED_OFFLINE_DATE = new Date('2026-08-15T00:00:00-07:00');
export const EOL_HOSTED_OFFLINE_TEXT = 'August 15, 2026';
export const EOL_HOSTED_OFFLINE_TEXT_SHORT = 'Aug 15';

// destination: straight into the new app - `utm_campaign=eol-v1` is the marker the new app keys on
export const eolUpgradeUrl = 'https://app.big-agi.com' + clientUtmSource('eol-v1');
export const eolSupportUrl = 'https://form.typeform.com/to/nLf8gFmx?utm_source=big-agi-1&utm_medium=app&utm_campaign=eol-v1';

// snooze mechanics: the drawer notice can be snoozed, but keeps coming back
const EOL_SNOOZE_KEY = 'eolNoticeSnoozedUntil';
const EOL_SNOOZE_DAYS = 7;


/// deployment ///

/** true when running on our hosted instance (get.big-agi.com, etc.) - which is the deployment going offline */
export function eolIsHostedInstance(): boolean {
  return isBrowser && /(^|\.)big-agi\.com$/i.test(window.location.hostname);
}

/** full days until the hosted instance goes offline (0 when past) */
export function eolDaysRemaining(): number {
  return Math.max(0, Math.ceil((EOL_HOSTED_OFFLINE_DATE.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/** true once the offline date has passed */
export function eolIsPastOffline(): boolean {
  return Date.now() >= EOL_HOSTED_OFFLINE_DATE.getTime();
}

/** [hosted] past the offline date: this instance hands over to the new Big-AGI */
export function eolShouldRedirectNow(): boolean {
  return eolIsHostedInstance() && eolIsPastOffline();
}


/// composer escalation (final week) ///

const EOL_COMPOSER_OVERRIDE_KEY = 'eolComposerOverride';

/** [hosted] in the final week the Composer is replaced by the migration banner */
export function eolShouldBlockComposer(): boolean {
  return eolIsHostedInstance() && eolDaysRemaining() <= 7;
}

/** the user chose to keep composing for the rest of this session */
export function eolComposerSessionOverride(): boolean {
  try {
    return sessionStorage.getItem(EOL_COMPOSER_OVERRIDE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function eolComposerAllowThisSession(): void {
  try {
    sessionStorage.setItem(EOL_COMPOSER_OVERRIDE_KEY, 'true');
  } catch {
    // ignore
  }
}


/// snooze ///

/** snoozing is allowed up to the final week - after that the notice is permanent */
export function eolCanSnooze(): boolean {
  return eolDaysRemaining() > 7;
}

export function eolIsSnoozed(): boolean {
  if (!eolCanSnooze()) return false; // final week: ignore any prior snooze
  try {
    const until = parseInt(localStorage.getItem(EOL_SNOOZE_KEY) || '0', 10);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function eolSnooze(): void {
  try {
    localStorage.setItem(EOL_SNOOZE_KEY, String(Date.now() + EOL_SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}


/// analytics (GA4 - PostHog is added on the hosted branch) ///

export type EolEventName = 'eol_notice_shown' | 'eol_wizard_open' | 'eol_export' | 'eol_open_v2' | 'eol_snooze' | 'eol_composer_blocked';

export function eolTrackEvent(event: EolEventName, origin: string): void {
  hasGoogleAnalytics && sendGAEvent('event', event, { origin });
}
