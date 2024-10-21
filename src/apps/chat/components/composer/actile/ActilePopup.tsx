import * as React from 'react';

import { Box, ListItem, ListItemButton, ListItemDecorator, Sheet, Typography } from '@mui/joy';

import { CloseablePopup } from '~/common/components/CloseablePopup';

import type { ActileItem, ActileProvider } from './ActileProvider';

export function ActilePopup(props: {
  anchorEl: HTMLElement | null,
  onClose: () => void,
  itemsByProvider: { provider: ActileProvider, items: ActileItem[] }[],
  activeItemIndex: number,
  activePrefixLength: number,
  onItemClick: (item: ActileItem) => void,
}) {

  // We need to keep track of the overall item index to correctly match with activeItemIndex
  const itemIndices = React.useMemo(() => {
    const indices: { providerKey: string, itemKey: string, isActive: boolean }[] = [];
    let indexCounter = 0;
    props.itemsByProvider.forEach(({ provider, items }) => {
      items.forEach((item) => {
        indices.push({
          providerKey: provider.key,
          itemKey: item.key,
          isActive: indexCounter === props.activeItemIndex,
        });
        indexCounter += 1;
      });
    });
    return indices;
  }, [props.itemsByProvider, props.activeItemIndex]);

  return (
    <CloseablePopup
      menu anchorEl={props.anchorEl} onClose={props.onClose}
      maxHeightGapPx={320}
      minWidth={320}
      noBottomPadding
      noTopPadding
    >

      {!props.itemsByProvider.length && (
        <ListItem variant='soft' color='warning'>
          <Typography level='body-md'>
            No matching command
          </Typography>
        </ListItem>
      )}

      {props.itemsByProvider.map(({ provider, items }) => (
        <React.Fragment key={provider.key}>

          {/* Provider Label */}
          <Sheet variant='soft' sx={{ p: 1, borderBottom: '1px solid', borderBottomColor: 'neutral.softActiveBg' }}>
            <Typography level='title-sm'>
              {provider.label}
            </Typography>
          </Sheet>

          {/* Items */}
          {items.map((item) => {
            const index = itemIndices.findIndex(idx => idx.providerKey === provider.key && idx.itemKey === item.key);
            const isActive = itemIndices[index]?.isActive;

            const labelBold = item.label.slice(0, props.activePrefixLength);
            const labelNormal = item.label.slice(props.activePrefixLength);

            return (
              <ListItem
                key={`${provider.key}-${item.key}`}
                variant={isActive ? 'soft' : undefined}
                color={isActive ? 'primary' : undefined}
                onClick={() => props.onItemClick(item)}
              >
                <ListItemButton color='primary'>
                  {item.Icon && (
                    <ListItemDecorator>
                      <item.Icon />
                    </ListItemDecorator>
                  )}

                  {/* Item*/}
                  <Box>

                    {/* Item main text  */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography level='title-sm' color={isActive ? 'primary' : undefined}>
                        <span style={{ textDecoration: 'underline' }}><b>{labelBold}</b></span>{labelNormal}
                      </Typography>
                      {item.argument && <Typography level='body-sm'>
                        {item.argument}
                      </Typography>}
                    </Box>

                    {/* Item description */}
                    {!!item.description && <Typography level='body-xs'>
                      {item.description}
                    </Typography>}

                  </Box>

                </ListItemButton>
              </ListItem>
            );
          })}
        </React.Fragment>
      ))}

    </CloseablePopup>
  );
}
