import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, FormHelperText, Typography } from '@mui/joy';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';

import { ExpanderControlledBox } from './ExpanderControlledBox';


const _styles = {

  header: {
    // style
    // borderRadius: 'sm',
    // borderBottom: '1px solid',
    // borderBottomColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.05)',

    // mimics ListItem
    py: 'var(--ListItem-paddingY, 0.25rem)',
    minBlockSize: 'var(--ListItem-minHeight, 2.25rem)',

    // layout
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1,

    // interactive when collapsible (role="button")
    '&[role="button"]': {
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      '&:hover': {
        backgroundColor: 'background.level2',
      },
    },

    // if expanded, soften the bottom border
    // '&[aria-expanded="false"]': {
    //   borderColor: 'transparent',
    // },
  },

  headerTextWrapper: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 0.25,
    // mb: 0.5,
  },

  aeHeaderIcon: {
    mr: 0,
    color: 'neutral.softColor',
    fontSize: 'md',
  },

} as const satisfies Record<string, SxProps>;


/**
 * Collapsible section with a clickable header and animated expand/collapse.
 * Semi-controlled: `expandRequest` nudges the internal state when its value changes.
 * Between controlled changes, the user can freely toggle via the header.
 */
export function ExpanderSection(props: {
  title: string | ((expanded: boolean) => string),
  description?: string | ((expanded: boolean) => string),
  isCollapsible?: boolean,
  expandRequest?: boolean, // the internal expanded state will track this on change
  initialExpanded: boolean, // only read at first mount
  startDecorator?: React.ReactNode,
  children: React.ReactNode,
}) {

  // state
  const [isExpanded, setIsExpanded] = React.useState(props.expandRequest ?? props.initialExpanded); // internal expanded, optionally synced with controlled prop

  // destructure
  const { isCollapsible = true } = props;


  // [effect] sync with expand request if/on changes
  React.useEffect(() => {
    if (props.expandRequest !== undefined) setIsExpanded(props.expandRequest);
  }, [props.expandRequest]);


  const handleToggle = React.useCallback(() => setIsExpanded(e => !e), []);


  const title = typeof props.title === 'function' ? props.title(isExpanded) : props.title;
  const description = typeof props.description === 'function' ? props.description(isExpanded) ?? null : props.description || null;


  return <>

    {/* Clickable header */}
    <Box
      aria-expanded={isExpanded}
      onClick={isCollapsible ? handleToggle : undefined}
      role={isCollapsible ? 'button' : undefined}
      sx={_styles.header}
    >
      {props.startDecorator}

      <Box sx={_styles.headerTextWrapper}>
        <Typography level='title-sm'>{title}</Typography>
        {!!description && <FormHelperText>{description}</FormHelperText>}
      </Box>

      {isCollapsible && !isExpanded && <UnfoldMoreIcon sx={_styles.aeHeaderIcon} />}
    </Box>

    {/* Content - always mounted, animated from 0 to height */}
    <ExpanderControlledBox expanded={isExpanded}>
      {props.children}
    </ExpanderControlledBox>

  </>;
}
