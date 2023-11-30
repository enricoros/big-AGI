import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import { apiAsyncNode } from '~/common/util/trpc.client';


export const CmdRunBrowse: string[] = ['/browse'];


export async function callBrowseFetchPage(url: string) {

  // thow if no URL is provided
  url = url?.trim() || '';
  if (!url)
    throw new Error('Browsing error: Invalid URL');

  // assume https if no protocol is provided
  // noinspection HttpUrlsUsage
  if (!url.startsWith('http://') && !url.startsWith('https://'))
    url = 'https://' + url;

  const clientWssEndpoint = useBrowseStore.getState().wssEndpoint;

  const { pages } = await apiAsyncNode.browse.fetchPages.mutate({
    access: {
      dialect: 'browse-wss',
      ...(!!clientWssEndpoint && { wssEndpoint: clientWssEndpoint }),
    },
    subjects: [{ url }],
  });

  if (pages.length !== 1)
    throw new Error(`Browsing error: expected 1 result, got ${pages.length}`);

  const page = pages[0];
  if (page.error) {
    console.warn('Browsing service error:', page.error);
    if (!page.content)
      throw new Error(page.error);
  }

  return page;
}
