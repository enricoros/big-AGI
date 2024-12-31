import * as React from 'react';

import { AppDraw } from '../src/apps/draw/AppDraw';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppDraw />);
