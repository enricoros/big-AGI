import * as React from 'react';

import { useLayoutOverlaysStore } from './store-layout-overlays';


export const OverlaysInsert: React.FC = () => {

  // external state
  const overlays = useLayoutOverlaysStore(state => state.overlays);

  // Transient Overlays / Modals
  return overlays.map(({ id, component }) => (
    <React.Fragment key={id}>{component}</React.Fragment>
  ));
};
