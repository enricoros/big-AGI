import * as React from 'react';

import { AppLinkChat } from '../../../src/apps/link-chat/AppLinkChat';

import { useRouterQuery } from '~/common/app.routes';
import { withLayout } from '~/common/layout/withLayout';


export default function ChatLinkPage() {

  // external state
  const { chatLinkId } = useRouterQuery<{ chatLinkId: string | undefined }>();

  return withLayout({ type: 'optima', suspendAutoModelsSetup: true }, <AppLinkChat chatLinkId={chatLinkId || null} />);
}