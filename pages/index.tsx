import * as React from 'react';

import { AppChat } from '../src/apps/chat/AppChat';
import { useShowNewsOnUpdate } from '../src/apps/news/news.hooks';

import { AppLayout } from '~/common/layout/AppLayout';


export default function ChatPage() {
  // show the News page on updates
  useShowNewsOnUpdate();

  return (
    <AppLayout>
      <AppChat />
    </AppLayout>
  );
}