import * as React from 'react';

import { Box, Button, Checkbox, FormControl, FormLabel, Typography } from '@mui/joy';
import DoneIcon from '@mui/icons-material/Done';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { capitalizeFirstLetter, humanReadableBytes } from '~/common/util/textUtils';

import type { TradeAdapter, TradeItem } from './trade.types';
import { tradeAdapters } from './trade.client';
import { tradeFileSave } from './trade.files';
import { tradeMissingRefs } from './trade.plan';


interface Exportable {
  adapter: TradeAdapter;
  items: TradeItem[];
}

function _Row(props: { label: string, detail: string, warning?: string, checked: boolean, disabled: boolean, onChange?: (checked: boolean) => void }) {
  return (
    <FormControl orientation='horizontal' sx={{ gap: 1 }}>
      <Checkbox
        size='md' color='neutral'
        checked={props.checked} disabled={props.disabled}
        onChange={event => props.onChange?.(event.target.checked)}
      />
      <FormLabel sx={{ fontWeight: 'sm', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: props.disabled ? 0.5 : 1 }}>
        {props.label}
        <Typography level='body-xs' sx={{ fontWeight: 'normal', color: 'text.secondary', maxWidth: 220 }}>
          {props.detail}
        </Typography>
        {!!props.warning && (
          <Typography level='body-xs' color='warning' sx={{ fontWeight: 'normal', maxWidth: 220 }}>
            {props.warning}
          </Typography>
        )}
      </FormLabel>
    </FormControl>
  );
}


/**
 * Export what this build holds into one file, one checkbox per kind of data.
 */
export function TradeExportAll() {

  // state
  const [exportables, setExportables] = React.useState<Exportable[] | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);


  // read what there is to export, once shown
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded: Exportable[] = [];
      for (const adapter of tradeAdapters())
        if (!adapter.importOnly)
          loaded.push({ adapter, items: adapter.unavailable ? [] : (await adapter.localItems()).items });
      if (cancelled) return;
      setExportables(loaded);
      // everything but the credentials, which the user adds knowingly
      setSelected(new Set(loaded.filter(({ adapter, items }) => !adapter.secrets && items.length).map(({ adapter }) => adapter.type)));
    })().catch((error: any) => !cancelled && setError(error?.message || 'Could not read what there is to export.'));
    return () => {
      cancelled = true;
    };
  }, []);


  const handleExport = React.useCallback(() => {
    const toExport = (exportables ?? []).filter(({ adapter, items }) => selected.has(adapter.type) && items.length);
    if (!toExport.length) return;
    setBusy(true);
    setSaved(null);
    setError(null);
    tradeFileSave(toExport.map(({ adapter, items }) => ({ type: adapter.type, schema: adapter.schema, items })))
      .then(({ sizeBytes }) => setSaved(`Saved ${toExport.map(({ adapter, items }) => `${items.length.toLocaleString()} ${items.length === 1 ? adapter.label : adapter.labelPlural}`).join(', ')} - ${humanReadableBytes(sizeBytes)}`))
      .catch((error: any) => error?.name !== 'AbortError' && setError(error?.message || 'Could not save the export.'))
      .finally(() => setBusy(false));
  }, [exportables, selected]);

  const hasSelection = !!exportables?.some(({ adapter, items }) => selected.has(adapter.type) && items.length);

  // what the selected kinds need of the kinds that are left out: by kind, said on its row
  const leftOut = React.useMemo(() => {
    const warnings = new Map<string, string>();
    if (!exportables) return warnings;
    const adapters = exportables.map(({ adapter }) => adapter);
    const ids = new Map(exportables.map(({ adapter, items }) => [adapter.type, new Set(items.map(item => item.id))]));
    for (const { adapter, items } of exportables)
      if (selected.has(adapter.type) && adapter.refersTo) {
        const missing = tradeMissingRefs(adapter, items, adapters, (type, id) => !selected.has(type) && !!ids.get(type)?.has(id));
        if (missing.length)
          warnings.set(adapter.type, missing.map(({ referred, count }) => `${count.toLocaleString()} ${count === 1 ? 'needs' : 'need'} ${referred.labelPlural} that this export leaves out`).join(', '));
      }
    return warnings;
  }, [exportables, selected]);


  return <>

    <Typography level='body-sm'>
      Export <strong>your data</strong> to one file:
    </Typography>

    {/* a well: what goes in the file is chosen in it, and exported from it */}
    <Box sx={{
      display: 'grid',
      gap: 1.25,
      p: 1.5, // the checkboxes and the button share their left edge
      borderRadius: 'sm',
      backgroundColor: 'background.level1',
      boxShadow: 'inset 1px 1px 4px -2px rgba(0, 0, 0, 0.2)',
    }}>
      {exportables?.map(({ adapter, items }) => (
        <_Row
          key={adapter.type}
          label={capitalizeFirstLetter(adapter.labelPlural)}
          detail={adapter.unavailable || (!items.length ? 'none' : `${items.length.toLocaleString()}${adapter.secrets ? ' - API keys, as plain text in the file' : ''}`)}
          warning={leftOut.get(adapter.type)}
          checked={selected.has(adapter.type) && !!items.length}
          disabled={!items.length}
          onChange={checked => setSelected(current => {
            const next = new Set(current);
            checked ? next.add(adapter.type) : next.delete(adapter.type);
            return next;
          })}
        />
      ))}
      {/* they live outside the conversations, and no adapter exports them yet */}
      <_Row label='Images' detail='not exported: only a device backup holds them' checked={false} disabled />

      <Button
        variant='soft' disabled={!hasSelection || busy} loading={busy}
        color={saved ? 'success' : error ? 'warning' : 'primary'}
        endDecorator={saved ? <DoneIcon /> : <FileDownloadOutlinedIcon />}
        sx={{ mt: 0.5, minWidth: 240, justifyContent: 'space-between', boxShadow: 'xs', backgroundColor: 'background.popup' }}
        onClick={handleExport}
      >
        Export
      </Button>

      {!!saved && <Typography level='body-xs' color='success' sx={{ maxWidth: 240 }}>{saved}</Typography>}
      {!!error && <Typography level='body-xs' color='danger' sx={{ maxWidth: 240 }}>{error}</Typography>}
    </Box>

  </>;
}
