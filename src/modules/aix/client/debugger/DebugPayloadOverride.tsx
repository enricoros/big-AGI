import * as React from 'react';

import { Box, Button, Chip, Textarea, Typography } from '@mui/joy';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {isActive && <Chip size='sm' color='warning' variant='solid'>Active</Chip>}
        <Box color={error ? 'danger.softColor' : hasLocalChanges ? 'primary.plainColor' : 'warning.plainColor'} fontSize='sm' fontWeight='md' lineHeight='sm'>
          {error || (hasLocalChanges ? 'Unsaved changes' : 'JSON merged into the request body')}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>

        <Textarea
          placeholder='{"experimental_field": "value"}'
          value={localJson}
          onChange={(e) => setLocalJson(e.target.value)}
          error={!!error}
          minRows={3}
          maxRows={8}
          sx={{ flex: 1, fontFamily: 'code', fontSize: 'xs', backgroundColor: 'background.popup', boxShadow: 'none' }}
        />

        <Box sx={{ flex: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant={canApply ? 'soft' : 'plain'}
            disabled={!canApply}
            onClick={handleApply}
          >
            Apply
          </Button>
          <Button
            variant='soft'
            color='neutral'
            disabled={!canClear}
            onClick={handleClear}
          >
            Clear
          </Button>
        </Box>

      </Box>

      {!!storeJson && !hasLocalChanges && (
        <Typography level='body-xs'>
          Hint: you can press Shift + Ctrl + Z to regenerate the last `Chat` message.
        </Typography>
      )}

    </Box>
  );
}
