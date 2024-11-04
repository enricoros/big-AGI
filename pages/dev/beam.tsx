import * as React from 'react';

import { AppBeam } from '../../src/apps/beam/AppBeam';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppBeam />);
