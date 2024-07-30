import * as React from 'react';

import { AppDiff } from '../src/apps/diff/AppDiff';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppDiff />);
