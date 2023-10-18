import { apiAsyncNode } from '~/common/util/trpc.client';

export const CmdRunBrowse: string[] = ['/browse'];


export async function callBrowseFetchSinglePage(url: string): Promise<string | null> {
  try {

    const results = await apiAsyncNode.browse.fetchPages.mutate({
      access: { dialect: 'browse-wss' },
      subjects: [{ url }],
    });

    if (results.objects.length !== 1)
      return `Browsing error: expected 1 result, got ${results.objects.length}`;

    const firstResult = results.objects[0];
    return !firstResult.error ? firstResult.content : `Browsing service error: ${firstResult.error}`;

  } catch (error: any) {
    return `Browsing error: ${error?.message || error?.toString() || 'Unknown fetch error'}`;
  }
}
