import { useProdiaStore } from './store-prodia';

export const requireUserKeyProdia = !process.env.HAS_SERVER_KEY_PRODIA;

export const canUseProdia = (): boolean => !!useProdiaStore.getState().prodiaModelId || !requireUserKeyProdia;

export const isValidProdiaApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 36;

export const prodiaDefaultModelId: string = 'v1-5-pruned-emaonly.ckpt [81761151]';

export const CmdRunProdia: string[] = ['/imagine', '/img'];
