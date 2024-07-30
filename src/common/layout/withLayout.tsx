import * as React from 'react';

import type { NextPageWithLayout } from '~/common/types/next.page';

import { OptimaLayout } from './optima/OptimaLayout';
import { PlainLayout } from './plain/PlainLayout';


type PerPageLayoutOptions = {
  type: 'optima';
  suspendAutoModelsSetup?: boolean;
} | {
  type: 'plain';
};


/**
 * Next.js page-level layouting: a wrapper that adds the layout around the page as a layout function.
 */
export function withNextJSPerPageLayout(options: PerPageLayoutOptions, page: NextPageWithLayout): NextPageWithLayout {

  const { type, ...rest } = options;

  switch (type) {

    case 'optima':
      page.getLayout = (page: React.ReactElement) => <OptimaLayout {...rest}>{page}</OptimaLayout>;
      return page;

    case 'plain':
      page.getLayout = (page: React.ReactElement) => <PlainLayout {...rest}>{page}</PlainLayout>;
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
