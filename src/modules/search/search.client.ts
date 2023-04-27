export const requireUserKeyGoogleApi = !process.env.HAS_SERVER_KEY_GOOGLE_API;
export const requireUserKeyCseId = !process.env.HAS_SERVER_KEY_CSE_ID;

export const isValidGoogleApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 40;
export const isValidCseId = (cseId?: string) => !!cseId && cseId.trim()?.length >= 18;