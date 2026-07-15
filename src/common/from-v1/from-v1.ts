import { isBrowser } from '~/common/util/pwaUtils';


/**
 * Big-AGI V1 → V2 migration arrivals
 *
 * V1 (EOL, hosted instance offline on 2026-08-31) points its users here with
 * `utm_campaign=eol-v1` on every upgrade CTA. We remember the arrival, and offer
 * a guided import of their V1 backup file (which `importAgiStored_Auto` parses natively).
 */

const FROM_V1_LS_KEY = 'app-from-v1-arrival';
const FROM_V1_WINDOW_DAYS = 30; // keep offering the import for a month after arrival

export const FROM_V1_DISMISS_KEY = 'from-v1-import-banner';


/** Detect (and remember) an arrival from a V1 EOL link - call on any page mount, idempotent */
export function fromV1DetectArrival(): void {
  if (!isBrowser) return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('utm_campaign') !== 'eol-v1') return;
    if (!localStorage.getItem(FROM_V1_LS_KEY)) {
      localStorage.setItem(FROM_V1_LS_KEY, String(Date.now()));
    }
  } catch {
    // ignore - storage unavailable
  }
}

/** True when the user arrived from V1 within the offer window */
export function fromV1ArrivedRecently(): boolean {
  if (!isBrowser) return false;
  try {
    const arrivedAt = parseInt(localStorage.getItem(FROM_V1_LS_KEY) || '0', 10);
    return !!arrivedAt && (Date.now() - arrivedAt) < FROM_V1_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
