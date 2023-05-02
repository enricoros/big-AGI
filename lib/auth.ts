type AuthType = 'credential';

interface BasicUser {
  username: string;
  password: string;
  type: AuthType;
}

/// will be used by the rest of the app to Toggle Authentication
const supportedAuthTypes: AuthType[] = ['credential'];
export const authNeeded: boolean = supportedAuthTypes.includes((process.env.AUTH_TYPE ?? '') as AuthType);

/// if needsAuth, then this will be populated with the users -- NOTE: this will be empty in the UI, only defined on the /api
export const authUserData: Record<string, BasicUser> = {};

/// parse all USER/ENV variables from the environment to populate the user auth data
if (authNeeded) {
  for (const i of [...Array(99).keys()]) {
    const username = (process.env[`AUTH_USER_${i}`] ?? '').trim();
    const password = (process.env[`AUTH_PASSWORD_${i}`] ?? '').trim();
    if (username.length > 0 && password.length > 0) {
      authUserData[username] = {
        username,
        password,
        type: 'credential',
      };
    }
  }
}
