import * as React from 'react';

import { AppNews } from '../src/apps/news/AppNews';

import { markNewsAsSeen } from '~/common/logic/store-logic-sherpa';
import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima', suspendAutoModelsSetup: true }, () => {

  // 'touch' the last seen news version
  React.useEffect(() => markNewsAsSeen(), []);

  return <AppNews />;
});