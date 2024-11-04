import dynamic from 'next/dynamic';
import { withNextJSPerPageLayout } from '~/common/layout/withLayout';

const AppDraw = dynamic(
  () => import('../src/apps/draw/AppDraw').then(mod => ({ default: mod.AppDraw })),
  { ssr: false }
);

export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppDraw />);