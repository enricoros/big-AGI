import * as React from 'react';

import { VideoGenerator } from '~/apps/video/VideoGenerator';
import { withNextJSPerPageLayout } from '~/common/layout/withLayout';

export default withNextJSPerPageLayout({ type: 'optima' }, VideoGenerator);
