import * as React from 'react';

import { AppPersonas } from '../src/apps/personas/AppPersonas';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppPersonas />);
