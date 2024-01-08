import { useBrowseStore } from '~/modules/browse/store-module-browsing';

import { apiAsyncNode } from '~/common/util/trpc.client';


// show the screenshot in the dom
const DEBUG_SHOW_SCREENSHOT = false;


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
    screenshot: DEBUG_SHOW_SCREENSHOT ? {
      width: 512,
      height: 512,
      // quality: 100,
    } : undefined,
  });

  if (pages.length !== 1)
    throw new Error(`Browsing error: expected 1 result, got ${pages.length}`);

  const page = pages[0];

  // DEBUG: if there's a screenshot, append it to the dom
  if (DEBUG_SHOW_SCREENSHOT && page.screenshot) {
    const img = document.createElement('img');
    img.src = page.screenshot.imageDataUrl;
    img.style.width = `${page.screenshot.width}px`;
    img.style.height = `${page.screenshot.height}px`;
    document.body.appendChild(img);
  }

  // throw if there's an error
  if (page.error) {
    console.warn('Browsing service error:', page.error);
    if (!page.content)
      throw new Error(page.error);
  }

  return page;
}
