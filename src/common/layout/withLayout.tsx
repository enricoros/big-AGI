import * as React from 'react';

import { OptimaLayout } from './optima/OptimaLayout';
import { PlainLayout } from './plain/PlainLayout';


type WithLayout = {
  type: 'optima';
  noAppBar?: boolean;
  suspendAutoModelsSetup?: boolean;
} | {
  type: 'plain';
};


/**
 * A wrapper that adds a layout around the children.
 */
export function withLayout(layoutOptions: WithLayout, children: React.ReactNode): React.ReactElement {

  // [dynamic page-level layouting] based on the the layoutOptions.type property of the Component
  const LayoutComponent =
    layoutOptions?.type === 'optima' ? OptimaLayout
      : layoutOptions?.type === 'plain' ? PlainLayout
        : (props: { children?: React.ReactNode }) => props.children; // this is here for the /404, /500, etc. pages

  return (
    <LayoutComponent {...layoutOptions}>
      {children}
    </LayoutComponent>
  );
}