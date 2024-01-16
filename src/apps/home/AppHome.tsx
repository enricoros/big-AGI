import { useState, useEffect } from 'react';
import { Box, Typography, Button, CssVarsProvider } from '@mui/joy';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from 'src/firebase';

export default function Home() {
  const { isSignedIn, user } = useUser();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);

  useEffect(() => {
    const checkAuthorization = async () => {
      if (user) {
        const userEmail = user.primaryEmailAddress?.emailAddress || '';
        const userDocRef = doc(firestore, 'users', userEmail);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setIsAuthorized(userDoc.data().authorized);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
      setIsAuthCheckComplete(true);
    };

    checkAuthorization();
  }, [user]);

  return (
    <CssVarsProvider>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: `radial-gradient(circle at 84% 82%, rgba(217, 217, 217,0.03) 0%, rgba(217, 217, 217,0.03) 21%,transparent 21%, transparent 100%),radial-gradient(circle at 75% 56%, rgba(3, 3, 3,0.03) 0%, rgba(3, 3, 3,0.03) 30%,transparent 30%, transparent 100%),radial-gradient(circle at 74% 53%, rgba(153, 153, 153,0.03) 0%, rgba(153, 153, 153,0.03) 95%,transparent 95%, transparent 100%),radial-gradient(circle at 86% 43%, rgba(209, 209, 209,0.03) 0%, rgba(209, 209, 209,0.03) 83%,transparent 83%, transparent 100%),radial-gradient(circle at 64% 88%, rgba(192, 192, 192,0.03) 0%, rgba(192, 192, 192,0.03) 2%,transparent 2%, transparent 100%),radial-gradient(circle at 73% 77%, rgba(205, 205, 205,0.03) 0%, rgba(205, 205, 205,0.03) 18%,transparent 18%, transparent 100%),radial-gradient(circle at 57% 51%, rgba(161, 161, 161,0.03) 0%, rgba(161, 161, 161,0.03) 64%,transparent 64%, transparent 100%),radial-gradient(circle at 40% 84%, rgba(115, 115, 115,0.03) 0%, rgba(115, 115, 115,0.03) 14%,transparent 14%, transparent 100%),linear-gradient(90deg, rgb(0,0,0),rgb(0,0,0))`,
        }}
      >
        <Box sx={{ position: 'absolute', top: '20px', right: '20px' }}>
          <SignedIn>{isSignedIn && <UserButton afterSignOutUrl="/" />}</SignedIn>
          <SignedOut>
            <SignInButton>
              <Button variant="plain" sx={{ color: 'white', mr: 1 }}>
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button variant="plain" sx={{ color: 'white' }}>
                Sign Up
              </Button>
            </SignUpButton>
          </SignedOut>
        </Box>
        <Typography level="h1" sx={{ color: 'white', textAlign: 'center', mb: 2 }}>
          big-AGI
        </Typography>
        <Typography level="title-lg" sx={{ color: 'white', textAlign: 'center', maxWidth: '600px' }}>
          Exploring the boundaries of AI, one conversation at a time.
        </Typography>
        <SignedIn>
          {isAuthCheckComplete &&
            (isAuthorized ? (
              <Button variant="solid" sx={{ mt: 2 }}>
                Start a Conversation
              </Button>
            ) : (
              <Typography sx={{ color: 'white', textAlign: 'center', mt: 2 }}>
                Sorry, you were not given permission to access the chat. Contact Bill for more details.
              </Typography>
            ))}
        </SignedIn>
      </Box>
    </CssVarsProvider>
  );
}
