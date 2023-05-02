import { AuthenticationBasicUser, AuthenticationType } from './auth.types';
import { default as CredentialsProvider } from 'next-auth/providers/credentials';


// Env functions

export function validateAuthenticationType(authType?: string): AuthenticationType | null {
  if (!authType)
    return null;
  if (authType === 'credential')
    return authType;
  throw new Error(`Invalid authentication type: ${authType}`);
}

function getBasicUsersFromEnvironment(): Record<string, AuthenticationBasicUser> {
  const users: Record<string, AuthenticationBasicUser> = {};
  for (const i of [...Array(99).keys()]) {
    const username = (process.env[`AUTH_USER_${i}`] ?? '').trim();
    const password = (process.env[`AUTH_PASSWORD_${i}`] ?? '').trim();
    if (username.length > 0 && password.length > 0) {
      users[username] = {
        username,
        password,
      };
    }
  }
  return users;
}

function authProductionPrintNotices() {
  if (process.env.NODE_ENV !== 'development') {
    let message = process.env.OPENAI_API_KEY ? 'OPENAI_API_KEY has been provided. ' : '';
    message +=
      authType
        ? Object.keys(authBasicUsers).length > 0
          ? 'Info: AUTH_TYPE has been provided and users have been set up. '
          : 'Warning: AUTH_TYPE has been provided but no users have been set up. '
        : 'However, an AUTH_TYPE has not been provided. This means that anyone can use your OpenAI API and incur costs. ';
    console.warn(message);
  }
}

export const authType: AuthenticationType | null = validateAuthenticationType(process.env.SERVER_AUTH_TYPE);
export const authBasicUsers: Record<string, AuthenticationBasicUser> = authType === 'credential' ? getBasicUsersFromEnvironment() : {};

authProductionPrintNotices();


// Next Auth functions

export function authCreateProviders() {
  const providers: any[] = [];

  if (authType === 'credential') {
    providers.push(
      CredentialsProvider({
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' },
        },

        async authorize(credentials, req) {
          const username = credentials?.username;
          const password = credentials?.password;

          // Check if credentials are valid
          if (username && password) {
            const user = authBasicUsers[username] ?? null;
            if (user?.password === password) {
              return {
                id: user.username,
              };
            }
          }

          // If credentials are invalid, return null
          return null;
        },
      }),
    );
  }

  return providers;
}
