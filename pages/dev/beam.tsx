import * as React from 'react';

import { AppBeam } from '../../src/apps/beam/AppBeam';

import { withLayout } from '~/common/layout/withLayout';


export default function BeamPage() {
  return withLayout({ type: 'optima' }, <AppBeam />);
}