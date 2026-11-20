import * as React from 'react';
import Head from 'next/head';

import { apiAsync } from '~/common/util/trpc.client';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { openRouterOAuthEnd, openRouterOAuthVerifierForState } from '~/modules/llms/vendors/openrouter/openrouter.oauth';
import { useRouterQuery } from '~/common/app.routes';


export default function CallbackOpenRouterPage() {

  // state
  const [error, setError] = React.useState<string | null>(null);
  const [orKey, setOrKey] = React.useState<string | null>(null);
  const exchangeStartedRef = React.useRef(false); // codes are single-use: exchange once, also under Strict Mode's double mount

  // external state
  const { code, state } = useRouterQuery<{ code?: string, state?: string }>();


  // [effect] exchange the code - only for a sign-in this browser started (matching state), with that flow's verifier
  React.useEffect(() => {
    if (!code || exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    const codeVerifier = openRouterOAuthVerifierForState(state);
    if (!codeVerifier) {
      // only this page fails: a sign-in may still be in progress in another tab
      setError('This sign-in was not started from this browser. Start it again from Models > OpenRouter.');
      return;
    }

    apiAsync.backend.exchangeOpenRouterKey.mutate({ code, codeVerifier })
      .then(({ key }) => setOrKey(key))
      .catch((error: any) => setError(error?.message || 'Key exchange failed.'))
      .finally(openRouterOAuthEnd);
  }, [code, state]);

  // [effect] after 5 seconds, if no code show error
  React.useEffect(() => {
    if (code) return;
    const timeout = setTimeout(() => setError('No authorization code provided.'), 5000);
    return () => clearTimeout(timeout);
  }, [code]);

  // [effect] after 30 seconds without an outcome, show an error
  React.useEffect(() => {
    if (!code || orKey || error) return;
    const timeout = setTimeout(() => setError('Authentication timed out. Please try again.'), 30000);
    return () => clearTimeout(timeout);
  }, [code, error, orKey]);


  // [effect] post exchange handling
  React.useEffect(() => {
    if (!orKey) return;

    // save key to the first openrouter slot (may not work in popup context)
    llmsStoreActions().setOpenRouterKey(orKey);

    // if opened as popup, message parent and close
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: 'openrouter-oauth-success', orApiKey: orKey },
        window.location.origin,
      );
      // close popup after brief success message display
      setTimeout(() => window.close(), 1500);
    } else {
      // fallback: full page redirect (opened directly or parent closed)
      window.location.href = '/';
    }
  }, [orKey]);


  return <>
    <Head>
      <title>OpenRouter | Big-AGI Linking</title>
    </Head>

    <div className='sherpa singletab'>
      <div className='vcontent'>
        {error ? <>
          <h3 style={{ color: '#dc2626' }}>Linking Failed</h3>
          <p className='error'>{error}</p>
          <p>Please let us know by opening a GitHub issue.</p>
        </> : orKey ? <>
          <h3 style={{ color: '#16a34a' }}>Linking Succeeded</h3>
          <p style={{ color: '#64748b' }}>Redirecting to Big-AGI...</p>
        </> : <>
          <p className='state-loading'>...</p>
        </>}
      </div>
    </div>
  </>;
}
