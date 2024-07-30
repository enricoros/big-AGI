import * as React from 'react';

import { AppCall } from '../src/apps/call/AppCall';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppCall />);
