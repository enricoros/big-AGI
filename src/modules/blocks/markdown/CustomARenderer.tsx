import * as React from 'react';

import { Avatar, Box, Chip, FormControl, Link } from '@mui/joy';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';


interface URLInfo {
  domain: string;
  prettyUrl: string;
  isSecure: boolean;
  // type: 'social' | 'academic' | 'news' | 'default';
}

// function _detectUrlType(domain: string): 'social' | 'academic' | 'news' | 'default' {
//   const socialDomains = ['twitter.com', 'facebook.com', 'linkedin.com'];
//   const academicDomains = ['scholar.google.com', 'arxiv.org', 'academia.edu'];
//   const newsDomains = ['reuters.com', 'bloomberg.com', 'nytimes.com'];
//
//   if (socialDomains.some(d => domain.includes(d))) return 'social';
//   if (academicDomains.some(d => domain.includes(d))) return 'academic';
//   if (newsDomains.some(d => domain.includes(d))) return 'news';
//   return 'default';
// }

function _prettyHref(href: string): string {
  try {
    const url = new URL(href);
    const text = url.origin + url.pathname;
    return text.endsWith('/') ? text.slice(0, -1) : text;
  } catch {
    return href;
  }
}

function _analyzeUrl(url: string): URLInfo {
  try {
    const urlObj = new URL(url);
    return {
      domain: urlObj.hostname,
      prettyUrl: _prettyHref(url),
      isSecure: urlObj.protocol === 'https:',
      // type: _detectUrlType(urlObj.hostname),
    };
  } catch {
    return {
      domain: url,
      prettyUrl: url,
      isSecure: false,
      // type: 'default',
    };
  }
}


function GoogleFavicon(props: {
  domain: string;
  size?: number;
  iconRes?: number;
  noShadow?: boolean;
}) {

  const { domain, size = 16, iconRes = 32, noShadow } = props;

  // using Google's favicon service, with
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${iconRes}`;

  return (
    <Avatar
      component='span'
      variant='plain'
      sx={{
        mx: 0.5,
        borderRadius: noShadow ? 0 : 'xs',
        boxShadow: noShadow ? 'none' : 'xs',
        width: size,
        height: size,
        fontSize: size * 0.8,
        // bgcolor: 'neutral.softBg',
        // outline: noShadow ? undefined : '1px solid',
        // outlineColor: noShadow ? undefined : 'neutral.outlinedBorder',
        '&:hover': {
          outlineColor: 'neutral.outlinedColor',
          bgcolor: 'neutral.softActiveBg',
          borderRadius: 'none',
          boxShadow: 'md',
        },
      }}
      src={faviconUrl}
    >
      {domain.charAt(0).toUpperCase()}
    </Avatar>
  );
}

function LinkPreview({ urlInfo }: { urlInfo: URLInfo }) {
  return (
    <FormControl sx={{ px: 0.5, py: 0.75, minWidth: 200 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GoogleFavicon domain={urlInfo.domain} size={32} iconRes={64} noShadow />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ fontSize: 'xs', color: 'text.tertiary' }}>Open in new tab</Box>
            {urlInfo.isSecure && <Chip size='sm' variant='soft' color='success'>Secure</Chip>}
          </Box>
          <Box sx={{ color: 'text.secondary' }}>{urlInfo.prettyUrl}</Box>
        </Box>
        {/*<Typography level='body-xs' mt={1}>Click to open</Typography>*/}
      </Box>
    </FormControl>
  );
}


export function CustomARenderer({ node, href, children, ...props }: {
  node?: any;
  href?: string;
  children: React.ReactNode;
}) {

  const isEmptyInlineLink = React.Children.count(children) === 0;

  // Empty Inline Link:  render the favicon with a popup for [](https://..)
  if (isEmptyInlineLink && href) {
    const urlInfo = _analyzeUrl(href);

    return (
      <TooltipOutlined title={<LinkPreview urlInfo={urlInfo} />}>
        <Link level='inherit' {...props} href={href} target='_blank' rel='noopener'>
          {children} <GoogleFavicon domain={urlInfo.domain} size={16} />
        </Link>
      </TooltipOutlined>
    );
  }

  // adds a target="_blank" to all links
  return (
    <a {...props} href={href} target='_blank' rel='noopener'>
      {children}
    </a>
  );
}
