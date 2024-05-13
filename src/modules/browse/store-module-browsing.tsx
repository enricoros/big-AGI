import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { CapabilityBrowsing } from '~/common/components/useCapabilities';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';


export type BrowsePageTransform = 'html' | 'text' | 'markdown';

interface BrowseState {

  wssEndpoint: string;
  setWssEndpoint: (url: string) => void;

  pageTransform: BrowsePageTransform;
  setPageTransform: (transform: BrowsePageTransform) => void;

  enableCommandBrowse: boolean;
  setEnableCommandBrowse: (value: boolean) => void;

  enableComposerAttach: boolean;
  setEnableComposerAttach: (value: boolean) => void;

  enableReactTool: boolean;
  setEnableReactTool: (value: boolean) => void;

  enablePersonaTool: boolean;
  setEnablePersonaTool: (value: boolean) => void;

}

export const useBrowseStore = create<BrowseState>()(
  persist(
    (set) => ({

      wssEndpoint: '', // default WSS endpoint
      setWssEndpoint: (wssEndpoint: string) => set(() => ({ wssEndpoint })),

      pageTransform: 'text',
      setPageTransform: (pageTransform: BrowsePageTransform) => set(() => ({ pageTransform })),

      enableCommandBrowse: true,
      setEnableCommandBrowse: (enableCommandBrowse: boolean) => set(() => ({ enableCommandBrowse })),

      enableComposerAttach: true,
      setEnableComposerAttach: (enableComposerAttach: boolean) => set(() => ({ enableComposerAttach })),

      enableReactTool: true,
      setEnableReactTool: (enableReactTool: boolean) => set(() => ({ enableReactTool })),

      enablePersonaTool: true,
      setEnablePersonaTool: (enablePersonaTool: boolean) => set(() => ({ enablePersonaTool })),

    }),
    {
      name: 'app-module-browse',
    },
  ),
);


export function useBrowseCapability(): CapabilityBrowsing {
  // server config
  const isServerConfig = getBackendCapabilities().hasBrowsing;

  // external client state
  const { wssEndpoint, enableCommandBrowse, enableComposerAttach, enableReactTool, enablePersonaTool } = useBrowseStore();

  // derived state
  const isClientConfig = !!wssEndpoint;
  const isClientValid = (wssEndpoint?.startsWith('wss://') && wssEndpoint?.length > 10) || (wssEndpoint?.startsWith('ws://') && wssEndpoint?.length > 9);
  const mayWork = isServerConfig || (isClientConfig && isClientValid);

  return {
    mayWork,
    isServerConfig,
    isClientConfig,
    isClientValid,
    inCommand: mayWork && enableCommandBrowse,
    inComposer: mayWork && enableComposerAttach,
    inReact: mayWork && enableReactTool,
    inPersonas: mayWork && enablePersonaTool,
  };
}