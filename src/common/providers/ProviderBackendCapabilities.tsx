import * as React from 'react';

import { useKnowledgeOfBackendCaps } from '~/modules/backend/store-backend-capabilities';

import { Release } from '~/common/app.release';
import { apiQuery } from '~/common/util/trpc.client';
import { preloadTiktokenLibrary } from '~/common/tokens/tokens.text';
import { themeFontFamilyCss } from '~/common/app.theme';


// Configuration
const BACKEND_WARNING_TIMEOUT = 6000;


// Styles, all manual without depending on Emotion/Joy UI
const styles: Record<string, React.CSSProperties> = {
  container: {
    // looks
    background: 'var(--joy-palette-background-level1)',
    color: 'var(--joy-palette-text-primary)',
    fontFamily: themeFontFamilyCss,
    minHeight: '100vh',
    // layout
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
  },
  content2: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  leftbox: {
    borderRight: `1px solid var(--joy-palette-neutral-400)`,
    margin: '0 1.5rem 0 0',
    padding: '0 1.5rem 0 0',
  },
  heading: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 500,
  },
  version: {
    fontSize: '12px',
  },
  message: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 400,
  },
  button: {
    color: 'var(--joy-palette-neutral-solidColor, #fff)',
    background: 'var(--joy-palette-neutral-solidBg, #000)',
    padding: '0.75rem 1.25rem',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
};


/**
 * Note: we used to have a NoSSR wrapper inside the AppLayout component (which was delaying rendering 1 cycle),
 * however this wrapper is now providing the same function, given the network roundtrip.
 */
export function ProviderBackendCapabilities(props: { children: React.ReactNode }) {

  // state
  const [backendTimeout, setBackendTimeout] = React.useState(false);
  const [versionVerified, setVersionVerified] = React.useState<boolean | null>(null);

  // external state
  const [haveCapabilities, storeBackendCapabilities] = useKnowledgeOfBackendCaps();


  // fetch capabilities
  const { data } = apiQuery.backend.listCapabilities.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 1 day
  });


  // [effect] copy from the backend capabilities payload to the frontend state store
  React.useEffect(() => {
    if (data) {
      storeBackendCapabilities(data);

      // Compare client and server build info
      const clientBuildInfo = Release.buildInfo('frontend');
      const serverBuildInfo = data.build || {};
      setVersionVerified(clientBuildInfo.gitSha === serverBuildInfo.gitSha && clientBuildInfo.pkgVersion === serverBuildInfo.pkgVersion);
    }
  }, [data, storeBackendCapabilities]);


  // [effect] warn if the backend is not available
  React.useEffect(() => {
    if (!haveCapabilities) {
      const timeout = setTimeout(() => setBackendTimeout(true), BACKEND_WARNING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [haveCapabilities]);

  // [effect] then preload the Tiktoken library right when proceeding to the UI
  React.useEffect(() => {
    // large WASM payload, so fire/forget
    if (haveCapabilities)
      void preloadTiktokenLibrary();
  }, [haveCapabilities]);


  //
  // Rendering Gates
  //

  // Version mismatch notice
  if (versionVerified === false) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.leftbox}>
            <h2 style={styles.heading}>Updated</h2>
            {/*<div style={styles.version}>*/}
            {/*  version. {Release.buildInfo('frontend').pkgVersion}*/}
            {/*</div>*/}
          </div>
          <button
            style={styles.button}
            onClick={() => window.location.reload()}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Reload Now
          </button>
        </div>
      </div>
    );
  }

  // Backend timeout notice
  if (backendTimeout && versionVerified !== true) {
    return (
      <div style={styles.container}>
        <div style={styles.content2}>
          <h2 style={styles.heading}>Connection Error</h2>
          <h2 style={styles.message}>Unable to connect to the server.<br /><br /></h2>
          <button
            style={styles.button}
            onClick={() => window.location.reload()}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Reload Now
          </button>
        </div>
      </div>
    );
  }

  // Wait for the backend to respond
  if (versionVerified === null) {
    return null;
    // return (
    //   <div style={containerStyle}>
    //     <p style={messageStyle}>
    //       Loading application...
    //     </p>
    //   </div>
    // );
  }

  // Render the children when ready
  return versionVerified ? props.children : null;
}