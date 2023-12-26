import * as React from 'react';
import { useRouter } from 'next/router';

import { AppChatLink } from '../../../src/apps/link/AppChatLink';

import type { LayoutOptions } from '~/common/layout/LayoutOptions';


export default function ChatLinkPage() {
  const { query } = useRouter();
  const chatLinkId = query?.chatLinkId as string ?? '';

  return <AppChatLink linkId={chatLinkId} />;
}
ChatLinkPage.layoutOptions = { type: 'optima', suspendAutoModelsSetup: true } satisfies LayoutOptions;