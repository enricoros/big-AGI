import * as React from 'react';

import { Box, ListItem, ListItemButton, ListItemDecorator, Sheet, Typography } from '@mui/joy';

import { CloseableMenu } from '~/common/components/CloseableMenu';

import type { ActileItem } from './ActileProvider';


export function ActilePopup(props: {
  anchorEl: HTMLElement | null,
  onClose: () => void,
  title?: string,
  items: ActileItem[],
  activeItemIndex: number | undefined,
  activePrefixLength: number,
  onItemClick: (item: ActileItem) => void,
  children?: React.ReactNode
}) {

  const hasAnyIcon = props.items.some(item => !!item.Icon);

  return (
    <CloseableMenu
      noTopPadding noBottomPadding
      open anchorEl={props.anchorEl} onClose={props.onClose}
      sx={{ minWidth: 320 }}
    >

      {!!props.title && (
        <Sheet variant='soft' sx={{ p: 1, borderBottom: '1px solid', borderBottomColor: 'neutral.softActiveBg' }}>
          <Typography level='title-sm'>
            {props.title}
          </Typography>
        </Sheet>
      )}

      {!props.items.length && (
        <ListItem variant='soft' color='warning'>
          <Typography level='body-md'>
            No matching command
          </Typography>
        </ListItem>
      )}

      {props.items.map((item, idx) => {
          const isActive = idx === props.activeItemIndex;
          const labelBold = item.label.slice(0, props.activePrefixLength);
          const labelNormal = item.label.slice(props.activePrefixLength);
          return (
            <ListItem
              key={item.key}
              variant={isActive ? 'soft' : undefined}
              color={isActive ? 'primary' : undefined}
              onClick={() => props.onItemClick(item)}
            >
              <ListItemButton color='primary'>
                {hasAnyIcon && (
                  <ListItemDecorator>
                    {item.Icon ? <item.Icon /> : null}
                  </ListItemDecorator>
                )}
                <Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography level='title-sm' color={isActive ? 'primary' : undefined}>
                      <span style={{ textDecoration: 'underline' }}><b>{labelBold}</b></span>{labelNormal}
                    </Typography>
                    {item.argument && <Typography level='body-sm'>
                      {item.argument}
                    </Typography>}
                  </Box>

                  {!!item.description && <Typography level='body-xs'>
                    {item.description}
                  </Typography>}
                </Box>
              </ListItemButton>
            </ListItem>
          );
        },
      )}

      {props.children}

    </CloseableMenu>
  );
}