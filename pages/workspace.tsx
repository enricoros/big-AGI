import * as React from 'react';

import { Box } from '@mui/joy';

// import { AppWorkspace } from '../src/apps/personas/AppWorkspace';

import { withLayout } from '~/common/layout/withLayout';


export default function PersonasPage() {
  return withLayout({ type: 'optima' }, <Box />);
}