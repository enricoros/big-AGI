import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Sheet, Typography } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageToolInvocationPart } from '~/common/stores/chat/chat.fragments';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';

import {
  getCompactInvocationDetails,
  humanReadableFunctionName,
  isHostedWebToolInvocationPart,
} from './BlockPartToolInvocation.utils';


const keyValueGridSx = {
  // border: '1px solid',
  // borderRadius: 'sm',
  // boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
  // p: 1.5,

  // Grid layout with 2 columns
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  // alignItems: 'baseline',
  columnGap: 2,
  rowGap: 0.5,

  // fade the text of the first column
  // '& > :nth-of-type(odd)': {
  //   opacity: 0.67,
  //   // fontSize: '90%',
  // },
} as const;

const _styleKeyValueGrid: SxProps = {
  border: 'none',
  boxShadow: 'none',
  p: 0,
  fontSize: '0.875em',
  opacity: 0.9,
} as const;


export type KeyValueData = { label: string, value: React.ReactNode, asCode?: boolean }[];

export function KeyValueGrid(props: {
  data: KeyValueData,
  // contentScaling: ContentScaling,
  // color?: ColorPaletteProp,
  // variant?: VariantProp,
  // stableSx?: SxProps,
}) {

  // const { fontSize, lineHeight } = useScaledTypographySx(props.contentScaling, false, false);

  const gridSx = React.useMemo(() => ({
    ...keyValueGridSx,
    // fontWeight,
    // fontSize,
    // lineHeight,
    // ...props.stableSx,
    _styleKeyValueGrid,
  }), [/*props.stableSx*/]);

  return (
    <Box
      // color={props.color}
      // variant={props.variant || 'soft'}
      sx={gridSx}
    >
      {props.data.map(({ label, value }, index) => (
        <React.Fragment key={index}>
          <div>{label}</div>
          <div>{value}</div>
        </React.Fragment>
      ))}
    </Box>
  );
}


export function BlockPartToolInvocation(props: {
  toolInvocationPart: DMessageToolInvocationPart,
  contentScaling: ContentScaling,
  compactInline?: boolean,
  defaultExpanded?: boolean,
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {

  // state
  const [expanded, setExpanded] = React.useState(!!props.defaultExpanded);

  // external state
  const { fontSize, lineHeight } = useScaledTypographySx(props.contentScaling, false, false);


  // memo name

  const { id: iId, invocation } = props.toolInvocationPart;

  const { humanName, originalName } = React.useMemo(() => {
    const invocationType = invocation.type;
    const originalName = invocationType === 'function_call' ? invocation.name : 'code_execution';
    const humanName = humanReadableFunctionName(originalName, invocationType, 'invocation');
    return { humanName, originalName };
  }, [invocation]);


  // memo details

  const suppressHostedWebDetails = React.useMemo(
    () => isHostedWebToolInvocationPart(props.toolInvocationPart),
    [props.toolInvocationPart],
  );

  const detailsData: KeyValueData = React.useMemo(() => {
    switch (invocation.type) {
      case 'function_call': {
        const compactDetails = getCompactInvocationDetails(invocation.name, invocation.args);
        if (suppressHostedWebDetails)
          return [];

        return [
          { label: 'Name', value: invocation.name },
          ...(compactDetails.length ? compactDetails : []),
          { label: 'ID', value: iId },
        ];
      }
      case 'code_execution':
        return [
          { label: 'Language', value: invocation.language },
          { label: 'Author', value: invocation.author },
          {
            label: 'Code',
            value: <div style={{ whiteSpace: 'pre-wrap' }}>{invocation.code.trim()}</div>,
          },
          { label: 'ID', value: iId },
        ];
    }
  }, [invocation, iId, suppressHostedWebDetails]);
  const hasDetails = detailsData.length > 0;


  const toggleExpanded = React.useCallback((event: React.MouseEvent) => {
    if (!hasDetails)
      return;
    event.stopPropagation();
    setExpanded(prev => !prev);
  }, [hasDetails]);


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
        sx={{
          borderLeft: '3px solid',
          borderLeftColor: 'primary.softBg',
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

        {/* Compact header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexWrap: 'wrap',
            cursor: hasDetails ? 'pointer' : 'default',
            '&:hover': hasDetails ? { '& .expand-icon': { opacity: 1 } } : undefined,
          }}
          onClick={hasDetails ? toggleExpanded : undefined}
        >
          {hasDetails && (
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
          )}

          {/*<Tooltip title={humanName !== originalName ? `Original: ${originalName}` : undefined} placement='top'>*/}
          <Typography level='body-sm' sx={{ fontWeight: 'md' }}>
            {humanName}
          </Typography>
          {/*</Tooltip>*/}
        </Box>

        {/* Expanded details */}
        {expanded && hasDetails && <ExpanderControlledBox expanded>
          <Box sx={{ mt: 1, ml: 2.625, pl: 1 }}>
            <KeyValueGrid
              data={detailsData}
              // contentScaling={props.contentScaling}
              // stableSx={_styleKeyValueGrid}
            />
          </Box>
        </ExpanderControlledBox>}

      </Sheet>

    </Box></BlocksContainer>
  );
}
