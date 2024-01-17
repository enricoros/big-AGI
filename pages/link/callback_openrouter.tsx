import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { useModelsStore } from '~/modules/llms/store-llms';

import { InlineError } from '~/common/components/InlineError';
import { apiQuery } from '~/common/util/trpc.client';
import { navigateToIndex, useRouterQuery } from '~/common/app.routes';
import { withLayout } from '~/common/layout/withLayout';


function CallbackOpenRouterPage(props: { openRouterCode: string | undefined }) {

  // external state
  const { data, isError, error, isLoading } = apiQuery.backend.exchangeOpenRouterKey.useQuery({ code: props.openRouterCode || '' }, {
    enabled: !!props.openRouterCode,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // derived state
  const isErrorInput = !props.openRouterCode;
  const openRouterKey = data?.key ?? undefined;
  const isSuccess = !!openRouterKey;


  // Success: save the key and redirect to the chat app
  React.useEffect(() => {
    if (!isSuccess)
      return;

    // 1. Save the key as the client key
    useModelsStore.getState().setOpenRoutersKey(openRouterKey);

    // 2. Navigate to the chat app
    void navigateToIndex(true); //.then(openModelsSetup);

  }, [isSuccess, openRouterKey]);

  return (
    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      display: 'flex', justifyContent: 'center',
      p: { xs: 3, md: 6 },
    }}>

      <Box sx={{
        // my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4,
      }}>

        <Typography level='title-lg'>
          Welcome Back
        </Typography>

        {isLoading && <Typography level='body-sm'>Loading...</Typography>}

        {isErrorInput && <InlineError error='There was an issue retrieving the code from OpenRouter.' />}

        {isError && <InlineError error={error} />}

        {data && (
          <Typography level='body-md'>
            Success! You can now close this window.
          </Typography>
        )}

      </Box>

    </Box>
  );
}


/**
 * This page will be invoked by OpenRouter as a Callback
 *
 * Docs: https://openrouter.ai/docs#oauth
 * Example URL: https://localhost:3000/link/callback_openrouter?code=SomeCode
 */
export default function CallbackPage() {

  // external state - get the 'code=...' from the URL
  const { code } = useRouterQuery<{ code: string | undefined }>();

  return withLayout({ type: 'plain' }, <CallbackOpenRouterPage openRouterCode={code} />);
}