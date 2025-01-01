import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Checkbox, ListItem } from '@mui/joy';

import { overlayButtonsActiveSx } from '~/modules/blocks/OverlayButton';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';


// configuration
export const OPTIMA_PANEL_GROUPS_SPACING = 2.5;


const gutterSx: SxProps = {
  px: 'var(--ListItem-paddingX)',
  py: 'var(--ListItem-paddingY)',
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
};

export function OptimaPanelGroupGutter(props: { children?: React.ReactNode }) {
  return (
    <Box sx={gutterSx}>
      {props.children}
    </Box>
  );
}


const groupSx: SxProps = {
  // py: 'var(--ListDivider-gap)',
};

const headerSx: SxProps = {
  // style
  backgroundColor: 'background.level1',
  borderBottom: '1px solid',
  borderTop: '1px solid',
  borderColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.1)',
  // mb: 'var(--ListDivider-gap)',

  // '--A': 'var(--joy-palette-background-level1)',
  // '--B': 'var(--joy-palette-background-popup)',
  // background: 'linear-gradient(45deg, var(--A) 25%, var(--B) 25%, var(--B) 50%, var(--A) 50%, var(--A) 75%, var(--B) 75%)',
  // backgroundSize: '40px 40px',
  // boxShadow: 'xs',

  // if the role is button, show the cursor
  '&[role="button"]': {
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: 'background.level2',
    },
  },
};

const headerRowSx: SxProps = {
  flex: 1,

  // layout
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 1,

  // if there's a button, highlight it on hover
  '&:hover > button': overlayButtonsActiveSx,
};

const headerTitleSx: SxProps = {
  color: 'text.tertiary',
  fontSize: 'sm',
  fontWeight: 'lg',
};

const contentsSx: SxProps = {
  py: 'var(--ListDivider-gap)',
};


export function OptimaPanelGroup(props: {
  title: string;
  endDecorator?: React.ReactNode;
  children?: React.ReactNode;
  persistentCollapsibleId?: string;
  startExpanded?: boolean;
}) {

  // state
  // TODO: persist by id
  const [_expanded, setExpanded] = React.useState(props.startExpanded === true);

  // derived state
  const isCollapsible = !!props.persistentCollapsibleId;
  const isExpanded = !isCollapsible || _expanded;

  // handlers

  const toggleExpanded = React.useCallback(() => {
    setExpanded(expanded => !expanded);
  }, []);

  const endDecorator = React.useMemo(() => {
    if (isCollapsible)
      return <Checkbox size='md' color='neutral' checked={isExpanded} />;
    return props.endDecorator;
  }, [isCollapsible, isExpanded, props.endDecorator]);


  return (
    <Box sx={groupSx}>
      {/* Header */}
      {(!!props.title || !!props.endDecorator) && (
        <ListItem
          onClick={isCollapsible ? toggleExpanded : undefined}
          role={isCollapsible ? 'button' : undefined}
          sx={headerSx}
        >
          <Box sx={headerRowSx}>
            <Box sx={headerTitleSx}>{props.title}</Box>
            {endDecorator}
          </Box>
        </ListItem>
      )}

      {/* Items  */}
      <ExpanderControlledBox expanded={isExpanded} sx={contentsSx}>
        {props.children}
      </ExpanderControlledBox>
    </Box>
  );
}
