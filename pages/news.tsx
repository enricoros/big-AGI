import * as React from 'react';

import { AppNews } from '../src/apps/news/AppNews';
import { useMarkNewsAsSeen } from '../src/apps/news/news.hooks';

import { withLayout } from '~/common/layout/withLayout';


export default function NewsPage() {
  // 'touch' the last seen news version
  useMarkNewsAsSeen();

  return withLayout({ type: 'optima', suspendAutoModelsSetup: true }, <AppNews />);
}