import * as React from 'react';

import { AppChatLink } from '../../../src/apps/link/AppChatLink';

import { useRouterQuery } from '~/common/app.routes';
import { withLayout } from '~/common/layout/withLayout';


export default function ChatLinkPage() {

  // external state
  const { chatLinkId } = useRouterQuery<{ chatLinkId: string | undefined }>();

  return withLayout({ type: 'optima', suspendAutoModelsSetup: true }, <AppChatLink linkId={chatLinkId || ''} />);
}