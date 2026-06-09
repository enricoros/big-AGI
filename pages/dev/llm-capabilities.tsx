import * as React from 'react';

import { AppLlmCapabilities } from '../../src/apps/llm-capabilities/AppLlmCapabilities';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'noop' }, () => <AppLlmCapabilities />);
