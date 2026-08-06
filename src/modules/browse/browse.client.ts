import { BrowsePageTransform, useBrowseStore } from '~/modules/browse/store-module-browsing';

import { apiStreamNode } from '~/common/util/trpc.client';


/**
 * Error handling for browsing:
 * - connection issue: .mutate throws a "Invalid response or stream interrupted" TRPCClientError
 * - router throws: client rethrows TRPCClientError (code 500 if no code is provided) with the message
 * - other errors from parsing (and in the payload we get): we'll throw nicer messages
 */
export async function callBrowseFetchPageOrThrow(
  url: string,
  transforms?: BrowsePageTransform[],
  screenshotOptions?: { width: number, height: number, quality?: number },
  allowFileDownloads?: boolean,
) {

  // validate url
  url = url?.trim() || '';
  if (!url)
    throw new Error('Browsing error: Invalid URL');

  // noinspection HttpUrlsUsage: assume https if no protocol is provided
  if (!url.startsWith('http://') && !url.startsWith('https://'))
    url = 'https://' + url;

  const { wssEndpoint, pageTransform } = useBrowseStore.getState();

  // Connect to our service
  let streamingResponse: Awaited<ReturnType<typeof apiStreamNode.browse.fetchPagesStreaming.mutate>>;
  try {
    streamingResponse = await apiStreamNode.browse.fetchPagesStreaming.mutate({
      access: {
        dialect: 'browse-wss',
        ...(!!wssEndpoint && { wssEndpoint }),
      },
      requests: [{
        url,
        transforms: transforms ? transforms : [pageTransform],
        screenshot: screenshotOptions || undefined,
        allowFileDownloads: allowFileDownloads || false,
      }],
    });
  } catch (error: any) {
    console.warn('[DEV] browse.client: connection error:', error);
    throw new Error('Connectivity Issue.');
  }

  // Retrieve the response - let errors throw as they behave well
  // - the router throws a TRPCClientError if the WSS endpoint is invalid, with a nice message
  // - if the network is interrupted, a StreamInterruptedError will be thrown
  //   - with cause 'TypeError: network error'
  //   - with message 'Invalid response or stream interrupted'
  // - we will throw more errors if we can't validate
  for await (const message of streamingResponse) {
    switch (message.type) {
      case 'ack-start':
        // ignore
        break;

      case 'result':
        if (message.pages.length !== 1)
          throw new Error(`Browser downloaded ${message.pages?.length} pages, but only one was expected`);

        // throw if there's an error
        const page = message.pages[0];
        if (page.error) {
          const haveNoContent = !page.content || !Object.keys(page.content).length;
          console.warn('[DEV] browse.client: puppeteer error:', { page });
          if (haveNoContent)
            throw new Error(page.error);
        }

        // we did it
        return page;
    }
  }

  // no page received
  throw new Error('No page received');
}
