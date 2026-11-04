import { lookup } from 'node:dns/promises';

import type { EgressDnsResolver } from '~/server/egress.server';


/** System resolver (Node runtime only) - the same lookup the subsequent connection will use. */
export const egressResolveNodeDns: EgressDnsResolver = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map(r => r.address);
