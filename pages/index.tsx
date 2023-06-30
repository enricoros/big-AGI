import * as React from 'react';

import { Chat } from '../src/apps/chat/Chat';
import { useShowNewsOnUpdate } from '../src/apps/news/news.hooks';

import { AppLayout } from '~/common/layouts/AppLayout';


export default function HomePage() {
  // show the News page on updates
  useShowNewsOnUpdate();

  return (
    <AppLayout>
      <Chat />
    </AppLayout>
  );
}