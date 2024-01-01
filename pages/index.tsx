import * as React from 'react';

import { AppChat } from '../src/apps/chat/AppChat';
import { useRedirectToNewsOnUpdates } from '../src/apps/news/news.hooks';

import { withLayout } from '~/common/layout/withLayout';


export default function IndexPage() {
  // show the News page if there are unseen updates
  useRedirectToNewsOnUpdates();

  // TODO: This Index page will point to the Dashboard (or a landing page) soon
  // For now it offers the chat experience, but this will change. #299

  return withLayout({ type: 'optima' }, <AppChat />);
}