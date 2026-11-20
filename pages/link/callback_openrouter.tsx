import * as React from 'react';
import Head from 'next/head';

import { apiQuery } from '~/common/util/trpc.client';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useRouterQuery } from '~/common/app.routes';


export default function CallbackOpenRouterPage() {

  // state
  const [otherError, setOtherError] = React.useState<string | null>(null);

  // external state
  const { code } = useRouterQuery<{ code?: string }>();
  const { data, error: queryError, isPending } = apiQuery.backend.exchangeOpenRouterKey.useQuery({ code: code ?? '' }, {
    enabled: !!code, // auto-start only when code is available
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // derived state
  const error = otherError ?? queryError?.message;
  const orKey = data?.key ?? null;


  // [effect] after 5 seconds, if no code show error
  React.useEffect(() => {
    if (code) return;
    const timeout = setTimeout(() => setOtherError('No authorization code provided.'), 5000);
    return () => clearTimeout(timeout);
  }, [code]);

  // [effect] after 30 seconds, if still pending show error
  React.useEffect(() => {
    if (!code || !isPending) return; // without a code the query is disabled (and 'pending' forever): that case has its own message above
    const timeout = setTimeout(() => setOtherError('Authentication timed out. Please try again.'), 30000);
    return () => clearTimeout(timeout);
  }, [code, isPending]);


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
