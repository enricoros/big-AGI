import * as React from 'react';

import { AppNews } from '../src/apps/news/AppNews';
import { markNewsAsSeen } from '../src/apps/news/news.version';

import { withLayout } from '~/common/layout/withLayout';


export default function NewsPage() {
  // 'touch' the last seen news version
  React.useEffect(() => markNewsAsSeen(), []);

  return withLayout({ type: 'optima', suspendAutoModelsSetup: true }, <AppNews />);
}