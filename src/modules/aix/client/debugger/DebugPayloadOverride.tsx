import * as React from 'react';

import { Box, Button, Chip, Textarea, Typography } from '@mui/joy';
import DataObjectIcon from '@mui/icons-material/DataObject';

import { useIsMobile } from '~/common/components/useMatchMedia';

import { aixClientDebuggerSetRBO, useAixClientDebuggerStore } from './memstore-aix-client-debugger';


function _parseJsonOrError(json: string): { parsed: Record<string, unknown> | null; error: string | null } {
  if (!json.trim()) return { parsed: null, error: null };
  try {
    const result = JSON.parse(json);
    if (typeof result !== 'object' || result === null || Array.isArray(result))
      return { parsed: null, error: 'Must be a JSON object' };
    return { parsed: result, error: null };
  } catch (e: any) {
    return { parsed: null, error: e.message || 'Invalid JSON' };
  }
}


export function DebugPayloadOverride() {

  // external state
  const isMobile = useIsMobile();
  const storeJson = useAixClientDebuggerStore(state => state.requestBodyOverrideJson);

  // local state - initialize from store
  const [localJson, setLocalJson] = React.useState(storeJson);
  const { parsed, error } = React.useMemo(() => _parseJsonOrError(localJson), [localJson]);


  // [effect] sync local state with external
  React.useEffect(() => {
    setLocalJson(storeJson);
  }, [storeJson]);


  // derived
  const isActive = !!storeJson;
  const hasLocalChanges = localJson !== storeJson;
  const canApply = !!parsed && hasLocalChanges;
  const canClear = isActive || !!localJson;

  const handleApply = React.useCallback(() => {
    if (parsed)
      aixClientDebuggerSetRBO(localJson);
  }, [localJson, parsed]);

  const handleClear = React.useCallback(() => {
    setLocalJson('');
    aixClientDebuggerSetRBO('');
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isActive && <Chip size='sm' color='warning' variant='solid'>Active</Chip>}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} color={error ? 'danger.softColor' : hasLocalChanges ? 'primary.plainColor' : undefined} fontSize='sm' fontWeight='md' lineHeight='sm'>
          <DataObjectIcon sx={{ fontSize: 'md' }} />
          {error || (hasLocalChanges ? 'WARNING: Unsaved changes' : 'JSON request injection')}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>

        <Textarea
          placeholder='{"experimental_field": "value"}'
          value={localJson}
          onChange={(e) => setLocalJson(e.target.value)}
          error={!!error}
          minRows={2}
          maxRows={8}
          sx={{ flex: 1, fontFamily: 'code', fontSize: 'xs', backgroundColor: 'background.popup', boxShadow: 'none' }}
        />

        <Box sx={{ flex: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            size='sm'
            variant={canApply ? 'solid' : 'plain'}
            disabled={!canApply}
            onClick={handleApply}
          >
            Apply
          </Button>
          <Button
            size='sm'
            variant={storeJson ? 'solid' : 'soft'}
            color={storeJson ? 'primary' : 'neutral'}
            disabled={!canClear}
            onClick={handleClear}
          >
            Clear
          </Button>
        </Box>

      </Box>

      {!!storeJson && !hasLocalChanges && !isMobile && (
        <Typography level='body-xs'>
          Hint: you can press Shift + Ctrl + Z to regenerate the last `Chat` message.
        </Typography>
      )}

    </Box>
  );
}
