import * as React from 'react';
import { useRouter } from 'next/router';

import { AppChatLink } from '../../../src/apps/link/AppChatLink';

import { AppLayout } from '~/common/layout/AppLayout';


export default function ChatLinkPage() {
  const { query } = useRouter();
  const chatLinkId = query?.chatLinkId as string ?? '';

  return (
    <AppLayout suspendAutoModelsSetup>
      <AppChatLink linkId={chatLinkId} />
    </AppLayout>
  );
}