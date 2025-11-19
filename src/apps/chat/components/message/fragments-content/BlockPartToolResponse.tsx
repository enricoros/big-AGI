import * as React from 'react';

import { Box, Chip, IconButton, Sheet, Typography } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageToolResponsePart } from '~/common/stores/chat/chat.fragments';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';

import { functionNameAppearance, humanReadableFunctionName } from './BlockPartToolInvocation.utils';
import { KeyValueData, KeyValueGrid } from './BlockPartToolInvocation';


export function BlockPartToolResponse(props: {
  toolResponsePart: DMessageToolResponsePart,
  contentScaling: ContentScaling,
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {

  // state
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const { fontSize, lineHeight } = useScaledTypographySx(props.contentScaling, false, false);


  // memo name

  const { id: rId, response, environment, error: rError } = props.toolResponsePart;

  const { humanName, originalName, envInfo } = React.useMemo(() => {
    const invocationType = response.type;
    const originalName = invocationType === 'function_call' ? response.name : 'code_execution';
    const humanName = humanReadableFunctionName(originalName, invocationType, 'response');
    const envInfo = functionNameAppearance(environment);
    return { humanName, originalName, envInfo };
  }, [response, environment]);

  // memo details data

  const detailsData: KeyValueData = React.useMemo(() => {
    switch (response.type) {
      case 'function_call':
        return [
          { label: 'Function', value: response.name },
          { label: 'Result', value: response.result, asCode: true },
          ...(!rError ? [] : [{ label: 'Error', value: String(rError) }]),
          { label: 'Environment', value: envInfo.label },
          { label: 'ID', value: rId },
        ];
      case 'code_execution':
        return [
          { label: 'Result', value: response.result, asCode: true },
          ...(!rError ? [] : [{ label: 'Error', value: String(rError) }]),
          { label: 'Executor', value: response.executor },
          { label: 'Environment', value: envInfo.label },
          { label: 'ID', value: rId },
        ];
    }
  }, [envInfo.label, rError, rId, response]);

  // memo border color

  const borderColor = React.useMemo(() => {
    if (rError) return 'danger.softBg';
    switch (environment) {
      case 'upstream':
        return 'primary.softBg';   // Hosted - blue
      case 'server':
        return 'neutral.softBg';     // Server - gray
      case 'client':
        return 'success.softBg';     // Client - green
    }
  }, [rError, environment]);


  const toggleExpanded = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setExpanded(prev => !prev);
  }, []);


  return (
    <BlocksContainer onDoubleClick={props.onDoubleClick}><Box /*sx={{ px: 1.5 }}*/>
      <Sheet
        variant='soft'
        color={rError ? 'danger' : undefined}
        sx={{
          borderLeft: '3px solid',
          borderLeftColor: borderColor,
          borderRadius: 'sm',
          pl: 1,
          pr: 2,
          py: 0.75,
          fontSize,
          lineHeight,
          display: 'flex',
          flexDirection: 'column',
          ...(expanded ? {
            border: '1px solid',
            borderColor: 'primary.outlinedBorder',
            boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
          } : {}),
        }}
      >

        {/* Compact header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            '&:hover': { '& .expand-icon': { opacity: 1 } },
          }}
          onClick={toggleExpanded}
        >
          <IconButton
            size='sm'
            className='expand-icon'
            sx={{
              minWidth: 'auto',
              minHeight: 'auto',
              padding: 0,
              opacity: expanded ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            {expanded ? <KeyboardArrowDownIcon fontSize='small' /> : <KeyboardArrowRightIcon fontSize='small' />}
          </IconButton>

          {/*<Tooltip title={humanName !== originalName ? `Original: ${originalName}` : undefined} placement='top'>*/}
          <Typography level='body-sm' sx={{ fontWeight: 'md' }}>
            {humanName}
          </Typography>
          {/*</Tooltip>*/}

          {rError && (
            <Chip size='sm' color='danger' variant='soft'>
              Error
            </Chip>
          )}

          <Chip size='sm' color={envInfo.color} variant='soft' sx={{ ml: 'auto' }}>
            {envInfo.label}
          </Chip>
        </Box>

        {/* Expanded details */}
        <ExpanderControlledBox expanded={expanded}>
          {expanded && <Box sx={{ mt: 1, ml: 2.625, pl: 1 }}>
            <KeyValueGrid
              data={detailsData}
              // contentScaling={props.contentScaling}
              // stableSx={_styleKeyValueGrid}
            />
          </Box>}
        </ExpanderControlledBox>

      </Sheet>

    </Box></BlocksContainer>
  );
}
