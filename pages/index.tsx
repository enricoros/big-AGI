import * as React from 'react';

import { AppChat } from '../src/apps/chat/AppChat';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => {

  // TODO: This Index page will point to the Dashboard (or a landing page)
  // For now it offers the chat experience, but this will change. #299

  return <AppChat />;
});
