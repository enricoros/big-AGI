import * as React from 'react';

// Modals
import { AixDebuggerDialog } from '~/modules/aix/client/debugger/AixDebuggerDialog';
import { ModelsModal } from '~/modules/llms/models-modal/ModelsModal';

import { ShortcutsModal } from '../../../apps/settings-modal/ShortcutsModal';

import { LogViewerDialog } from '~/common/logger/viewer/LoggerViewerDialog';

import { optimaActions, optimaOpenPreferences, useOptimaModals } from './useOptima';


// Lazy-loaded Modals
const SettingsModalLazy = React.lazy(() => import('../../../apps/settings-modal/SettingsModal').then(module => ({ default: module.SettingsModal })));


export function Modals(props: { suspendAutoModelsSetup?: boolean }) {

  // external state
  const { preferencesTab, showAIXDebugger, showKeyboardShortcuts, showLogger, showPreferences } = useOptimaModals();

  // derived state
  const { closeAIXDebugger, closeKeyboardShortcuts, closeLogger, closePreferences, openKeyboardShortcuts } = optimaActions();

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
    <ModelsModal suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

    {/* Logger */}
    {showLogger && <LogViewerDialog onClose={closeLogger} />}

    {/* AIX Debugger Dialog */}
    {showAIXDebugger && <AixDebuggerDialog onClose={closeAIXDebugger} />}

    {/* Overlay Shortcuts */}
    {showKeyboardShortcuts && (
      <ShortcutsModal onClose={closeKeyboardShortcuts} />
    )}

  </>;
}