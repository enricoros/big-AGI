import * as React from 'react';

import type { NextPageWithLayout } from '~/common/types/next.page';

import { ContainerLayout } from '~/common/layout/container/ContainerLayout';
import { OptimaLayout } from './optima/OptimaLayout';


type PerPageLayoutOptions = {
  // Center in a container at 100dvh
  type: 'container';
} | {
  // No layout, just the page
  type: 'noop';
} | {
  // Flexible layout with pluggable components
  type: 'optima';
  suspendAutoModelsSetup?: boolean;
};


/**
 * Next.js page-level layouting: a wrapper that adds the layout around the page as a layout function.
 */
export function withNextJSPerPageLayout(options: PerPageLayoutOptions, page: NextPageWithLayout): NextPageWithLayout {

  const { type, ...rest } = options;

  switch (type) {

    case 'container':
      page.getLayout = (page: React.ReactElement) => <ContainerLayout {...rest}>{page}</ContainerLayout>;
      return page;

    case 'noop':
      page.getLayout = (page: React.ReactElement) => page;
      return page;

    case 'optima':
      page.getLayout = (page: React.ReactElement) => <OptimaLayout {...rest}>{page}</OptimaLayout>;
      return page;

    default:
      console.error('No layout specified for this top-level page');
      return page;

  }
}


// /**
//  * Dynamic page-level layouting: a wrapper that adds the layout around the children.
//  */
// export function withLayout(layoutOptions: LayoutOptions, children: React.ReactNode): React.ReactElement {
//
//   const { type, ...rest } = layoutOptions;
//
//   switch (type) {
//
//     case 'optima':
//       return <OptimaLayout {...rest}>{children}</OptimaLayout>;
//
//     case 'plain':
//       return <PlainLayout {...rest}>{children}</PlainLayout>;
//
//     default:
//       console.error('No layout specified for this top-level page');
//       return <>{children}</>;
//
//   }
// }
//
