import * as React from 'react';

import { Box, Button, Checkbox, Chip, IconButton, Link, Option, Select, Sheet, Typography } from '@mui/joy';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { DiffViewer } from '~/common/components/diff/DiffViewer';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { useIsMobile } from '~/common/components/useMatchMedia';

import type { TradeAdapter, TradeItem, TradeOp, TradeRejected, TradeRelation, TradeResolution } from './trade.types';
import { FlashRestore } from './BackupRestore';
import { tradeAdapters } from './trade.client';
import { type TradeConflictPolicy, tradeDefaultResolution, tradePlanOps, type TradePlanRow, tradePreview, type TradePreviewGroup, tradeResolutionChoices } from './trade.plan';
import { tradeFilesPick, tradeFilesRead, type TradeNote, type TradeSource } from './trade.files';


export type ImportConfig = { dir: 'import', files?: File[] };


// configuration
const MAX_ROWS_SHOWN = 100; // per kind of data: the rows that need attention come first
const MAX_REJECTED_SHOWN = 20;

const RELATION_ORDER: TradeRelation[] = ['conflict', 'removed', 'mergeable', 'ahead', 'new', 'behind', 'same'];

const RELATION_LABEL: Record<TradeRelation, string> = {
  conflict: 'to decide (changed on both)',
  removed: 'deleted here',
  mergeable: 'to merge',
  ahead: 'to update',
  new: 'new',
  behind: 'kept (changed only here)',
  same: 'same',
};

const RESOLUTION_LABEL: Record<TradeResolution, string> = {
  'add': 'Add',
  'accept-incoming': 'Use the file\'s',
  'accept-local': 'Keep this device\'s',
  'merge': 'Merge',
  'keep-both': 'Keep both',
};

const RESOLUTION_DONE: Record<TradeResolution, string> = {
  'add': 'added',
  'accept-incoming': 'updated',
  'accept-local': 'kept',
  'merge': 'merged',
  'keep-both': 'copied',
};


interface Preview {
  sources: TradeSource[];
  groups: TradePreviewGroup[];
  notes: TradeNote[];
}

interface Applied {
  counts: Partial<Record<TradeResolution, number>>;
  failed: TradeRejected[];
  onReload: { adapter: TradeAdapter, ops: TradeOp[] }[]; // decided, and written by the reload button
}


/** What a file holds that is not imported: one line, and what it counts on request. */
function NoteLine(props: { note: TradeNote }) {
  const [showNames, setShowNames] = React.useState(false);
  const { text, names } = props.note;
  return (
    <Typography level='body-xs' sx={{ overflowWrap: 'anywhere' }}>
      {text}
      {!!names?.length && <> - <Link component='button' level='body-xs' onClick={() => setShowNames(on => !on)}>{showNames ? 'hide' : 'show'}</Link></>}
      {showNames && <Box component='span' sx={{ display: 'block', color: 'text.tertiary' }}>{names?.join(', ')}</Box>}
    </Typography>
  );
}


async function _preview(sources: TradeSource[]): Promise<Preview> {
  const { groups, unread } = await tradePreview(sources.flatMap(source => source.sections), tradeAdapters());
  return {
    sources,
    groups,
    notes: [
      ...sources.flatMap(source => source.notes),
      ...unread.map(section => ({ text: `Not supported in this version: ${section.items.length.toLocaleString()} items of kind '${section.type}'` })),
    ],
  };
}

const _rowKey = (adapter: TradeAdapter, id: string) => `${adapter.type}/${id}`;

// credentials and settings replace this device's, and can point a service at another host: the user ticks them
const _selectedByDefault = (adapter: TradeAdapter) => !adapter.secrets && !adapter.appliesOnReload && !adapter.unavailable;

// a file is untrusted input: an item that cannot be described still shows
function _describe(adapter: TradeAdapter, item: TradeItem): { title: string, detail?: string } {
  try {
    const { title, detail } = adapter.describe(item);
    return { title: String(title), ...(typeof detail === 'string' && { detail }) };
  } catch {
    return { title: item.id };
  }
}

function _compareText(adapter: TradeAdapter, item: TradeItem): string {
  try {
    return adapter.compareText?.(item) ?? JSON.stringify(item.data, null, 2);
  } catch {
    return '';
  }
}


/**
 * Import any Big-AGI file: shows what it would do, then does it.
 */
export function TradeImport(props: {
  files?: File[],
  onConversationActivate: (conversationId: DConversationId) => void,
}) {

  // state
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [chosen, setChosen] = React.useState<ReadonlyMap<string, TradeResolution | null>>(new Map());
  const [settled, setSettled] = React.useState<ReadonlySet<string>>(new Set()); // decided for this device's version: not asked again
  const [onConflict, setOnConflict] = React.useState<TradeConflictPolicy>(null);
  const [expandedType, setExpandedType] = React.useState<string | null>(null);
  const [comparing, setComparing] = React.useState<{ adapter: TradeAdapter, row: TradePlanRow } | null>(null);
  const [applied, setApplied] = React.useState<Applied | null>(null);

  // external state
  const isMobile = useIsMobile();

  const { files: initialFiles, onConversationActivate } = props;


  // handlers

  const handleLoad = React.useCallback(async (files: File[] | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const loaded = await _preview(await tradeFilesRead(files));
      setPreview(loaded);
      setSelected(new Set(loaded.groups.filter(group => _selectedByDefault(group.adapter)).map(group => group.adapter.type)));
      setExpandedType(loaded.groups.length === 1 ? loaded.groups[0].adapter.type : null);
      setChosen(new Map());
      setSettled(new Set());
      setOnConflict(null);
      setApplied(null);
    } catch (error: any) {
      setError(error?.message || 'Could not read the files.');
    } finally {
      setBusy(false);
    }
  }, []);

  // files handed over by the caller: a drop, a shortcut
  React.useEffect(() => {
    void handleLoad(initialFiles ?? null);
  }, [handleLoad, initialFiles]);

  const opsOf = React.useCallback(({ adapter, rows }: TradePreviewGroup): TradeOp[] => {
    const open = rows.filter(row => !settled.has(_rowKey(adapter, row.id)));
    const openChosen = new Map<string, TradeResolution | null>();
    for (const row of open)
      if (chosen.has(_rowKey(adapter, row.id)))
        openChosen.set(row.id, chosen.get(_rowKey(adapter, row.id))!);
    return tradePlanOps(open, openChosen, onConflict);
  }, [chosen, onConflict, settled]);

  const handleApply = React.useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const result: Applied = { counts: {}, failed: [], onReload: [...(applied?.onReload ?? [])] };
    const nowSettled = new Set(settled);
    try {
      for (const group of preview.groups) {
        const { adapter } = group;
        if (!selected.has(adapter.type)) continue;
        const ops = opsOf(group);
        if (!ops.length) continue;
        if (adapter.appliesOnReload) {
          result.onReload = [...result.onReload.filter(pending => pending.adapter.type !== adapter.type), { adapter, ops }];
          continue;
        }
        const { failed } = await adapter.apply(ops);
        const failedIds = new Set(failed.map(failure => failure.id));
        const titles = new Map(ops.map(op => [op.item.id, op.item]));
        result.failed.push(...failed.map(failure => ({ ...failure, title: failure.title ?? (failure.id && titles.has(failure.id) ? _describe(adapter, titles.get(failure.id)!).title : undefined) })));
        const done = ops.filter(op => !failedIds.has(op.item.id));
        for (const op of done) {
          result.counts[op.resolution] = (result.counts[op.resolution] ?? 0) + 1;
          // this device's version stays as it is: the row would relate the same way on every import
          if (op.resolution === 'accept-local' || op.resolution === 'keep-both')
            nowSettled.add(_rowKey(adapter, op.item.id));
        }

        // a single conversation that arrived is opened
        const written = done.filter(op => op.resolution !== 'accept-local' && op.resolution !== 'keep-both');
        if (adapter.type === 'chat' && written.length === 1 && !failed.length)
          onConversationActivate(written[0].item.id);
      }
      // what was written now relates as the same: the rows that remain are the ones nobody decided, or left as they are
      setPreview(await _preview(preview.sources));
    } catch (error: any) {
      setError(error?.message || 'The import stopped.');
    } finally {
      setSelected(new Set([...selected].filter(type => !result.onReload.some(pending => pending.adapter.type === type))));
      setChosen(new Map([...chosen].filter(([, resolution]) => resolution === null)));
      setSettled(nowSettled);
      setOnConflict(null);
      setApplied(result);
      setBusy(false);
    }
  }, [applied, chosen, onConversationActivate, opsOf, preview, selected, settled]);

  const handleApplyOnReload = React.useCallback(async () => {
    if (!applied) return;
    setBusy(true);
    // written and reloaded in one go: a store that saves in between would write its old value back
    const failed: TradeRejected[] = [];
    for (const { adapter, ops } of applied.onReload)
      failed.push(...(await adapter.apply(ops)).failed);
    if (failed.length)
      alert(`Not saved: ${failed.map(failure => `${failure.title ?? failure.id} (${failure.reason})`).join(', ')}.\n\nThe application will now reload with what was saved.`);
    window.location.reload();
  }, [applied]);

  const handleToggleSelected = React.useCallback((type: string, on: boolean) => setSelected(current => {
    const next = new Set(current);
    on ? next.add(type) : next.delete(type);
    return next;
  }), []);

  const handleChoose = React.useCallback((key: string, resolution: TradeResolution | null) => setChosen(current => new Map(current).set(key, resolution)), []);


  // nothing loaded: choose a file

  if (!preview) return (
    <Box sx={{ display: 'grid', gap: 1, mx: 'auto' }}>

      <Typography level='body-sm'>
        Import <strong>any Big-AGI file</strong>: an export, chats, a backup.
      </Typography>
      <Button
        variant='soft' loading={busy} endDecorator={<FileUploadOutlinedIcon />} sx={{ minWidth: 240, justifyContent: 'space-between', boxShadow: 'md', backgroundColor: 'background.popup' }}
        onClick={() => tradeFilesPick().then(handleLoad)}
      >
        Choose Files
      </Button>
      {/*<Typography level='body-xs'>*/}
      {/*  Nothing changes until you confirm.*/}
      {/*</Typography>*/}
      {!!error && <Typography level='body-sm' color='danger'>{error}</Typography>}

    </Box>
  );


  // loaded: what the import would do

  const groups = preview.groups.map(group => ({ ...group, rows: group.rows.filter(row => !settled.has(_rowKey(group.adapter, row.id))) }));
  const selectedGroups = groups.filter(group => selected.has(group.adapter.type));
  const conflicts = selectedGroups.flatMap(group => group.rows.filter(row => row.relation === 'conflict').map(row => _rowKey(group.adapter, row.id)));
  const conflictCount = conflicts.filter(key => !chosen.has(key)).length; // the ones the policy below decides
  const undecidedCount = conflicts.filter(key => chosen.has(key) ? !chosen.get(key) : !onConflict).length;
  const ops = selectedGroups.flatMap(opsOf);
  const writeCount = ops.filter(op => op.resolution !== 'accept-local').length;
  const reloadPending = !!applied?.onReload.length;

  return <>

    {/* Where it comes from, and what is not imported */}
    <Box>
      {preview.sources.map((source, index) => (
        <Typography key={index} level='body-sm' color={source.error ? 'danger' : undefined} sx={{ overflowWrap: 'anywhere' }}>
          <strong>{source.fileName}</strong>
          {source.error ? ` - ${source.error}`
            : source.origin?.exported ? ` - ${source.origin.tenantSlug ? capitalizeFirstLetter(source.origin.tenantSlug) + ', ' : ''}${new Date(source.origin.exported).toLocaleString()}`
              : ''}
        </Typography>
      ))}
      {preview.notes.map((note, index) => <NoteLine key={index} note={note} />)}

      {/* A device backup saved with its images: the device restore is the one way to bring them, and it replaces everything */}
      {preview.sources.map((source, index) => !!source.holdsImages && !!source.file && (
        <Box key={index} sx={{ display: 'grid', gap: 1, maxWidth: 320 }}>
          <FlashRestore unlockRestore file={source.file} />
        </Box>
      ))}
    </Box>

    {/* What was done, and what waits for the reload */}
    {!!applied && (
      <Sheet variant='soft' color={applied.failed.length || reloadPending ? 'warning' : 'success'} sx={{ p: 1.5, borderRadius: 'md', display: 'grid', gap: 0.5 }}>
        <Typography level='body-sm'>
          {(Object.keys(RESOLUTION_DONE) as TradeResolution[]).filter(resolution => applied.counts[resolution]).map(resolution => `${applied.counts[resolution]!.toLocaleString()} ${RESOLUTION_DONE[resolution]}`).join(' - ') || (reloadPending ? '' : 'Nothing was written.')}
          {!!applied.failed.length && ` - ${applied.failed.length.toLocaleString()} failed`}
        </Typography>
        {applied.failed.slice(0, MAX_REJECTED_SHOWN).map((failure, index) => <Typography key={index} level='body-xs' color='danger' sx={{ overflowWrap: 'anywhere' }}>{failure.title ?? failure.id}: {failure.reason}</Typography>)}
        {reloadPending && <>
          <Typography level='body-sm'>
            Not written yet: {applied.onReload.map(pending => pending.adapter.labelPlural).join(' and ')}. They replace this device&apos;s when the application reloads; closing this dialog leaves them out.
          </Typography>
          <Button color='warning' loading={busy} onClick={handleApplyOnReload} sx={{ justifySelf: 'start' }}>
            Replace {applied.onReload.map(pending => pending.adapter.labelPlural).join(' and ')} and reload
          </Button>
        </>}
      </Sheet>
    )}

    {!!error && <Typography level='body-sm' color='danger'>{error}</Typography>}

    {/* One row per kind of data */}
    {groups.map(({ adapter, rows, rejected, missing }) => {
      const isSelected = selected.has(adapter.type);
      const isExpanded = expandedType === adapter.type;
      const counts = RELATION_ORDER.map(relation => [relation, rows.filter(row => row.relation === relation).length] as const).filter(([, count]) => count);
      const changing = rows.filter(row => row.relation !== 'same');
      const shownRows = !isExpanded ? [] : [...changing].sort((a, b) => RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation)).slice(0, MAX_ROWS_SHOWN);
      return (
        <Sheet key={adapter.type} variant='outlined' sx={{ p: 1.5, borderRadius: 'md', display: 'grid', gap: 1 }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              size='md' color='neutral'
              checked={isSelected} disabled={!!adapter.unavailable || !rows.length}
              onChange={event => handleToggleSelected(adapter.type, event.target.checked)}
            />
            <Box sx={{ flex: 1, opacity: isSelected ? 1 : 0.6 }}>
              <Typography level='title-sm'>
                {capitalizeFirstLetter(adapter.labelPlural)}
              </Typography>
              <Typography level='body-xs'>
                {adapter.unavailable
                  || [...counts.map(([relation, count]) => `${count.toLocaleString()} ${RELATION_LABEL[relation]}`), ...(rejected.length ? [`${rejected.length.toLocaleString()} not imported`] : [])].join(' - ')
                  || 'nothing left to import'}
              </Typography>
              {(adapter.secrets || adapter.appliesOnReload) && (
                <Typography level='body-xs' color='warning'>
                  {adapter.secrets ? 'Holds API keys. ' : ''}{adapter.appliesOnReload ? 'The file\'s values replace this device\'s, at reload.' : ''}
                </Typography>
              )}
              {missing.map(({ referred, count }) => (
                <Typography key={referred.type} level='body-xs' color='warning'>
                  {count.toLocaleString()} {count === 1 ? 'needs' : 'need'} {referred.labelPlural} that are neither on this device nor in {preview.sources.length > 1 ? 'these files' : 'this file'}.
                </Typography>
              ))}
            </Box>
            {(!!changing.length || !!rejected.length) && (
              <IconButton size='sm' onClick={() => setExpandedType(isExpanded ? null : adapter.type)}>
                {isExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
              </IconButton>
            )}
          </Box>

          {isExpanded && <Box sx={{ display: 'grid', gap: 0.5, pl: { xs: 0, sm: 4.5 } }}>
            {shownRows.map(row => {
              const key = _rowKey(adapter, row.id);
              const { title, detail } = _describe(adapter, row.incoming);
              const local = row.local ? _describe(adapter, row.local) : undefined;
              const resolution = chosen.has(key) ? chosen.get(key)! : tradeDefaultResolution(row.relation, onConflict);
              return (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    {/* by the name it has on this device, where it is here */}
                    <Typography level='body-sm' noWrap>{local?.title ?? title}</Typography>
                    <Typography level='body-xs' noWrap>
                      {[RELATION_LABEL[row.relation], local?.detail && local.detail !== detail ? `File: ${detail} - This device: ${local.detail}` : detail].filter(Boolean).join(' - ')}
                    </Typography>
                  </Box>
                  {/* not for credentials: the comparison would show the keys */}
                  {!!row.local && !adapter.secrets && (
                    <IconButton size='sm' onClick={() => setComparing({ adapter, row })}>
                      <CompareArrowsIcon />
                    </IconButton>
                  )}
                  <Select
                    size='sm' variant='soft' color={!resolution && row.relation === 'conflict' ? 'warning' : 'neutral'}
                    value={resolution ?? 'skip'}
                    onChange={(_event, value) => value && handleChoose(key, value === 'skip' ? null : value as TradeResolution)}
                    sx={{ minWidth: 160 }}
                  >
                    {tradeResolutionChoices(row.relation).map(choice => <Option key={choice} value={choice}>{RESOLUTION_LABEL[choice]}</Option>)}
                    <Option value='skip'>{row.relation === 'conflict' ? 'Decide later' : 'Leave as it is'}</Option>
                  </Select>
                </Box>
              );
            })}
            {changing.length > shownRows.length && <Typography level='body-xs'>and {(changing.length - shownRows.length).toLocaleString()} more</Typography>}
            {rejected.slice(0, MAX_REJECTED_SHOWN).map((rejection, index) => <Typography key={index} level='body-xs' color='danger' sx={{ overflowWrap: 'anywhere' }}>{rejection.title ?? rejection.id}: {rejection.reason}</Typography>)}
            {rejected.length > MAX_REJECTED_SHOWN && <Typography level='body-xs'>and {(rejected.length - MAX_REJECTED_SHOWN).toLocaleString()} more not imported</Typography>}
          </Box>}

        </Sheet>
      );
    })}

    {!groups.length && !preview.sources.some(source => source.error) && (
      <Typography level='body-sm'>Nothing in {preview.sources.length > 1 ? 'these files' : 'this file'} can be imported here.</Typography>
    )}

    {/* The items changed on both sides */}
    {conflictCount > 0 && (
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography level='body-sm' sx={{ flex: 1, minWidth: 160 }}>
          <strong>{conflictCount.toLocaleString()}</strong> to decide, changed on this device and in the file:
        </Typography>
        <Select size='sm' value={onConflict ?? 'ask'} onChange={(_event, value) => value && setOnConflict(value === 'ask' ? null : value as TradeConflictPolicy)} sx={{ minWidth: 200 }}>
          <Option value='ask'>Decide each</Option>
          <Option value='accept-local'>{RESOLUTION_LABEL['accept-local']}</Option>
          <Option value='accept-incoming'>{RESOLUTION_LABEL['accept-incoming']}</Option>
          <Option value='keep-both'>{RESOLUTION_LABEL['keep-both']}</Option>
        </Select>
      </Box>
    )}

    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
      {undecidedCount > 0 && <Chip size='sm' variant='soft' color='warning'>{undecidedCount.toLocaleString()} undecided, not imported</Chip>}
      {/* not while a reload is pending: its values are held by this view */}
      {!reloadPending && (
        <Button variant='plain' color='neutral' onClick={() => setPreview(null)}>
          Other Files
        </Button>
      )}
      <Button loading={busy} disabled={!ops.length} onClick={handleApply}>
        Import{writeCount ? ` ${writeCount.toLocaleString()}` : ''}
      </Button>
    </Box>

    {/* This device and the file, side by side */}
    {!!comparing && (
      <GoodModal open onClose={() => setComparing(null)} title={_describe(comparing.adapter, comparing.row.incoming).title} fullscreen={isMobile || 'button'} sx={{ maxWidth: undefined }}>
        <DiffViewer
          oldTitle='This device'
          oldText={_compareText(comparing.adapter, comparing.row.local!)}
          newTitle='File'
          newText={_compareText(comparing.adapter, comparing.row.incoming)}
          contentScaling='sm'
          initialViewType={isMobile ? 'unified' : 'split'}
          initialWrapLongLines
          renderMode='modal'
        />
      </GoodModal>
    )}

  </>;
}
