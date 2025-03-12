import * as React from 'react';

import { Avatar } from '@mui/joy';

import { urlExtractDomain } from '~/common/util/urlUtils';


export function AvatarDomainFavicon(props: {
  url: string;
  size?: number;
  iconRes?: number;
  noHover?: boolean;
  noShadow?: boolean;
}) {
  const { url, size = 16, iconRes = 32, noShadow } = props;

  const domain = !url ? '' : urlExtractDomain(url);

  // using Google's favicon service
  const faviconUrl = !domain?.length ? undefined : `https://www.google.com/s2/favicons?domain=${domain}&sz=${iconRes}`;

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
        '&:hover': props.noHover ? undefined : {
          outlineColor: 'neutral.outlinedColor',
          bgcolor: 'neutral.softActiveBg',
          borderRadius: 'none',
          boxShadow: 'md',
        },
      }}
      src={faviconUrl}
    >
      {(domain || '').charAt(0).toUpperCase()}
    </Avatar>
  );
}
