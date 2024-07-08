import * as React from 'react';

import { Alert, Box, Button, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { setComposerStartupText } from '../../src/apps/chat/components/composer/store-composer';

import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { LogoProgress } from '~/common/components/LogoProgress';
import { asValidURL } from '~/common/util/urlUtils';
import { navigateToIndex, useRouterQuery } from '~/common/app.routes';
import { withLayout } from '~/common/layout/withLayout';


/**
 * This page will be invoked on mobile when sharing Text/URLs/Files from other APPs
 * See the /public/manifest.json for how this is configured. Parameters:
 *  - text: the text to share
 *  - url: the URL to share
 *   - if the URL is a valid URL, it will be downloaded and the content will be shared
 *   - if the URL is not a valid URL, it will be shared as text
 *  - title: the title of the shared content
 */
function AppShareTarget() {
  // state
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [intentText, setIntentText] = React.useState<string | null>(null);
  const [intentURL, setIntentURL] = React.useState<string | null>(null);
  const [isDownloading, setIsDownloading] = React.useState(false);

  // external state
  const { url: queryUrl, text: queryText } = useRouterQuery<{
    url: string | string[] | undefined,
    text: string | string[] | undefined,
  }>();

  const queueComposerTextAndLaunchApp = React.useCallback((text: string) => {
    setComposerStartupText(text);
    void navigateToIndex(true);
  }, []);


  // Detect the share Intent from the query
  React.useEffect(() => {
    // skip when query is not parsed yet
    let queryTextItem = queryUrl || queryText || null;
    if (!queryTextItem)
      return;

    // single item from the query
    if (Array.isArray(queryTextItem))
      queryTextItem = queryTextItem[0];

    // check if the item is a URL
    const url = asValidURL(queryTextItem);
    if (url)
      setIntentURL(url);
    else if (queryTextItem)
      setIntentText(queryTextItem);
    else
      setErrorMessage('No text or url. Received: ' + JSON.stringify({ queryText, queryUrl }));

  }, [queryText, queryUrl]);


  // Text -> Composer
  React.useEffect(() => {
    if (intentText)
      queueComposerTextAndLaunchApp(intentText);
  }, [intentText, queueComposerTextAndLaunchApp]);


  // URL -> download -> Composer
  React.useEffect(() => {
    if (intentURL) {
      setIsDownloading(true);
      callBrowseFetchPage(intentURL)
        .then(page => {
          if (page.stopReason !== 'error') {
            let pageContent = page.content.markdown || page.content.text || page.content.html || '';
            if (pageContent)
              pageContent = '\n\n```' + intentURL + '\n' + pageContent + '\n```\n';
            queueComposerTextAndLaunchApp(pageContent);
          } else
            setErrorMessage('Could not read any data' + page.error ? ': ' + page.error : '');
        })
        .catch(error => setErrorMessage(error?.message || error || 'Unknown error'))
        .finally(() => setIsDownloading(false));
    }
  }, [intentURL, queueComposerTextAndLaunchApp]);


  return (

    <Box sx={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flexGrow: 1,
    }}>

      {/* Logo with Circular Progress  */}
      <LogoProgress showProgress={isDownloading} />

      {/* Title */}
      <Typography level='title-lg' sx={{ mt: 2, mb: 1 }}>
        {isDownloading ? 'Loading...' : errorMessage ? '' : intentURL ? 'Done' : 'Receiving...'}
      </Typography>

      {/* Possible Error */}
      {errorMessage && <>
        <Alert variant='soft' color='danger' sx={{ my: 1 }}>
          <Typography>{errorMessage}</Typography>
        </Alert>
        <Button
          variant='solid' color='danger'
          onClick={() => navigateToIndex()}
          endDecorator={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Cancel
        </Button>
      </>}

      {/* URL under analysis */}
      <Typography level='body-xs'>
        {intentURL}
      </Typography>
    </Box>

  );

}

/**
 * This page will be invoked on mobile when sharing Text/URLs/Files from other APPs
 * Example URL: https://localhost:3000/link/share_target?title=This+Title&text=https%3A%2F%2Fexample.com%2Fapp%2Fpath
 */
export default function ShareTargetPage() {
  return withLayout({ type: 'plain' }, <AppShareTarget />);
}