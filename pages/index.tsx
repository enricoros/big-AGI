import * as React from 'react';

import { AppChat } from '../src/apps/chat/AppChat';
import { useShowNewsOnUpdate } from '../src/apps/news/news.hooks';

import { AppLayout } from '~/common/layouts/AppLayout';


export default function HomePage() {
  // show the News page on updates
  useShowNewsOnUpdate();

  return (
    <AppLayout>
      <AppChat />
    </AppLayout>
  );
}