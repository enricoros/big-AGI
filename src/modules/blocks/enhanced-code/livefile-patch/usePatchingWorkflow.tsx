import * as React from 'react';

import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { useLiveFileStore } from '~/common/livefile/store-live-file';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';


interface FileOperationStatus {
  message: React.ReactNode;
  mtype: 'info' | 'success' | 'error';

}

interface PatchState {
  srcContent: string | null;
  patchContent: string | null;
  newContent: string | null;
}


// Helper function to apply patch (to be implemented)
function applyPatch(srcContent: string, patch: string): string {
  // Implement patch application logic
  // FIXME: this just overwrites, LOL
  return patch;
}


export function usePatchingWorkflow(targetLiveFileId: LiveFileId | null, textBuffer: string) {

  // local status
  const { showPromisedOverlay } = useOverlayComponents();
  const [status, setStatus] = React.useState<FileOperationStatus | null>(null);
  const [patchState, setPatchState] = React.useState<PatchState>({ srcContent: null, patchContent: null, newContent: null });


  const isError = status?.mtype === 'error';
  const canLoad = !!targetLiveFileId;
  const canGenerate = !!patchState.srcContent;
  const canVerify = !!patchState.patchContent;
  const canSave = !!patchState.newContent;


  // Reload LiveFile from disk

  const targetReloadFromDisk = React.useCallback(async (): Promise<string | null> => {
    if (!targetLiveFileId) return null;
    setStatus({ message: 'Loading latest file version...', mtype: 'info' });
    setPatchState({ srcContent: null, patchContent: null, newContent: null });
    const srcContent = await useLiveFileStore.getState().contentReloadFromDisk(targetLiveFileId);
    if (!srcContent) {
      setStatus({ message: 'Failed to load file content.', mtype: 'error' });
      return null;
    }
    setPatchState(prev => ({ ...prev, srcContent }));
    return srcContent;
  }, [targetLiveFileId]);

  // [effect] reload LiveFile once set
  React.useEffect(() => {
    if (!canLoad) return;
    void targetReloadFromDisk();
  }, [canLoad, targetReloadFromDisk]);


  // Generate patch

  const generatePatch = React.useCallback(async (srcContent: string, code: string): Promise<string> => {
    setStatus({ message: 'Generating patch...', mtype: 'info' });
    // const patch = await generatePatch(srcContent, code);
    const patchContent = code;
    setPatchState(prev => ({ ...prev, patchContent }));
    return patchContent;
  }, []);

  // [effect] generate patch once srcContent is set
  React.useEffect(() => {
    if (!canGenerate) return;
    void generatePatch(patchState.srcContent!, textBuffer);
  }, [canGenerate, generatePatch, patchState.srcContent, textBuffer]);


  // Verify and apply patch

  const verifyPatch = React.useCallback(async (srcContent: string, patchContent: string) => {
    if (!canVerify) return;
    setStatus({ message: 'Verifying patch...', mtype: 'info' });
    const newContent = applyPatch(srcContent, patchContent);
    setPatchState(prev => ({ ...prev, newContent }));
    setStatus({ message: 'Ready.', mtype: 'success' });
    // setStatus({ message: 'Verification successful. Ready to apply.', mtype: 'success' });
  }, [canVerify]);

  // [effect] apply patch once generated
  React.useEffect(() => {
    if (!canVerify) return;
    void verifyPatch(patchState.srcContent!, patchState.patchContent!);
  }, [canVerify, patchState.patchContent, patchState.srcContent, verifyPatch]);


  // Save changes to LiveFile

  const targetWriteAndReload = React.useCallback(async (fileId: LiveFileId, newContent: string): Promise<boolean> => {
    if (!canSave) return false;
    setStatus({ message: 'Saving changes to file...', mtype: 'info' });
    const writeSuccess = await useLiveFileStore.getState().contentWriteAndReload(fileId, newContent);
    if (!writeSuccess)
      setStatus({ message: 'Failed to save changes.', mtype: 'error' });
    else
      setStatus({ message: 'Changes saved successfully.', mtype: 'success' });
    return writeSuccess;
  }, [canSave]);

  const targetOverwriteWithPatch = React.useCallback(async () => {
    if (!canSave) return;
    await targetWriteAndReload(targetLiveFileId!, patchState.newContent!);
  }, [canSave, patchState.newContent, targetLiveFileId, targetWriteAndReload]);

  // [effect] save changes once newContent is set
  // React.useEffect(() => {
  //   if (!canSave) return;
  //   showPromisedOverlay('agi-patch-workflow-save', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
  //     <ConfirmationModal
  //       open onClose={onUserReject} onPositive={() => onResolve(true)}
  //       title='Save change?'
  //       confirmationText='Do you want to save the changes to the file?'
  //       positiveActionText='Save'
  //     />,
  //   ).then((confirmed) => {
  //     if (confirmed)
  //       void targetWriteAndReload(targetLiveFileId!, patchState.newContent!);
  //   });
  // }, [canSave, patchState.newContent, showPromisedOverlay, targetLiveFileId, targetWriteAndReload]);


  return {
    status,
    patchState,
    targetApplyPatch: verifyPatch,
    targetGeneratePatch: generatePatch,
    targetReloadFromDisk,
    targetOverwriteWithPatch,
  };
}