import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import { apiAsyncNode } from '~/common/util/trpc.client';


export const CmdRunBrowse: string[] = ['/browse'];


export async function callBrowseFetchPage(url: string): Promise<string | null> {

  // thow if no URL is provided
  url = url?.trim() || '';
  if (!url)
    throw new Error('Invalid URL');

  // assume https if no protocol is provided
  // noinspection HttpUrlsUsage
  if (!url.startsWith('http://') && !url.startsWith('https://'))
    url = 'https://' + url;

  try {

    const clientWssEndpoint = useBrowseStore.getState().wssEndpoint;

    const results = await apiAsyncNode.browse.fetchPages.mutate({
      access: {
        dialect: 'browse-wss',
        ...(!!clientWssEndpoint && { wssEndpoint: clientWssEndpoint }),
      },
      subjects: [{ url }],
    });

    if (results.objects.length !== 1)
      return `Browsing error: expected 1 result, got ${results.objects.length}`;

    const firstResult = results.objects[0];
    return !firstResult.error ? firstResult.content : `Browsing service error: ${JSON.stringify(firstResult)}`;

  } catch (error: any) {
    return `Browsing error: ${error?.message || error?.toString() || 'Unknown fetch error'}`;
  }
}
