import * as React from 'react';

import type { ColorPaletteProp, TypographySystem } from '@mui/joy/styles/types';
import type { SiteDocSlug } from '~/common/gen/com.site.docs.slug';

import { Brand } from '~/common/app.config';
import { ExternalLink } from '~/common/components/ExternalLink';


export function ExternalDocsLink(props: {
  docPage: SiteDocSlug;
  color?: ColorPaletteProp,
  level?: keyof TypographySystem | 'inherit',
  highlight?: boolean;
  children: React.ReactNode,
}) {
  return (
    <ExternalLink
      href={Brand.Docs.Public(props.docPage)}
      color={props.color}
      level={props.level}
      highlight={props.highlight}
      icon='public-docs'
    >
      {props.children}
    </ExternalLink>
  );
}