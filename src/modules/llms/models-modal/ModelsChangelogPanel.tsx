import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Chip, CircularProgress, LinearProgress, Link, Table, Typography } from '@mui/joy';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DModelsChangelogEntry, DModelsChangelogVia, llmsChangelogIsEventless, llmsChangelogIsMeaningful, llmsChangelogIsRouter, llmsChangelogWords, MODELS_CHANGELOG_REF_CAP } from '~/common/stores/llms/llms.changelog';
import { prettyTimeAgoEn } from '~/common/util/timeUtils';
import { useModelsStore } from '~/common/stores/llms/store-llms';
import { useToggleableStringSet } from '~/common/util/hooks/useToggleableStringSet';

import { LLMVendorIconSprite } from '../components/LLMVendorIconSprite';
import { useLlmUpdateModels } from '../llm.client.hooks';
import { useModelsRefreshBatchStore, useModelsRefreshSummary } from '../llm.client.refresh';


// configuration
const HISTORY_ENTRIES = 5; // per expanded service, before 'show more'


const styles = {

  // edge-to-edge tinted band, as the ModelsList band in the setup tab: the scrolling region of the dialog (a flex child that
  // shrinks below its content thanks to the explicit min height), so the selector and the status header stay put and the
  // sticky table header sticks to the band
  band: {
    minHeight: '10rem',
    overflowY: 'auto',
    // extend side to side
    mx: 'calc(-1 * var(--Card-padding, 1rem))',
    borderTop: '1px solid',
    borderBottom: '1px solid',
    borderColor: 'divider',
    backgroundColor: 'rgb(var(--joy-palette-neutral-lightChannel) / 20%)',
  },

  // rows span the band; the first and last cells carry the card padding, so the text aligns with the header above
  table: {
    '--TableCell-headBackground': 'var(--joy-palette-background-level1)', // opaque: the header stays on top while the rows scroll under it
    '--Table-headerUnderlineThickness': '1px', // same line under the header as between rows (Joy defaults to 2px)
    '--TableCell-paddingY': '0.75rem', // 3rem rows (1.5rem icon slot + padding)
    '--TableRow-hoverBackground': 'var(--joy-palette-neutral-plainHoverBg)',
    '& td': { verticalAlign: 'middle' }, // explicit (the browser default): cells center their content, and a block-level chevron centers with it
    '& th': { fontSize: 'xs', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.tertiary' },
    // sortable columns: a faint sort glyph, solid on the active column and on hover (the data-table convention, not a link)
    '& th.sortable': { cursor: 'pointer', userSelect: 'none' },
    '& th.sortable:hover, & th.sorted': { color: 'text.primary' },
    '& th.sortable > svg': { opacity: 0.33, transition: 'opacity 0.1s' },
    '& th.sortable:hover > svg, & th.sorted > svg': { opacity: 1 },
    '& th:first-of-type, & td:first-of-type': { pl: 'var(--Card-padding, 1rem)' },
    '& th:last-of-type, & td:last-of-type': { pr: 'var(--Card-padding, 1rem)' },
  },

  // an expanded service reads as one soft block: the header row a step darker than its history, both stable under the hover
  expandedRow: {
    '--TableCell-dataBackground': 'var(--joy-palette-neutral-softHoverBg)',
  } as React.CSSProperties,
  detailRow: {
    '--TableCell-dataBackground': 'var(--joy-palette-neutral-softBg)',
  } as React.CSSProperties,

  iconSlot: {
    width: '1.5rem',
    height: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // shrinkable (Joy chips are max-content): the label ellipsizes, the end decorator (change words) stays whole
  refChip: {
    fontFamily: 'code',
    minWidth: 0,
  },

  errorText: {
    fontSize: 'xs',
    color: 'warning.plainColor',
    wordBreak: 'break-word',
  },

} as const;


// only the automatic trigger is worth a caption: user-triggered listings are self-evident
const _viaLabels: Partial<Record<DModelsChangelogVia, string>> = {
  boot: 'Automatic (app update)',
};

/**
 * One clock for the whole screen, so every relative time rounds at the same instant (per-element
 * timers, as react-timeago's, drift by a second between neighbors). Ticks every second while the
 * newest entry still reads in seconds, then every 15s.
 */
function useNow(newestAt: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  const intervalMs = now - newestAt < 60_000 ? 1_000 : 15_000;
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** 'Today 20:11' / 'Sep 12', with the time on demand ('Sep 12, 09:40') */
function _dateText(at: number, withTime: boolean): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString())
    return withTime ? `Today, ${time}` : `Today ${time}`;
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return withTime ? `${day}, ${time}` : day;
}

/** '+3' / '~2' / '-1' count chips of a meaningful entry */
function CountChips(props: { entry: DModelsChangelogEntry }) {
  const { add, rem, mod } = props.entry;
  const modCount = mod ? Object.keys(mod).length : 0;
  const capped = (n: number) => n + (n === MODELS_CHANGELOG_REF_CAP ? '+' : '');
  return <>
    {!!add?.length && <Chip size='sm' variant='outlined' color='success' sx={{ backgroundColor: 'success.softBg' }}>+ {capped(add.length)}</Chip>}
    {!!modCount && <Chip size='sm' variant='outlined' color='neutral'>~ {capped(modCount)}</Chip>}
    {!!rem?.length && <Chip size='sm' variant='outlined' color='neutral' sx={{ backgroundColor: 'neutral.softBg' }}>- {capped(rem.length)}</Chip>}
  </>;
}


/**
 * Updates screen of the AI Models dialog: a status header, one row per service (when it was last
 * listed, what changed last), and per-service history on expansion.
 */
export function ModelsChangelogPanel(props: {
  modelsServices: DModelsService[],
  isMobile: boolean,
  onConfigureService: (serviceId: DModelsServiceId) => void,
}) {

  const { modelsServices, isMobile, onConfigureService } = props;

  // state
  const { set: expanded, toggle: handleToggleExpanded } = useToggleableStringSet<DModelsServiceId>();
  const [sortBy, setSortBy] = React.useState<'label' | 'change'>('label');

  // external state
  const changelog = useModelsStore(state => state.changelog);
  const modelCounts = useModelsStore(useShallow(state => {
    const counts: Record<DModelsServiceId, number> = {};
    for (const llm of state.llms)
      counts[llm.sId] = (counts[llm.sId] ?? 0) + 1;
    return counts;
  }));
  const batch = useModelsRefreshBatchStore();
  const summary = useModelsRefreshSummary();


  // derived state

  // per service, newest first
  const entriesByService = React.useMemo(() => {
    const byService = new Map<DModelsServiceId, DModelsChangelogEntry[]>();
    for (const entry of [...changelog].sort((a, b) => b.at - a.at)) {
      const list = byService.get(entry.sId);
      if (list) list.push(entry);
      else byService.set(entry.sId, [entry]);
    }
    return byService;
  }, [changelog]);

  // by label (as the service selector and the models list grouping), or by last change (newest first, then by label)
  const sortedServices = React.useMemo(() => {
    const byLabel = [...modelsServices].sort((a, b) => a.label.localeCompare(b.label));
    if (sortBy === 'label') return byLabel;
    const changeAt = (service: DModelsService) => entriesByService.get(service.id)?.find(llmsChangelogIsMeaningful)?.at ?? 0;
    return byLabel.sort((a, b) => changeAt(b) - changeAt(a)); // stable: ties keep the label order
  }, [entriesByService, modelsServices, sortBy]);

  const sortHeader = (key: 'label' | 'change', label: string, style?: React.CSSProperties) => (
    <th className={sortBy === key ? 'sortable sorted' : 'sortable'} aria-sort={sortBy !== key ? undefined : key === 'label' ? 'ascending' : 'descending'} style={style} onClick={() => setSortBy(key)}>
      {label}
      <KeyboardArrowRightIcon sx={{ fontSize: 'sm', verticalAlign: 'text-bottom', transform: 'rotate(90deg)' }} />
    </th>
  );

  const now = useNow(summary.at ?? 0);
  const sessionAt = summary.state !== 'idle' ? summary.at : null; // entries at or after the running/last session are 'fresh' (green), while the header shows it


  // header: idle, running, or the last session's outcome

  let headerTitle: React.ReactNode, headerSubtitle: React.ReactNode, headerAside: React.ReactNode = null;
  if (summary.state === 'running') {
    headerTitle = 'Updating all services';
    headerSubtitle = `${summary.done} of ${summary.total} done, ${summary.inFlight} in flight`;
    headerAside = <>
      <LinearProgress determinate value={100 * summary.done / Math.max(1, summary.total)} sx={{ width: '10rem' }} />
      {!!batch.stop && <Link component='button' level='body-sm' onClick={batch.stop}>Stop</Link>}
    </>;
  } else if (summary.state === 'done' && summary.at !== null) {
    headerTitle = `Updated ${prettyTimeAgoEn(summary.at, now)}`;
    headerSubtitle = [
      `${summary.services} services`,
      `${summary.totalModels} models`,
      summary.servicesChanged ? `${summary.servicesChanged} with changes` : 'no changes',
      summary.failed && `${summary.failed} failed (models kept)`,
    ].filter(Boolean).join(', ');
    headerAside = <>
      {!!summary.added && <Chip size='sm' variant='soft' color='success'>+{summary.added} added</Chip>}
      {!!summary.changed && <Chip size='sm' variant='soft' color='neutral'>~{summary.changed} changed</Chip>}
      {!!summary.removed && <Chip size='sm' variant='soft' color='neutral'>-{summary.removed} removed</Chip>}
      {!!summary.failed && <Chip size='sm' variant='soft' color='warning'>{summary.failed} {summary.failed === 1 ? 'error' : 'errors'}</Chip>}
    </>;
  } else {
    headerTitle = summary.at ? `Last checked ${prettyTimeAgoEn(summary.at, now)}` : 'No updates recorded yet';
    headerSubtitle = `${modelsServices.length} services, ${summary.totalModels} models`;
  }


  return <>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography level='title-sm'>{headerTitle}</Typography>
        <Typography level='body-xs' textColor='text.tertiary'>{headerSubtitle}</Typography>
      </Box>
      {!!headerAside && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>{headerAside}</Box>}
    </Box>

    <Box sx={styles.band}>
      <Table size={isMobile ? 'sm' : 'md'} variant='plain' borderAxis='xBetween' hoverRow stickyHeader sx={styles.table}>
        <thead>
        <tr>
          {sortHeader('label', 'Service', { width: isMobile ? '40%' : '14rem' })}
          {!isMobile && <th style={{ width: '4.5rem', textAlign: 'right' }}>Models</th>}
          <th style={{ width: isMobile ? '6rem' : '6.25rem' }}>Updated</th>
          {sortHeader('change', isMobile ? 'Changed' : 'Last change')}
          <th style={{ width: '2rem' }} />
        </tr>
        </thead>
        <tbody>
        {sortedServices.map(service => (
          <ServiceChangelogRow
            key={service.id}
            service={service}
            isMobile={isMobile}
            modelCount={modelCounts[service.id] ?? 0}
            isQueued={batch.runningAt !== null && batch.serviceIds.includes(service.id) && !batch.doneIds.includes(service.id)}
            sessionAt={sessionAt}
            now={now}
            entries={entriesByService.get(service.id)}
            expanded={expanded.has(service.id)}
            onToggleExpanded={handleToggleExpanded}
            onConfigureService={onConfigureService}
          />
        ))}
        </tbody>
      </Table>
    </Box>

  </>;
}


function ServiceChangelogRow(props: {
  service: DModelsService,
  isMobile: boolean,
  modelCount: number,
  isQueued: boolean,
  sessionAt: number | null,
  now: number,
  entries?: DModelsChangelogEntry[],
  expanded: boolean,
  onToggleExpanded: (serviceId: DModelsServiceId) => void,
  onConfigureService: (serviceId: DModelsServiceId) => void,
}) {

  const { service, isMobile, isQueued, sessionAt, now, entries, expanded, onToggleExpanded, onConfigureService } = props;

  // external state: the per-service listing (shared react-query key: also true while a session lists this service)
  const { isFetching, refetch } = useLlmUpdateModels(false, service);

  // derived state
  const latest = entries?.[0];
  const lastChange = entries?.find(llmsChangelogIsMeaningful);
  const isFresh = !!latest && sessionAt !== null && latest.at >= sessionAt;
  const canExpand = !!entries?.length;
  const dimmed = isQueued ? 'text.tertiary' : undefined;

  const handleToggle = React.useCallback(() => canExpand && onToggleExpanded(service.id), [canExpand, onToggleExpanded, service.id]);
  const handleConfigure = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onConfigureService(service.id);
  }, [onConfigureService, service.id]);
  const handleUpdateOnly = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    void refetch();
  }, [refetch]);

  // history length: the newest few, then all
  const [showAllEntries, setShowAllEntries] = React.useState(false);
  const handleShowAllEntries = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowAllEntries(true);
  }, []);
  const shownEntries = (!entries || showAllEntries) ? entries : entries.slice(0, HISTORY_ENTRIES);
  const hiddenEntries = (entries?.length ?? 0) - (shownEntries?.length ?? 0);


  const updatedNode = isFetching ? <Typography level='body-sm' textColor='primary.plainColor'>Listing...</Typography>
    : isQueued ? <Typography level='body-sm' textColor='text.tertiary'>Queued</Typography>
      : !latest ? <Typography level='body-sm' textColor='text.tertiary'>-</Typography>
        : <Typography level='body-sm' textColor={isFresh ? 'success.plainColor' : undefined} noWrap>{prettyTimeAgoEn(latest.at, now)}</Typography>;

  const lastChangeNode = latest?.err ? <Typography sx={styles.errorText}>{latest.err}</Typography>
    : !lastChange ? null
      : <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
        <Typography level='body-sm' textColor='text.secondary' noWrap sx={{ minWidth: 0 }}>{lastChange === latest ? prettyTimeAgoEn(lastChange.at, now) : _dateText(lastChange.at, false)}</Typography>
        <CountChips entry={lastChange} />
      </Box>;


  return <>

    <tr onClick={handleToggle} style={expanded ? { ...styles.expandedRow, cursor: 'pointer' } : canExpand ? { cursor: 'pointer' } : undefined} aria-expanded={canExpand ? expanded : undefined}>
      <td>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, '--Icon-fontSize': '1.25rem' }}>
          <Box sx={styles.iconSlot}>{isFetching ? <CircularProgress size='sm' color='neutral' sx={{ '--CircularProgress-size': '20px', '--CircularProgress-thickness': '2px' }} /> : <LLMVendorIconSprite vendorId={service.vId} />}</Box>
          {/* the name opens the service setup; the rest of the row expands the history */}
          <Link component='button' level='body-sm' color='neutral' textColor={dimmed ?? 'text.primary'} underline='hover' onClick={handleConfigure} sx={{ minWidth: 0 }}>
            {/* the link is inline-flex, so the ellipsis needs a block child */}
            <Box component='span' className='agi-ellipsize' sx={{ display: 'block', minWidth: 0 }}>{service.label}</Box>
          </Link>
          {!!latest?.err && <WarningRoundedIcon sx={{ fontSize: 'md', color: 'warning.plainColor' }} />}
        </Box>
      </td>
      {!isMobile && <td style={{ textAlign: 'right' }}><Typography level='body-sm' textColor={dimmed} noWrap>{props.modelCount}</Typography></td>}
      <td>{updatedNode}</td>
      <td>{lastChangeNode}</td>
      <td>{canExpand && <KeyboardArrowRightIcon sx={{ display: 'block', fontSize: 'lg', color: 'text.tertiary', transition: 'transform 0.1s', transform: expanded ? 'rotate(90deg)' : 'none' }} />}</td>
    </tr>

    {expanded && !!entries?.length && (
      <tr style={styles.detailRow}>
        <td colSpan={isMobile ? 4 : 5}>
          {/* indented to the service name (icon slot + gap) */}
          {/* minmax(0, 1fr): an auto grid track has a min-content floor, so one long ref chip would widen the rows past the cell instead of ellipsizing */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5, pl: isMobile ? 0 : 4 }}>
            {shownEntries?.map((entry, index) => (
              <Box key={`${entry.at}-${index}`} sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 0.5 : 2, alignItems: 'flex-start' }}>
                <Box sx={{ width: isMobile ? undefined : '9rem', flexShrink: 0 }}>
                  {/* the entry behind the row's 'Last change' cell reads bold, so the two match up */}
                  <Typography level='body-xs' textColor={entry === lastChange ? 'text.primary' : 'text.secondary'} fontWeight={entry === lastChange ? 'lg' : undefined}>{_dateText(entry.at, true)}</Typography>
                  {!!_viaLabels[entry.via] && <Typography level='body-xs' textColor='text.tertiary'>{_viaLabels[entry.via]}</Typography>}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {entry.err ? <Typography sx={styles.errorText}>{entry.err}</Typography>
                    : llmsChangelogIsEventless(entry) ? <Typography level='body-xs' textColor='text.tertiary'>no changes</Typography>
                      : <>
                        {entry.add?.map(ref => <Chip key={'+' + ref} size='sm' variant='outlined' color='success' title={ref} sx={styles.refChip}>+ {ref}</Chip>)}
                        {Object.entries(entry.mod ?? {}).map(([ref, letters]) => <Chip key={'~' + ref} size='sm' variant='outlined' color='neutral' title={ref} sx={styles.refChip} endDecorator={<Box component='span' sx={{ fontFamily: 'body', color: 'text.tertiary', ml: 0.5 }}>{/*~ */}{llmsChangelogWords(letters)}</Box>}>{ref}</Chip>)}
                        {entry.rem?.map(ref => <Chip key={'-' + ref} size='sm' variant='outlined' color='danger' title={ref} sx={styles.refChip}>- {ref}</Chip>)}
                      </>}
                </Box>
              </Box>
            ))}
            {llmsChangelogIsRouter(service.vId) && (
              <Typography level='body-xs' textColor='text.tertiary'>
                Pricing, context and output limits are not tracked for {service.label}: it advertises the values of whichever provider it routes to at the moment.
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mr: -1 }}>
              {hiddenEntries > 0 && <Link component='button' level='body-xs' color='neutral' onClick={handleShowAllEntries}>Show {hiddenEntries} more</Link>}
              <Box sx={{ flex: 1 }} />
              <Button size='sm' variant='soft' color='neutral' onClick={handleConfigure}>Configure...</Button>
              <Button
                size='sm' variant='soft' color='neutral' disabled={isFetching}
                startDecorator={isFetching ? <CircularProgress size='sm' sx={{ '--CircularProgress-size': '16px' }} /> : <RefreshIcon />}
                onClick={handleUpdateOnly}
              >
                {service.label}
              </Button>
            </Box>
          </Box>
        </td>
      </tr>
    )}

  </>;
}
