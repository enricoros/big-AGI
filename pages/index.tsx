import * as React from 'react';

import { AppLayout } from '@/common/layouts/AppLayout';

import { Chat } from '../src/apps/chat/Chat';


export default function Home() {
  // const router = useRouter();
  // React.useEffect(() => {
  //   // noinspection JSIgnoredPromiseFromCall
  //   router.replace('/chat');
  // }, [router]);

  return (
    <AppLayout>
      <Chat />
    </AppLayout>
  );
}