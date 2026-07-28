import * as React from 'react';

import { BaseProduct, Release } from '~/common/app.release';
import { isPwa } from '~/common/util/pwaUtils';

import '../../logic/sherpa.css';

import { instanceLockRequestTransfer, useInstanceLock } from './instanceLock';


/**
 * Full-screen loading placeholder, shared by the providers that gate the app before it renders
 * (single-instance, cloud fabric): the pre-hydration HTML and the first post-hydration frames are
 * the same markup - no flash, no mismatch. Styles in sherpa.css, imported above.
 */
export function SherpaLoading(props: { stage: string }) {
  return (
    <div className='sherpa' data-stage={props.stage}>
      <p className='state-loading'>
        <span className='brace'><svg viewBox='0 0 256 256'><path d='M160,40A88.09,88.09,0,0,0,81.29,88.67,64,64,0,1,0,72,216h88a88,88,0,0,0,0-176Zm0,160H72a48,48,0,0,1,0-96c1.1,0,2.2,0,3.29.11A88,88,0,0,0,72,128a8,8,0,0,0,16,0,72,72,0,1,1,72,72Z'></path></svg></span>
        <span className='ellipsis'>...</span>
      </p>
    </div>
  );
}


// the reveal must happen before paint (no flash), and useLayoutEffect must not run on the server
const useRevealEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;


export const ProviderSingleTab = (props: { children: React.ReactNode }) => {

  // state
  const { role, peer, wiping } = useInstanceLock();
  const [revealed, setRevealed] = React.useState(false);

  // the server and the first client render both show the placeholder, so hydration always matches;
  // we reveal in a layout effect, by which time the lock verdict has (almost always) landed
  useRevealEffect(() => setRevealed(true), []);

  // version comparison
  const versionComparison = React.useMemo(() => {
    const myBuildTimestamp = Release.buildInfo('frontend').timestamp;
    if (!peer?.buildTimestamp || !myBuildTimestamp) return null;
    const peerTime = new Date(peer.buildTimestamp).getTime();
    const myTime = new Date(myBuildTimestamp).getTime();
    if (isNaN(peerTime) || isNaN(myTime)) return null;
    if (myTime > peerTime) return 'newer';
    if (myTime < peerTime) return 'older';
    return 'same';
  }, [peer?.buildTimestamp]);

  // undecided: never mount the app speculatively - a follower would boot the storage/sync stack just
  // to tear it down. Web Locks answer in ~1ms; the non-secure-context fallback takes a probe round-trip.
  if (!revealed || role === null)
    return <SherpaLoading stage='single-tab' />;

  if (role === 'leader')
    return props.children;

  const otherWindow = !isPwa() ? 'tab or window' : 'window';
  const bestEffort = !navigator.locks; // safe here: this branch never renders on the server (role is null there)
  const work = peer?.work ?? null;
  const hasWork = !!work && (work.ongoingOperations > 0 || work.openBeams > 0 || work.drafts > 0);
  const unresponsive = peer?.responsive === false;

  return (
    <div className='sherpa singletab'>
      <div className='vcontent singletab'>
        <div className='message'>

          <p>
            {BaseProduct.ProductName} is already open in another {otherWindow}.<br />
            For top performance, we run in a single instance.
          </p>

          {hasWork && work ? <>
            <div className='vivided' style={{ marginTop: '1.5rem', background: 'rgba(0 0 0 / 0.05)', borderRadius: '6px', marginInline: '-0.5rem', padding: '0.5rem', lineHeight: 1.5 }}>
              <b>Active work</b> in the other {otherWindow}:<br />
              {work.ongoingOperations > 0 && `${work.ongoingOperations} operation${work.ongoingOperations > 1 ? 's' : ''} in progress`}
              {work.ongoingOperations > 0 && (work.openBeams > 0 || work.drafts > 0) && ' • '}
              {work.openBeams > 0 && `${work.openBeams} Beam session${work.openBeams > 1 ? 's' : ''}`}
              {work.openBeams > 0 && work.drafts > 0 && ' • '}
              {work.drafts > 0 && `${work.drafts} draft${work.drafts > 1 ? 's' : ''}`}
            </div>
            <p>
              <strong>Use the existing {otherWindow}</strong> to not lose work<span className='terminal-cursor'>_</span>
            </p>
          </> : (
            <p style={{ marginTop: '1.5rem' }}>
              Close the other {otherWindow} to continue<span className='terminal-cursor'>_</span>
            </p>
          )}

          {unresponsive && (
            <div className='vivided' style={{ marginTop: '1rem', background: 'rgba(237 108 2 / 0.15)', borderRadius: '6px', marginInline: '-0.5rem', padding: '0.5rem', lineHeight: 1.5 }}>
              The other {otherWindow} is not responding.<br />
              <b>Taking over is safe.</b>
            </div>
          )}

          {!unresponsive && versionComparison === 'newer' && (
            <div className='vivided' style={{ marginTop: '1rem', background: 'rgba(46 125 50 / 0.15)', borderRadius: '6px', marginInline: '-0.5rem', padding: '0.5rem', lineHeight: 1.5 }}>
              <b>This window has a newer version</b><br />
              Transfer here to use the latest update.
            </div>
          )}
          {!unresponsive && versionComparison === 'older' && (
            <div className='vivided' style={{ marginTop: '1rem', background: 'rgba(237 108 2 / 0.15)', borderRadius: '6px', marginInline: '-0.5rem', padding: '0.5rem', lineHeight: 1.5 }}>
              The other {otherWindow} has a newer version<br />
              <b>Consider using the existing {otherWindow} instead.</b>
            </div>
          )}

          {bestEffort && (
            <p style={{ marginTop: '1rem', opacity: 0.5, fontSize: '0.875em' }}>
              compatibility mode: single-instance is best-effort over http
            </p>
          )}

        </div>
        {/* no button while wiping: this realm is about to be destroyed and must not be re-promoted */}
        {!wiping && (
          <button className='button mt2' onClick={instanceLockRequestTransfer}>
            Transfer Here
          </button>
        )}
      </div>
    </div>
  );
};
