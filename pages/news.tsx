import * as React from 'react';

import { AppNews } from '../src/apps/news/AppNews';
import { useMarkNewsAsSeen } from '../src/apps/news/news.hooks';

import { AppLayout } from '~/common/layout/AppLayout';


export default function NewsPage() {
  // update the last seen news version
  useMarkNewsAsSeen();

  return (
    <AppLayout suspendAutoModelsSetup>
      <AppNews />
    </AppLayout>
  );
}