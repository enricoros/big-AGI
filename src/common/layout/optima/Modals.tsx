import * as React from 'react';

import { ModelsModal } from '~/modules/llms/models-modal/ModelsModal';
import { SettingsModal } from '../../../apps/settings-modal/SettingsModal';
import { ShortcutsModal } from '../../../apps/settings-modal/ShortcutsModal';

import { optimaActions, optimaOpenPreferences, useOptimaModals } from './useOptima';


export function Modals(props: { suspendAutoModelsSetup?: boolean }) {

  // external state
  const { preferencesTab, showKeyboardShortcuts, showPreferences } = useOptimaModals();

  // derived state
  const { closeKeyboardShortcuts, closePreferences, openKeyboardShortcuts } = optimaActions();

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

    {/* Overlay Shortcuts */}
    {showKeyboardShortcuts && (
      <ShortcutsModal onClose={closeKeyboardShortcuts} />
    )}

  </>;
}