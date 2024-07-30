import * as React from 'react';

import { AppPlaceholder } from '../src/apps/AppPlaceholder';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppPlaceholder />);
