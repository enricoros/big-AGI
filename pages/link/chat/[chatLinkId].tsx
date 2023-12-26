import * as React from 'react';
import { useRouter } from 'next/router';

import { AppChatLink } from '../../../src/apps/link/AppChatLink';

import { withLayout } from '~/common/layout/withLayout';


export default function ChatLinkPage() {
  const { query } = useRouter();
  const chatLinkId = query?.chatLinkId as string ?? '';

  return withLayout({ type: 'optima', suspendAutoModelsSetup: true }, <AppChatLink linkId={chatLinkId} />);
}