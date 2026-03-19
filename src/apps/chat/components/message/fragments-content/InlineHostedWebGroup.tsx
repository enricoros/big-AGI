import * as React from 'react';

import { Box, Chip, IconButton, Sheet, Typography } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { InterleavedFragment } from '~/common/stores/chat/hooks/useFragmentBuckets';
import { isToolInvocationPart, isToolResponseFunctionCallPart } from '~/common/stores/chat/chat.fragments';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';

import { KeyValueGrid, type KeyValueData } from './BlockPartToolInvocation';
import { functionNameAppearance, getCompactInvocationDetails, humanReadableFunctionName } from './BlockPartToolInvocation.utils';


type HostedWebEntry = {
  key: string;
  label: string;
  details: KeyValueData;
};

function toHostedWebEntries(fragments: readonly InterleavedFragment[]): HostedWebEntry[] {
  return fragments.flatMap((fragment, index) => {
    if (fragment.ft !== 'content')
      return [];

    const { fId, part } = fragment;
    if (isToolInvocationPart(part) && part.invocation.type === 'function_call') {
      const compactDetails = getCompactInvocationDetails(part.invocation.name, part.invocation.args);
      return [{
        key: fId,
        label: `Request ${index + 1}`,
        details: compactDetails.length
          ? compactDetails
          : [{ label: 'Name', value: part.invocation.name }],
      }];
    }

    if (isToolResponseFunctionCallPart(part)) {
      const envInfo = functionNameAppearance(part.environment);
      return [{
        key: fId,
        label: `Response ${index + 1}`,
        details: [
          { label: 'Result', value: part.response.result, asCode: true },
          ...(part.error ? [{ label: 'Error', value: String(part.error) }] : []),
          { label: 'Environment', value: envInfo.label },
        ],
      }];
    }

    return [];
  });
}

export function InlineHostedWebGroup(props: {
  fragments: readonly InterleavedFragment[];
  contentScaling: ContentScaling;
  compactInline?: boolean;
  defaultExpanded?: boolean;
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {
  const [expanded, setExpanded] = React.useState(!!props.defaultExpanded);
  const { fontSize, lineHeight } = useScaledTypographySx(props.contentScaling, false, false);

  const header = React.useMemo(() => {
    const firstContentFragment = props.fragments.find(fragment => fragment.ft === 'content') ?? null;
    if (!firstContentFragment || firstContentFragment.ft !== 'content')
      return { humanName: 'Web Search', envInfo: null as ReturnType<typeof functionNameAppearance> | null };

    const { part } = firstContentFragment;
    if (isToolInvocationPart(part) && part.invocation.type === 'function_call') {
      return {
        humanName: humanReadableFunctionName(part.invocation.name, part.invocation.type, 'invocation'),
        envInfo: null as ReturnType<typeof functionNameAppearance> | null,
      };
    }

    if (isToolResponseFunctionCallPart(part)) {
      return {
        humanName: humanReadableFunctionName(part.response.name, part.response.type, 'response'),
        envInfo: functionNameAppearance(part.environment),
      };
    }

    return { humanName: 'Web Search', envInfo: null as ReturnType<typeof functionNameAppearance> | null };
  }, [props.fragments]);

  const entries = React.useMemo(() => toHostedWebEntries(props.fragments), [props.fragments]);
  const hasDetails = entries.length > 0;
  const responseEnvInfo = React.useMemo(() => {
    const responseFragment = props.fragments.find(fragment =>
      fragment.ft === 'content' && isToolResponseFunctionCallPart(fragment.part),
    );
    return responseFragment?.ft === 'content' && isToolResponseFunctionCallPart(responseFragment.part)
      ? functionNameAppearance(responseFragment.part.environment)
      : header.envInfo;
  }, [header.envInfo, props.fragments]);

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

          <Typography level='body-sm' sx={{ fontWeight: 'md' }}>
            {header.humanName}
          </Typography>

          {!!responseEnvInfo && (
            <Chip
              size='sm'
              color={responseEnvInfo.color}
              variant='soft'
              sx={{ ml: props.compactInline ? 0 : 'auto' }}
            >
              {responseEnvInfo.label}
            </Chip>
          )}
        </Box>

        {expanded && hasDetails && (
          <ExpanderControlledBox expanded>
            <Box sx={{ mt: 1, ml: 2.625, pl: 1, display: 'grid', gap: 1 }}>
              {entries.map(entry => (
                <Box key={entry.key} sx={{ display: 'grid', gap: 0.5 }}>
                  {entries.length > 1 && (
                    <Typography level='body-xs' sx={{ fontWeight: 'lg', opacity: 0.8 }}>
                      {entry.label}
                    </Typography>
                  )}
                  <KeyValueGrid data={entry.details} />
                </Box>
              ))}
            </Box>
          </ExpanderControlledBox>
        )}
      </Sheet>
    </Box></BlocksContainer>
  );
}
