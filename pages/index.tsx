import * as React from 'react';

import { AppChat } from '../src/apps/chat/AppChat';
import { useRedirectToNewsOnUpdates } from '../src/apps/news/news.hooks';

import { withLayout } from '~/common/layout/withLayout';


export default function ChatPage() {
  // show the News page if there are unseen updates
  useRedirectToNewsOnUpdates();

  return withLayout({ type: 'optima' }, <AppChat />);
}