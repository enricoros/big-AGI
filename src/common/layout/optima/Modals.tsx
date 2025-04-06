import * as React from 'react';

import { AixDebuggerDialog } from '~/modules/aix/client/debugger/AixDebuggerDialog';
import { ModelsModal } from '~/modules/llms/models-modal/ModelsModal';
import { SettingsModal } from '../../../apps/settings-modal/SettingsModal';
import { ShortcutsModal } from '../../../apps/settings-modal/ShortcutsModal';

import { LogViewerDialog } from '~/common/logger/viewer/LoggerViewerDialog';

import { optimaActions, optimaOpenPreferences, useOptimaModals } from './useOptima';


export function Modals(props: { suspendAutoModelsSetup?: boolean }) {

  // external state
  const { preferencesTab, showAIXDebugger, showKeyboardShortcuts, showLogger, showPreferences } = useOptimaModals();

  // derived state
  const { closeAIXDebugger, closeKeyboardShortcuts, closeLogger, closePreferences, openKeyboardShortcuts } = optimaActions();

  return <>

    {/* Overlay - Preferences Modal */}
    <SettingsModal
      open={showPreferences}
      tab={preferencesTab}
      setTab={optimaOpenPreferences}
      onClose={closePreferences}
      onOpenShortcuts={openKeyboardShortcuts}
    />

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