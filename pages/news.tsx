import * as React from 'react';

import { AppNews } from '../src/apps/news/AppNews';
import { useMarkNewsAsSeen } from '../src/apps/news/news.hooks';

import type { LayoutOptions } from '~/common/layout/LayoutOptions';


export default function NewsPage() {
  // 'touch' the last seen news version
  useMarkNewsAsSeen();

  return <AppNews />;
}
NewsPage.layoutOptions = { type: 'optima', suspendAutoModelsSetup: true } satisfies LayoutOptions;