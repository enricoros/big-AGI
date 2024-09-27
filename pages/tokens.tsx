import * as React from 'react';

import { AppTokens } from '../src/apps/tokens/AppTokens';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppTokens />);
