import * as React from 'react';

import { Box, Chip, IconButton, Sheet, Typography } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageToolInvocationPart, DMessageToolResponsePart } from '~/common/stores/chat/chat.fragments';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';

import { functionNameAppearance, getCompactInvocationDetails } from './BlockPartToolInvocation.utils';
import { KeyValueGrid, type KeyValueData } from './BlockPartToolInvocation';


export function BlockPartSubagentCall(props: {
  toolInvocationPart: DMessageToolInvocationPart,
  toolResponsePart?: DMessageToolResponsePart | null,
  contentScaling: ContentScaling,
  compactInline?: boolean,
  defaultExpanded?: boolean,
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {
  const [expanded, setExpanded] = React.useState(!!props.defaultExpanded);

  const { fontSize, lineHeight } = useScaledTypographySx(props.contentScaling, false, false);
  const { id: invocationId, invocation } = props.toolInvocationPart;
  const responsePart = props.toolResponsePart ?? null;

  const responseMeta = React.useMemo(() => {
    if (!responsePart)
      return null;

    return {
      envInfo: functionNameAppearance(responsePart.environment),
      error: responsePart.error,
    };
  }, [responsePart]);

  const detailsData: KeyValueData = React.useMemo(() => {
    if (invocation.type !== 'function_call')
      return [{ label: 'ID', value: invocationId }];

    return [
      { label: 'Name', value: invocation.name },
      ...getCompactInvocationDetails(invocation.name, invocation.args),
      ...(responsePart ? [{ label: 'Result', value: responsePart.response.result, asCode: true }] : []),
      ...(!responseMeta?.error ? [] : [{ label: 'Error', value: String(responseMeta.error) }]),
      ...(responseMeta ? [{ label: 'Environment', value: responseMeta.envInfo.label }] : []),
      { label: 'ID', value: invocationId },
    ];
  }, [invocation, invocationId, responseMeta, responsePart]);

  const borderColor = responsePart
    ? responsePart.error
      ? 'danger.softBg'
      : responsePart.environment === 'upstream'
        ? 'primary.softBg'
        : responsePart.environment === 'server'
          ? 'neutral.softBg'
          : 'success.softBg'
    : 'primary.softBg';

  const toggleExpanded = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  return (
    <BlocksContainer
      onDoubleClick={props.onDoubleClick}
      sx={props.compactInline ? {
        width: 'auto',
        overflowX: 'visible',
        display: 'inline-flex',
        flex: '0 0 auto',
        maxWidth: '100%',
        verticalAlign: 'top',
      } : undefined}
    ><Box sx={props.compactInline ? { display: 'inline-flex', maxWidth: '100%' } : undefined}>
      <Sheet
        variant='soft'
        color={responsePart?.error ? 'danger' : undefined}
        sx={{
          borderLeft: '3px solid',
          borderLeftColor: borderColor,
          borderRadius: 'sm',
          pl: 1,
          pr: 2,
          py: props.compactInline ? 0.5 : 0.75,
          fontSize,
          lineHeight,
          display: 'flex',
          flexDirection: 'column',
          width: props.compactInline ? 'auto' : undefined,
          maxWidth: '100%',
          ...(expanded ? {
            border: '1px solid',
            borderColor: 'primary.outlinedBorder',
            boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
          } : {}),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexWrap: 'wrap',
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

          <Typography level='body-sm' sx={{ fontWeight: 'md' }}>
            Subagent
          </Typography>

          {responsePart?.error && (
            <Chip size='sm' color='danger' variant='soft'>
              Error
            </Chip>
          )}

          {responseMeta && (
            <Chip
              size='sm'
              color={responseMeta.envInfo.color}
              variant='soft'
              sx={{ ml: props.compactInline ? 0 : 'auto' }}
            >
              {responseMeta.envInfo.label}
            </Chip>
          )}
        </Box>

        {expanded && (
          <ExpanderControlledBox expanded>
            <Box sx={{ mt: 1, ml: 2.625, pl: 1 }}>
              <KeyValueGrid data={detailsData} />
            </Box>
          </ExpanderControlledBox>
        )}
      </Sheet>
    </Box></BlocksContainer>
  );
}
