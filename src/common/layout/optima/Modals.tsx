import * as React from 'react';

import { optimaActions, optimaOpenPreferences, useOptimaModals } from './useOptima';

// auto-open models trigger
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { runWhenIdle } from '~/common/util/pwaUtils';
import { useModelsZeroState } from '~/common/stores/llms/hooks/useModelsZeroState';

// Modals

// Lazy-loaded Modals
const AixDebuggerDialogLazy = React.lazy(() => import('~/modules/aix/client/debugger/AixDebuggerDialog').then(module => ({ default: module.AixDebuggerDialog })));
const LogViewerDialogLazy = React.lazy(() => import('~/common/logger/viewer/LoggerViewerDialog').then(module => ({ default: module.LogViewerDialog })));
const ModelsModalsLazy = React.lazy(() => import('~/modules/llms/models-modal/ModelsModals').then(module => ({ default: module.ModelsModals })));
const SettingsModalLazy = React.lazy(() => import('../../../apps/settings-modal/SettingsModal').then(module => ({ default: module.SettingsModal })));
const ShortcutsModalLazy = React.lazy(() => import('../../../apps/settings-modal/ShortcutsModal').then(module => ({ default: module.ShortcutsModal })));


export function Modals(props: { suspendAutoModelsSetup?: boolean }) {

  // external state
  const { preferencesTab, showAIXDebugger, showKeyboardShortcuts, showLogger, showPreferences, showModels, showModelOptions } = useOptimaModals();

  // derived state
  const { closeAIXDebugger, closeKeyboardShortcuts, closeLogger, closePreferences, openKeyboardShortcuts } = optimaActions();


  // [effect] Auto-open the configurator - anytime no service is selected
  const hasNoServices = useModelsZeroState();
  const autoOpenTrigger = hasNoServices && !props.suspendAutoModelsSetup;
  React.useEffect(() => {
    if (autoOpenTrigger)
      return runWhenIdle(() => optimaOpenModels(), 2000);
  }, [autoOpenTrigger]);


  return <>

    {/* Overlay - Preferences Modal */}
    {showPreferences && (
      <React.Suspense fallback={null}>
        <SettingsModalLazy
          open={showPreferences}
          tab={preferencesTab}
          setTab={optimaOpenPreferences}
          onClose={closePreferences}
          onOpenShortcuts={openKeyboardShortcuts}
        />
      </React.Suspense>
    )}

    {/* Overlay Models + LLM Options */}
    {(showModels || showModelOptions) && (
      <React.Suspense fallback={null}>
        <ModelsModalsLazy />
      </React.Suspense>
    )}

    {/* Logger */}
    {showLogger && (
      <React.Suspense fallback={null}>
        <LogViewerDialogLazy onClose={closeLogger} />
      </React.Suspense>
    )}

    {/* AIX Debugger Dialog */}
    {showAIXDebugger && (
      <React.Suspense fallback={null}>
        <AixDebuggerDialogLazy onClose={closeAIXDebugger} />
      </React.Suspense>
    )}

    {/* Overlay Shortcuts */}
    {showKeyboardShortcuts && (
      <React.Suspense fallback={null}>
        <ShortcutsModalLazy onClose={closeKeyboardShortcuts} />
      </React.Suspense>
    )}

  </>;
}
