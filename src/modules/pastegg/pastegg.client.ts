// noinspection ExceptionCaughtLocallyJS

import { Brand } from '@/common/brand';

import { PasteGG } from './pastegg.types';


/**
 * Publishes a markdown rendering of the conversation to a service of choice
 *
 * **Called by the UI to render the data and post it to the API**
 *
 * NOTE: we are calling our own API here, which in turn calls the paste.gg API. We do this
 *       because the browser wouldn't otherwise allow us to perform a CORS to paste.gg
 *
 * @param gg Only one service for now
 * @param fileContent the markdown content to publish
 * @param fileName optional, defaults to 'my-chat.md'
 */
export async function callPublish(gg: 'paste.gg', fileContent: string, fileName: string = 'my-chat.md'): Promise<PasteGG.API.Publish.Response | null> {

  const body: PasteGG.API.Publish.RequestBody = {
    to: gg,
    title: '🤖💬 Chat Conversation',
    fileContent,
    fileName,
    origin: getOrigin(),
  };

  try {

    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const paste: PasteGG.API.Publish.Response = await response.json();

      if (paste.type === 'success') {
        // we log this to the console for extra safety
        console.log('Data from your paste to \'paste.gg\'', paste);
        return paste;
      }

      if (paste.type === 'error')
        throw new Error(`Failed to send the paste: ${paste.error}`);
    }

    throw new Error(`Failed to publish conversation: ${response.status}: ${response.statusText}`);

  } catch (error) {
    console.error('Publish issue', error);
    alert(`Publish issue: ${error}`);
  }

  return null;
}


/// Returns a pretty link to the current page, for promo
function getOrigin() {
  let origin = (typeof window !== 'undefined') ? window.location.href : '';
  if (!origin || origin.includes('//localhost'))
    origin = Brand.URIs.OpenRepo;
  origin = origin.replace('https://', '');
  if (origin.endsWith('/'))
    origin = origin.slice(0, -1);
  return origin;
}
