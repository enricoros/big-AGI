import { validateAuthenticationType } from './auth.server';

export const buildTimeAuthEnabled = !!validateAuthenticationType(process.env.SERVER_AUTH_TYPE);
