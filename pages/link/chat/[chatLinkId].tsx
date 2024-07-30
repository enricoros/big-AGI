import * as React from 'react';

import { AppLinkChat } from '../../../src/apps/link-chat/AppLinkChat';

import { useRouterQuery } from '~/common/app.routes';
import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima', suspendAutoModelsSetup: true }, () => {

  // external state
  const { chatLinkId } = useRouterQuery<{ chatLinkId: string | undefined }>();

  return <AppLinkChat chatLinkId={chatLinkId || null} />;

});