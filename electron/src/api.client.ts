// import { createTRPCProxyClient, httpLink, loggerLink } from '@trpc/client';
// import type { AppRouterEdge } from '../../src/server/api/trpc.router-edge';
// import superjson from 'superjson';
// import { getBaseUrl } from '../../src/common/util/urlUtils';
//
// export const apiAsync = createTRPCProxyClient<AppRouterEdge>({
//   transformer: superjson,
//   links: [
//     loggerLink({ enabled: () => true }),
//     httpLink({
//       url: `${getBaseUrl()}/api/trpc-edge`,
//     }),
//   ],
// });