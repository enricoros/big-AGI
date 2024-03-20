import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, Dropdown, FormControl, IconButton, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, SvgIconProps, Tooltip, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MergeRoundedIcon from '@mui/icons-material/MergeRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { animationColorBeamGather } from '~/common/util/animUtils';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { GATHER_COLOR } from '../beam.config';
import { beamPaneSx } from '../BeamCard';

import { FUSION_FACTORIES } from './beam.gather';


const mobileBeamGatherPane: SxProps = {
  ...beamPaneSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // [mobile] larger gap in between rows, as on mobile we have a smaller gap
  rowGap: 'var(--Pad)',
};

const desktopBeamGatherPaneSx: SxProps = {
  ...beamPaneSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // [desktop] keep visible at the bottom
  position: 'sticky',
  bottom: 0,
};


function BeamGatherDropdown(props: {
  fusionShowPrompts: boolean,
  toggleFusionShowPrompts: () => void,
}) {
  return (
    <Dropdown>
      <MenuButton
        aria-label='Merge Options'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm', sx: { my: -0.5 /* to not disrupt the layouting */ } } }}
      >
        <MoreHorizRoundedIcon />
      </MenuButton>
      <Menu placement='right-end' sx={{ minWidth: 180 }}>
        <ListItem>
          <Typography level='body-sm'>Advanced</Typography>
        </ListItem>
        <MenuItem onClick={props.toggleFusionShowPrompts}>
          <ListItemDecorator>{props.fusionShowPrompts && <CheckRoundedIcon />}</ListItemDecorator>
          Show Prompts
        </MenuItem>
      </Menu>
    </Dropdown>
  );
}


export function BeamGatherPane(props: {
  isMobile: boolean,
  gatherBusy: boolean,
  gatherCount: number,
  gatherEnabled: boolean,
  gatherLlmComponent: React.ReactNode,
  gatherLlmIcon?: React.FunctionComponent<SvgIconProps>,
  fusionIndex: number | null,
  fusionShowPrompts: boolean,
  setFusionIndex: (index: number | null) => void,
  toggleFusionShowPrompts: () => void,
  onFusionCustomizeFrom: (index: number) => void,
  onFusionStart: () => void,
  onFusionStop: () => void,
}) {

  // external state
  const { setStickToBottom } = useScrollToBottom();

  // derived state
  const { gatherCount, gatherEnabled, gatherBusy, setFusionIndex, onFusionCustomizeFrom } = props;

  const handleFusionActivate = React.useCallback((idx: number, shiftPressed: boolean) => {
    setStickToBottom(true);
    setFusionIndex((idx !== props.fusionIndex || !shiftPressed) ? idx : null);
  }, [props.fusionIndex, setFusionIndex, setStickToBottom]);

  const handleFusionCustomize = React.useCallback(() => {
    props.fusionIndex !== null && onFusionCustomizeFrom(props.fusionIndex);
  }, [onFusionCustomizeFrom, props.fusionIndex]);

  const dropdownMemo = React.useMemo(() => {
    return <BeamGatherDropdown fusionShowPrompts={props.fusionShowPrompts} toggleFusionShowPrompts={props.toggleFusionShowPrompts} />;
  }, [props.fusionShowPrompts, props.toggleFusionShowPrompts]);


  const Icon = props.gatherLlmIcon || (gatherBusy ? AutoAwesomeIcon : AutoAwesomeOutlinedIcon);


  return (
    <Box sx={props.isMobile ? mobileBeamGatherPane : desktopBeamGatherPaneSx}>


      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 184 }}>
        <div>
          <Typography level='h4' component='h2' endDecorator={dropdownMemo}>
            <Icon sx={{ fontSize: '1rem', animation: gatherBusy ? `${animationColorBeamGather} 2s linear infinite` : undefined }} />&nbsp;Merge
          </Typography>
          <Typography level='body-sm' sx={{ whiteSpace: 'nowrap' }}>
            Combine the {gatherCount > 1 ? `${gatherCount} replies` : 'replies'}
          </Typography>
        </div>
        <ScrollToBottomButton inline />
      </Box>

      {/* Method */}
      <FormControl sx={{ my: '-0.25rem' }}>
        <FormLabelStart
          title={<><AutoAwesomeOutlinedIcon sx={{ fontSize: 'md', mr: 0.5 }} />Method</>}
          sx={{ mb: '0.25rem' /* orig: 6px */ }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonGroup variant='outlined'>
            {FUSION_FACTORIES.map((fusion, idx) => {
              const isActive = idx === props.fusionIndex;
              return (
                <Button
                  key={'gather-method-' + idx}
                  color={isActive ? GATHER_COLOR : 'neutral'}
                  onClick={event => handleFusionActivate(idx, !!event?.shiftKey)}
                  // size='sm'
                  sx={{
                    // backgroundColor: isActive ? 'background.popup' : undefined,
                    backgroundColor: isActive ? `${GATHER_COLOR}.softBg` : 'background.popup',
                    fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
                    // minHeight: '2.25rem',
                  }}
                >
                  {fusion.label}
                </Button>
              );
            })}
          </ButtonGroup>
          {(props.fusionIndex !== null) && (
            <Tooltip disableInteractive title='Customize This Merge'>
              <IconButton size='sm' color='success' disabled={props.gatherBusy || props.fusionIndex === 2} onClick={handleFusionCustomize}>
                {props.fusionIndex === 2 ? null : <EditRoundedIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </FormControl>

      {/* LLM */}
      <Box sx={{ my: '-0.25rem', minWidth: 190, maxWidth: 220 }}>
        {props.gatherLlmComponent}
      </Box>

      {/* Start / Stop buttons */}
      {!gatherBusy ? (
        <Button
          // key='gather-start' // used for animation triggering, which we don't have now
          variant='solid' color={GATHER_COLOR}
          disabled={!gatherEnabled || gatherBusy} loading={gatherBusy}
          endDecorator={<MergeRoundedIcon />}
          onClick={props.onFusionStart}
          sx={{ minWidth: 120 }}
        >
          Merge
        </Button>
      ) : (
        <Button
          // key='gather-stop'
          variant='solid' color='danger'
          endDecorator={<StopRoundedIcon />}
          onClick={props.onFusionStop}
          sx={{ minWidth: 120 }}
        >
          Stop
        </Button>
      )}

    </Box>
  );
}