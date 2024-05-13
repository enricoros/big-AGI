import * as React from 'react';
import dynamic from 'next/dynamic';
import { RedirectToSignIn, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';


const enableClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Dynamically import ClerkProvider only if ENABLE_CLERK is true
const ClerkProviderDynamic = !enableClerk ? null : dynamic(() =>
  import('@clerk/nextjs')
    .then(({ ClerkProvider }) => ClerkProvider)
    .catch(err => {
      console.error('Failed to load ClerkProvider:', err);
      const AuthLoadIssue = () => <>Issue Loading Auth</>;
      AuthLoadIssue.displayName = 'AuthLoadIssue';
      return AuthLoadIssue;
    }),
);

export const ProviderAuth = (props: { children: React.ReactNode }) => (enableClerk && ClerkProviderDynamic)
  ? (
    <ClerkProviderDynamic>
      <SignedIn>
        {props.children}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </ClerkProviderDynamic>
  ) : props.children;

export const authUserButton = (enableClerk && ClerkProviderDynamic)
  ? <>
    <UserButton />
  </>
  : null;