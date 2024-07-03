'use client';

import React from 'react';
import { UserProfile } from '@clerk/nextjs';

export function UserProfilePage(props: { path?: string }) {
  const path = props?.path ?? '/user-profile';
  return <UserProfile path={path} />;
}

export default UserProfilePage;
