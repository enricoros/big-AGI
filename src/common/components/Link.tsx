import * as React from 'react';
import { useRouter } from 'next/router';
import NextLink, { LinkProps as NextLinkProps } from 'next/link';

import { Link as MuiLink, LinkProps as MuiLinkProps, styled } from '@mui/joy';


// Add support for the sx prop for consistency with the other branches.
const ExternalAnchor = styled('a', { name: 'ExternalAnchor' })({});

// NextLink renders the anchor itself and forwards the ref to it; styled() adds the sx prop, as for ExternalAnchor
const InternalAnchor = styled(NextLink, { name: 'InternalAnchor' })({});


type LinkProps = {
  activeClassName?: string;
  href: NextLinkProps['href'];
  noLinkStyle?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  Omit<NextLinkProps, 'href' | 'as' | 'passHref' | 'legacyBehavior' | 'onMouseEnter' | 'onClick' | 'onTouchStart'> &
  Omit<MuiLinkProps, 'href'>;

// A styled version of the Next.js Link component:
// https://nextjs.org/docs/api-reference/next/link
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(props, ref) {
  const {
    activeClassName = 'active',
    className: classNameProps,
    href,
    locale,
    noLinkStyle,
    prefetch,
    replace,
    scroll,
    shallow,
    ...other
  } = props;

  // external state
  const { pathname: routerPathname } = useRouter();

  // derived state
  const pathname = typeof href === 'string' ? href : href.pathname;
  const className = `${classNameProps || ''}${routerPathname === pathname ? ` ${activeClassName}` : ''}`;

  // external links: MuiLink (default) or 'a'
  const isExternal = typeof href === 'string' && (href.startsWith('http') || href.startsWith('mailto:'));
  if (isExternal)
    return noLinkStyle
      ? <ExternalAnchor className={className} href={href} ref={ref} {...other} />
      : <MuiLink className={className} href={href} ref={ref} {...other} />;

  const nextjsProps = {
    href,
    replace,
    scroll,
    shallow,
    prefetch,
    locale,
  };

  // internal (routed) links: MuiLink (default, over InternalAnchor) or InternalAnchor
  return noLinkStyle
    ? <InternalAnchor className={className} ref={ref} {...nextjsProps} {...other} />
    : <MuiLink component={InternalAnchor} className={className} ref={ref} {...nextjsProps} {...other} />;
});
