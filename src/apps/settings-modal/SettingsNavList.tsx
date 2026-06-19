import * as React from 'react';

import { List, ListItem, ListItemButton, ListItemContent } from '@mui/joy';

import type { SettingsNavId } from './settings.nav';
import { SETTINGS_NAV } from './settings.nav';


const _styles = {
  // tinted, full-height sidebar (width is set by the grid column track in SettingsModal, so Joy
  // List's intrinsic flex-grow can't widen it) - the space below the items reads as a panel.
  list: {
    height: '100%',
    // py: 1.75,
    py: 2,
    // pl: 1.5,
    // pr: 1,
    // gap: 0.25,
    // borderRight: '1px solid',
    // borderColor: 'divider',
    // backgroundColor: 'background.level2',
    overflowY: 'auto',
    '--ListItem-minHeight': '2.25rem',
    '--ListItemDecorator-size': '1.75rem',
  },

  // top-level items carry a touch more weight than their sub-items
  topButton: {
    pl: 2,
    border: 0,
    backgroundColor: 'transparent',
    // fontWeight: 'md',
    // '--Icon-color': 'var(--joy-palette-primary-solidBg)',
    '&.Mui-selected': {
      // borderLeft: '3px solid',
      // borderColor: 'primary.500',
      boxShadow: 'inset 4px 0 0 0 var(--joy-palette-primary-solidBg)',
      color: 'primary.softColor',
      // '&:hover': { backgroundColor: '...' },
      // backgroundColor: 'transparent',
      // color: 'text.primary',
    },
  },

  childButton: {
    pl: 4.5,
    border: 0,
    backgroundColor: 'transparent',
    // fontWeight: 'normal',
    // '--Icon-color': 'var(--joy-palette-primary-solidBg)',
    '&.Mui-selected': {
      boxShadow: 'inset 2px 0 0 0 var(--joy-palette-primary-solidBg)',
      color: 'primary.softColor',
    }
  },
} as const;


/**
 * Desktop left navigation: an always-expanded tree of top-level items with their sub-items
 * indented beneath. Selecting a top-level item shows all its sub-sections on the right;
 * selecting a sub-item shows just that one.
 */
export function SettingsNavList(props: {
  value: SettingsNavId,
  onSelect: (id: SettingsNavId) => void,
}) {

  const { value, onSelect } = props;

  return (
    <List size='sm' sx={_styles.list}>
      {SETTINGS_NAV.map((node) => {
        const nodeSelected = value === node.id;
        return (
          <React.Fragment key={node.id}>
            <ListItem>
              <ListItemButton
                selected={nodeSelected}
                color={nodeSelected ? 'primary' : undefined}
                variant={nodeSelected ? undefined : 'soft'}
                onClick={() => onSelect(node.id)}
                sx={_styles.topButton}
              >
                {/*<ListItemDecorator>{node.icon}</ListItemDecorator>*/}
                <ListItemContent>{node.label}</ListItemContent>
              </ListItemButton>
            </ListItem>
            {node.children?.map((child) => {
              const childSelected = value === child.id;
              return (
                <ListItem key={child.id}>
                  <ListItemButton
                    selected={childSelected}
                    color={childSelected ? 'primary' : undefined}
                    variant={childSelected ? undefined : 'soft'}
                    onClick={() => onSelect(child.id)}
                    sx={_styles.childButton}
                  >
                    {/*<ListItemDecorator>{child.icon}</ListItemDecorator>*/}
                    <ListItemContent>{child.label}</ListItemContent>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </React.Fragment>
        );
      })}
    </List>
  );
}
