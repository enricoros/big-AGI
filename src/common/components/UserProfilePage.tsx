'use client';

import React from 'react';
import { UserProfile } from '@clerk/nextjs';

import { useInterval } from 'usehooks-ts';
import { useState } from 'react';

export function UserProfilePage(props: { path?: string }) {
  const path = props?.path ?? '/user-profile';
  const [count, setCount] = useState<number>(0);
  const checkAuthFn = () => {
    //     setCount(count + 1);
    //     fetch('/api/auth', { method: 'GET', headers: { accept: 'application/json' } })
    //       .then((res) => {
    //         if (res.ok) console.log(`Res OK`);
    //         const resUnpacked = res.headers.get('Content-Type')?.includes('application/json')
    //           ? res.json()
    //           : res.text();
    //         console.debug(resUnpacked);
    //         return resUnpacked;
    //       })
    //       .then((data) => console.log(data))
    //       .catch((err) => {
    //         console.error(err);
    //         debugger;
    //       });
  };

  //   useInterval(checkAuthFn, 10000);

  return <UserProfile path={path} />;
}

export default UserProfilePage;
