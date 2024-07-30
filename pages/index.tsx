import * as React from 'react';

import { AppChat } from '../src/apps/chat/AppChat';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';
import { useDebugHook } from '~/common/components/useDebugHook';


export default withNextJSPerPageLayout({ type: 'optima' }, () => {

  useDebugHook('IndexPage');

  // TODO: This Index page will point to the Dashboard (or a landing page)
  // For now it offers the chat experience, but this will change. #299

  return <AppChat />;
});
