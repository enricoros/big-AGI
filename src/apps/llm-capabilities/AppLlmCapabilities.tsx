import * as React from 'react';
import { fileSave } from 'browser-fs-access';

import { Alert, Box, Sheet, Typography } from '@mui/joy';
import BlockIcon from '@mui/icons-material/Block';

import { AppPlaceholder } from '../AppPlaceholder';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { LLM_IF_OAI_Fn, getLLMLabel, isLLMHidden } from '~/common/stores/llms/llms.types';
import { ModelsModals } from '~/modules/llms/models-modal/ModelsModals';
import { Release } from '~/common/app.release';
import { findAllModelVendors } from '~/modules/llms/vendors/vendors.registry';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';
import { useModelsStore } from '~/common/stores/llms/store-llms';

import { PROBE_SCENARIOS } from './probes/probe.scenarios';
import { ResultsTable } from './components/ResultsTable';
import { RunControls, type DeclaredFcFilter } from './components/RunControls';
import { resultKey, useLlmCapabilitiesStore } from './store-llm-capabilities';
import { runPlan, type RunPlanItem } from './probes/probe.runner';


function _csvEscape(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
    return '"' + s.replace(/"/g, '""') + '"';
  return s;
}


function AppLlmCapabilitiesAllowed() {

  // state
  const [selectedVendor, setSelectedVendor] = React.useState<string>('');
  const [declaredFcFilter, setDeclaredFcFilter] = React.useState<DeclaredFcFilter>('any');
  const [showHidden, setShowHidden] = React.useState<boolean>(true);
  const [concurrency, setConcurrency] = React.useState<number>(4);
  const [timeoutSec, setTimeoutSec] = React.useState<number>(30);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [completed, setCompleted] = React.useState<number>(0);
  const [total, setTotal] = React.useState<number>(0);

  const abortRef = React.useRef<AbortController | null>(null);

  // stores
  const llms = useModelsStore(s => s.llms);
  const sources = useModelsStore(s => s.sources);
  const results = useLlmCapabilitiesStore(s => s.results);
  const putResult = useLlmCapabilitiesStore(s => s.putResult);
  const clearAll = useLlmCapabilitiesStore(s => s.clearAll);

  // derived: vendor name map (alphabetical)
  const vendorNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of findAllModelVendors()) map[v.id] = v.name;
    return map;
  }, []);

  const serviceLabelById = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sources) map[s.id] = s.label;
    return map;
  }, [sources]);

  // derived: vendors actually present in the store, alphabetical, with counts
  const vendorListForFilter = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const llm of llms) counts.set(llm.vId, (counts.get(llm.vId) || 0) + 1);
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, name: vendorNameById[id] || id, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [llms, vendorNameById]);

  // derived: filtered rows, sorted by vendor (alpha) then service label, then model label
  const rows: DLLM[] = React.useMemo(() => {
    const filtered = llms.filter(llm => {
      if (selectedVendor && llm.vId !== selectedVendor) return false;
      if (declaredFcFilter === 'yes' && !llm.interfaces.includes(LLM_IF_OAI_Fn)) return false;
      if (declaredFcFilter === 'no' && llm.interfaces.includes(LLM_IF_OAI_Fn)) return false;
      if (!showHidden && isLLMHidden(llm)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const vA = vendorNameById[a.vId] || a.vId;
      const vB = vendorNameById[b.vId] || b.vId;
      if (vA !== vB) return vA.localeCompare(vB);
      const sA = serviceLabelById[a.sId] || a.sId;
      const sB = serviceLabelById[b.sId] || b.sId;
      if (sA !== sB) return sA.localeCompare(sB);
      return getLLMLabel(a).localeCompare(getLLMLabel(b));
    });
  }, [llms, selectedVendor, declaredFcFilter, showHidden, vendorNameById, serviceLabelById]);

  // derived: counts for selection toolbar
  const failingSelectedCount = React.useMemo(() => {
    let n = 0;
    for (const llm of rows) {
      let anyFailing = false;
      for (const scenario of PROBE_SCENARIOS) {
        const r = results[resultKey(llm.id, scenario.id)];
        if (!r) continue;
        if (r.outcome !== 'function_call_ok') {
          anyFailing = true;
          break;
        }
      }
      if (anyFailing) n++;
    }
    return n;
  }, [rows, results]);

  // selection helpers
  const toggleId = React.useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback((ids: string[], selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) ids.forEach(id => next.add(id));
      else ids.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const selectAllVisible = React.useCallback(() => {
    setSelectedIds(new Set(rows.map(r => r.id)));
  }, [rows]);

  const selectAllFailing = React.useCallback(() => {
    const next = new Set<string>();
    for (const llm of rows) {
      for (const scenario of PROBE_SCENARIOS) {
        const r = results[resultKey(llm.id, scenario.id)];
        if (r && r.outcome !== 'function_call_ok') {
          next.add(llm.id);
          break;
        }
      }
    }
    setSelectedIds(next);
  }, [rows, results]);

  // run orchestration
  const startRun = React.useCallback(async (plan: RunPlanItem[]) => {
    if (!plan.length || isRunning) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setCompleted(0);
    setTotal(plan.length);
    try {
      await runPlan(
        plan,
        concurrency,
        timeoutSec * 1000,
        controller.signal,
        (result) => { putResult(result); },
        (progress) => { setCompleted(progress.completed); },
      );
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [isRunning, concurrency, timeoutSec, putResult]);

  const onRunSelected = React.useCallback(() => {
    const plan: RunPlanItem[] = [];
    for (const id of selectedIds)
      for (const scenario of PROBE_SCENARIOS)
        plan.push({ llmId: id, scenario });
    void startRun(plan);
  }, [selectedIds, startRun]);

  const onRunFailingSelected = React.useCallback(() => {
    const plan: RunPlanItem[] = [];
    for (const id of selectedIds) {
      for (const scenario of PROBE_SCENARIOS) {
        const r = results[resultKey(id, scenario.id)];
        // include if never run or previously not ok
        if (!r || r.outcome !== 'function_call_ok')
          plan.push({ llmId: id, scenario });
      }
    }
    void startRun(plan);
  }, [selectedIds, results, startRun]);

  const onStop = React.useCallback(() => {
    abortRef.current?.abort('user-stop');
  }, []);

  // CSV export - one row per (model, scenario) for scenarios that have a result, honoring the current filter
  const onExportCsv = React.useCallback(async () => {
    const headers = [
      'vendor', 'vendor_id', 'service', 'service_id',
      'model_id', 'model_label', 'hidden',
      'declared_fc', 'declared_reasoning', 'declared_vision', 'declared_image_out', 'declared_web_search',
      'scenario_id', 'outcome', 'function_name', 'duration_ms',
      'tokens_in', 'tokens_out', 'tokens_reasoning', 'cost_usd', 'cost_status',
      'emitted_sequence', 'text_sample', 'args_sample', 'error_message', 'run_ts_iso',
    ];
    const lines: string[] = [headers.join(',')];

    for (const llm of rows) {
      const base = [
        vendorNameById[llm.vId] || llm.vId,
        llm.vId,
        serviceLabelById[llm.sId] || llm.sId,
        llm.sId,
        llm.id,
        getLLMLabel(llm),
        isLLMHidden(llm) ? 'true' : 'false',
        llm.interfaces.includes('oai-chat-fn') ? 'true' : 'false',
        llm.interfaces.includes('oai-chat-reasoning') ? 'true' : 'false',
        llm.interfaces.includes('oai-chat-vision') ? 'true' : 'false',
        llm.interfaces.includes('outputs-image') ? 'true' : 'false',
        llm.interfaces.includes('tools-web-search') ? 'true' : 'false',
      ];
      for (const scenario of PROBE_SCENARIOS) {
        const r = results[resultKey(llm.id, scenario.id)];
        if (!r) continue;
        const row = [
          ...base,
          scenario.id,
          r.outcome,
          r.functionName ?? '',
          r.durationMs,
          r.tokensIn ?? '',
          r.tokensOut ?? '',
          r.tokensReasoning ?? '',
          r.costUsd ?? '',
          r.costStatus ?? '',
          (r.emittedSequence ?? []).join('>'),
          r.textSample ?? '',
          r.argsSample ?? '',
          r.errorMessage ?? '',
          new Date(r.ts).toISOString(),
        ];
        lines.push(row.map(_csvEscape).join(','));
      }
    }

    const csv = lines.join('\n');
    await fileSave(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      { fileName: `big-agi_llm-capabilities_${prettyTimestampForFilenames()}.csv`, extensions: ['.csv'] },
    ).catch(e => console.error('CSV save failed:', e));
  }, [rows, results, vendorNameById, serviceLabelById]);

  // stop run when page unmounts
  React.useEffect(() => () => { abortRef.current?.abort('unmount'); }, []);

  return (
    <AppPlaceholder title='LLM Capabilities'>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 2 }}>
        <Typography level='body-sm' sx={{ opacity: 0.7 }}>
          Probe real function-calling capability across vendors. Each selected model is run through {PROBE_SCENARIOS.length} scenarios.
          Results persist locally and overwrite on rerun. No probes run until you click &ldquo;Run selected&rdquo;.
        </Typography>

        <Sheet variant='outlined' sx={{ p: 1.5, borderRadius: 'sm' }}>
          <RunControls
            vendors={vendorListForFilter}
            selectedVendor={selectedVendor}
            onSelectedVendorChange={setSelectedVendor}
            declaredFcFilter={declaredFcFilter}
            onDeclaredFcFilterChange={setDeclaredFcFilter}
            showHidden={showHidden}
            onShowHiddenChange={setShowHidden}
            onOpenServices={optimaOpenModels}
            concurrency={concurrency}
            onConcurrencyChange={setConcurrency}
            timeoutSec={timeoutSec}
            onTimeoutSecChange={setTimeoutSec}
            visibleCount={rows.length}
            selectedCount={selectedIds.size}
            failingSelectedCount={failingSelectedCount}
            isRunning={isRunning}
            completed={completed}
            total={total}
            onSelectAllVisible={selectAllVisible}
            onClearSelection={() => setSelectedIds(new Set())}
            onSelectAllFailing={selectAllFailing}
            onRunSelected={onRunSelected}
            onRunFailingSelected={onRunFailingSelected}
            onStop={onStop}
            onClearResults={() => { if (window.confirm('Clear ALL stored probe results?')) clearAll(); }}
            onExportCsv={onExportCsv}
          />
        </Sheet>

        <ResultsTable
          rows={rows}
          vendorNameById={vendorNameById}
          serviceLabelById={serviceLabelById}
          selectedIds={selectedIds}
          onToggleId={toggleId}
          onToggleAll={toggleAll}
        />
      </Box>

      {/* mounted explicitly (this page uses the 'noop' layout, so the Optima <Modals/> aren't present) */}
      <ModelsModals />
    </AppPlaceholder>
  );
}


function AppLlmCapabilitiesDenied() {
  return (
    <AppPlaceholder title='LLM Capabilities'>
      <Alert color='warning' startDecorator={<BlockIcon />} sx={{ my: 4 }}>
        This dev tool is only accessible in development builds.
      </Alert>
    </AppPlaceholder>
  );
}


export function AppLlmCapabilities() {
  const allow = Release.IsNodeDevBuild;
  return allow ? <AppLlmCapabilitiesAllowed /> : <AppLlmCapabilitiesDenied />;
}
