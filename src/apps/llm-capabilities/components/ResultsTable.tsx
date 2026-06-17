import * as React from 'react';

import { Box, Checkbox, Chip, Sheet, Table, Tooltip, Typography } from '@mui/joy';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Image, LLM_IF_Tools_WebSearch, getLLMLabel, isLLMHidden } from '~/common/stores/llms/llms.types';

import type { ProbeOutcome, ProbeResult } from '../probes/probe.types';
import { PROBE_SCENARIOS } from '../probes/probe.scenarios';
import { resultKey, useLlmCapabilitiesStore } from '../store-llm-capabilities';


type ColorName = 'neutral' | 'primary' | 'danger' | 'success' | 'warning';

const OUTCOME_DISPLAY: Record<ProbeOutcome, { short: string; color: ColorName; desc: string }> = {
  function_call_ok: { short: 'OK', color: 'success', desc: 'Model emitted the expected function call (roundtrip: and consumed the tool result on turn 2).' },
  function_call_wrong_name: { short: 'WRONG', color: 'warning', desc: 'Tool call emitted, but different function name.' },
  code_execution: { short: 'CODE', color: 'primary', desc: 'Model invoked a code-execution tool instead of a function call.' },
  no_tool_text_only: { short: 'TEXT', color: 'warning', desc: 'Only text returned - no tool invocation.' },
  empty: { short: 'EMPTY', color: 'neutral', desc: 'No content fragments returned.' },
  error: { short: 'ERR', color: 'danger', desc: 'Error fragment or failed request.' },
  aborted: { short: 'ABRT', color: 'neutral', desc: 'Aborted - user stop or timeout.' },
  not_configured: { short: 'N/C', color: 'neutral', desc: 'Model or service not configured / no access.' },
  roundtrip_loop: { short: 'LOOP', color: 'danger', desc: 'Roundtrip: turn 2 re-emitted a tool call instead of answering.' },
  roundtrip_no_signal: { short: 'NO-SIG', color: 'warning', desc: 'Roundtrip: turn 2 returned text but did not reference the injected tool result.' },
  skipped: { short: '-', color: 'neutral', desc: 'Not run.' },
};


const _PART_COLOR: Record<string, ColorName> = {
  text: 'neutral',
  fn: 'success',
  code: 'primary',
  think: 'primary',
  cite: 'neutral',
  img: 'neutral',
  ref: 'neutral',
  host: 'neutral',
  tres: 'neutral',
  inj: 'warning',     // injected canned tool_response (roundtrip turn boundary)
  err: 'danger',
  ph: 'neutral',
};

function _fcMatchChip(declared: boolean, scenarioResults: (ProbeResult | undefined)[]): React.ReactNode {
  const known = scenarioResults.filter((r): r is ProbeResult => !!r);
  if (!known.length) return <Typography level='body-xs' sx={{ opacity: 0.4 }}>-</Typography>;
  const observedOk = known.some(r => r.outcome === 'function_call_ok');
  if (declared && observedOk)
    return <Tooltip title='TP: declared FC, observed FC.' size='sm'><Chip size='sm' variant='outlined' color='success' sx={{ fontSize: '10px', fontWeight: 600 }}>TP</Chip></Tooltip>;
  if (!declared && !observedOk)
    return <Tooltip title='TN: not declared, not observed.' size='sm'><Chip size='sm' variant='outlined' color='neutral' sx={{ fontSize: '10px', fontWeight: 600, opacity: 0.6 }}>TN</Chip></Tooltip>;
  if (declared && !observedOk)
    return <Tooltip title='FP: declared FC but no scenario passed. Model claims a capability it does not reliably deliver.' size='sm'><Chip size='sm' variant='solid' color='danger' sx={{ fontSize: '10px', fontWeight: 600 }}>FP</Chip></Tooltip>;
  return <Tooltip title='FN: not declared, but probe passed. Model has undeclared function-calling support - worth marking FC.' size='sm'><Chip size='sm' variant='solid' color='warning' sx={{ fontSize: '10px', fontWeight: 600 }}>FN</Chip></Tooltip>;
}

function _sequenceChips(sequence: string[] | undefined): React.ReactNode {
  if (!sequence || sequence.length === 0) return null;
  // collapse consecutive duplicates for readability: ['text','text','fn'] -> ['text×2','fn']
  const collapsed: { label: string; count: number }[] = [];
  for (const label of sequence) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.label === label) last.count++;
    else collapsed.push({ label, count: 1 });
  }
  return collapsed.map((seg, i) => (
    <React.Fragment key={i}>
      {i > 0 && <Typography component='span' level='body-xs' sx={{ opacity: 0.35, fontSize: '9px', mx: 0.125 }}>›</Typography>}
      <Chip size='sm' variant='soft' color={_PART_COLOR[seg.label] ?? 'neutral'} sx={{ fontSize: '10px' }}>
        {seg.count > 1 ? `${seg.label}×${seg.count}` : seg.label}
      </Chip>
    </React.Fragment>
  ));
}


export interface ResultsTableProps {
  rows: DLLM[];
  vendorNameById: Record<string, string>;
  serviceLabelById: Record<string, string>;
  selectedIds: Set<string>;
  onToggleId: (id: string) => void;
  onToggleAll: (ids: string[], selected: boolean) => void;
}

export function ResultsTable(props: ResultsTableProps) {

  const results = useLlmCapabilitiesStore(s => s.results);

  const { rows, vendorNameById, serviceLabelById, selectedIds, onToggleId, onToggleAll } = props;

  const allSelected = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
  const someSelected = !allSelected && rows.some(r => selectedIds.has(r.id));

  return (
    <Sheet variant='outlined' sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: '72vh' }}>
      <Table
        size='sm'
        stickyHeader
        hoverRow
        sx={{
          '--TableCell-paddingX': '8px',
          '--TableCell-paddingY': '4px',
          '& thead th': { whiteSpace: 'nowrap', fontSize: 'xs' },
          '& tbody td': { verticalAlign: 'top' },
        }}
      >
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <Checkbox
                size='sm'
                checked={allSelected}
                indeterminate={someSelected}
                onChange={e => onToggleAll(rows.map(r => r.id), e.target.checked)}
              />
            </th>
            <th style={{ width: 90 }}>Vendor</th>
            <th style={{ width: 110 }}>Service</th>
            <th style={{ width: 300 }}>Model</th>
            <th style={{ width: 140 }}>Declared</th>
            <th style={{ width: 64 }}>
              <Tooltip title='Declared FC vs observed FC (any scenario passing). TP = declared+works, TN = undeclared+fails, FP = declared but broken (misleads callers), FN = undeclared but works (should declare).' size='sm'>
                <span>Match</span>
              </Tooltip>
            </th>
            {PROBE_SCENARIOS.map(s => (
              <th key={s.id} style={{ width: 170 }}>
                <Tooltip title={s.description} size='sm'>
                  <span>{s.label}</span>
                </Tooltip>
              </th>
            ))}
            <th style={{ width: 70 }}>Latency</th>
            <th style={{ width: 70 }}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(llm => {
            const hidden = isLLMHidden(llm);
            const label = getLLMLabel(llm);
            const declaresFn = llm.interfaces.includes(LLM_IF_OAI_Fn);
            const declaresVision = llm.interfaces.includes(LLM_IF_OAI_Vision);
            const declaresReasoning = llm.interfaces.includes(LLM_IF_OAI_Reasoning);
            const declaresImageOut = llm.interfaces.includes(LLM_IF_Outputs_Image);
            const declaresWebSearch = llm.interfaces.includes(LLM_IF_Tools_WebSearch);
            const selected = selectedIds.has(llm.id);

            // aggregate latency + cost across probes for this model
            let maxLatency = 0;
            let sumCost = 0;
            let hasCost = false;

            for (const scenario of PROBE_SCENARIOS) {
              const r = results[resultKey(llm.id, scenario.id)];
              if (!r) continue;
              if (r.durationMs > maxLatency) maxLatency = r.durationMs;
              if (r.costUsd !== undefined) {
                sumCost += r.costUsd;
                hasCost = true;
              }
            }

            return (
              <tr key={llm.id}>
                <td>
                  <Checkbox
                    size='sm'
                    checked={selected}
                    onChange={() => onToggleId(llm.id)}
                  />
                </td>
                <td>
                  <Typography level='body-xs' noWrap>{vendorNameById[llm.vId] || llm.vId}</Typography>
                </td>
                <td>
                  <Typography level='body-xs' noWrap sx={{ opacity: 0.8 }}>{serviceLabelById[llm.sId] || llm.sId}</Typography>
                </td>
                <td>
                  <Box sx={hidden ? { opacity: 0.55 } : undefined}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {hidden && <Chip size='sm' variant='outlined' color='neutral' sx={{ fontSize: '10px' }}>hidden</Chip>}
                      <Typography level='body-sm' sx={{ fontWeight: 500 }}>{label}</Typography>
                    </Box>
                    <Typography level='body-xs' sx={{ opacity: 0.55, fontFamily: 'code', fontSize: '10px' }}>{llm.id}</Typography>
                  </Box>
                </td>
                <td>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                    {declaresFn && <Chip size='sm' variant='soft' color='success' sx={{ fontSize: '10px' }}>FC</Chip>}
                    {declaresWebSearch && <Chip size='sm' variant='soft' color='warning' sx={{ fontSize: '10px' }}>Web</Chip>}
                    {declaresVision && <Chip size='sm' variant='soft' color='primary' sx={{ fontSize: '10px' }}>V</Chip>}
                    {declaresImageOut && <Chip size='sm' variant='soft' color='primary' sx={{ fontSize: '10px' }}>Img</Chip>}
                    {declaresReasoning && <Chip size='sm' variant='outlined' color='neutral' sx={{ fontSize: '10px' }}>R</Chip>}
                  </Box>
                </td>
                <td>{_fcMatchChip(declaresFn, PROBE_SCENARIOS.map(s => results[resultKey(llm.id, s.id)]))}</td>
                {PROBE_SCENARIOS.map(scenario => {
                  const r = results[resultKey(llm.id, scenario.id)];
                  if (!r) return <td key={scenario.id}><Typography level='body-xs' sx={{ opacity: 0.4 }}>-</Typography></td>;
                  const d = OUTCOME_DISPLAY[r.outcome];
                  const tipParts = [d.desc];
                  if (r.functionName) tipParts.push(`fn: ${r.functionName}`);
                  if (r.argsSample) tipParts.push(`args: ${r.argsSample}`);
                  if (r.textSample) tipParts.push(`text: ${r.textSample}`);
                  if (r.errorMessage) tipParts.push(`msg: ${r.errorMessage}`);
                  return (
                    <td key={scenario.id}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.375 }}>
                        <Tooltip title={tipParts.join(' | ')} size='sm' placement='top'>
                          <Chip size='sm' color={d.color} variant={r.outcome === 'function_call_ok' ? 'outlined' : 'solid'} sx={{ fontSize: '10px', fontWeight: 600 }}>{d.short}</Chip>
                        </Tooltip>
                        <Typography component='span' level='body-xs' sx={{ opacity: 0.35, fontSize: '11px' }}>|</Typography>
                        {_sequenceChips(r.emittedSequence)}
                      </Box>
                    </td>
                  );
                })}
                <td>
                  <Typography level='body-xs'>{maxLatency ? `${maxLatency}ms` : '-'}</Typography>
                </td>
                <td>
                  <Typography level='body-xs'>{hasCost ? `$${sumCost.toFixed(sumCost < 1 ? 4 : 2)}` : '-'}</Typography>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
}
