import { useProdiaStore } from './store-prodia';

export const requireUserKeyProdia = !process.env.HAS_SERVER_KEY_PRODIA;

export const canUseProdia = (): boolean => !!useProdiaStore.getState().prodiaModelId || !requireUserKeyProdia;

export const isValidProdiaApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 36;

export const CmdRunProdia: string[] = ['/imagine', '/img'];
