import * as React from 'react';

import { Chat } from '../src/apps/chat/Chat';

import { AppLayout } from '~/common/layouts/AppLayout';

import { useShowNewsOnUpdate } from './news';


export default function HomePage() {
  // show the News page on updates
  useShowNewsOnUpdate();

  return (
    <AppLayout>
      <Chat />
    </AppLayout>
  );
}