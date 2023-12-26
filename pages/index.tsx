import * as React from 'react';

import { AppChat } from '../src/apps/chat/AppChat';
import { useRedirectToNewsOnUpdates } from '../src/apps/news/news.hooks';

import type { LayoutOptions } from '~/common/layout/LayoutOptions';


export default function ChatPage() {
  // show the News page if there are unseen updates
  useRedirectToNewsOnUpdates();

  return <AppChat />;
}
ChatPage.layoutOptions = { type: 'optima' } satisfies LayoutOptions;