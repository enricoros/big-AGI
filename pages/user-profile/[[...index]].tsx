import { withLayout } from '~/common/layout/withLayout';
import dynamic from 'next/dynamic';

export const DynamicUserProfilePage = dynamic(
  () => import('../../src/common/components/UserProfilePage').then((m) => m.UserProfilePage),
  { ssr: false, loading: () => <p>Loading...</p> }
);

export function DynamicUserProfilePageWithLayout() {
  return withLayout(
    { type: 'optima' },

    <DynamicUserProfilePage path="/user-profile" />
  );
}

export default DynamicUserProfilePageWithLayout;
