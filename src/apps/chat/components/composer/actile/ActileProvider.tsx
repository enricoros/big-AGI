import type { FunctionComponent } from 'react';

export interface ActileItem {
  id: string;
  label: string;
  argument?: string;
  description?: string;
  Icon?: FunctionComponent;
}

type ActileProviderIds = 'actile-commands' | 'actile-attach-reference';

export interface ActileProvider {
  id: ActileProviderIds;
  title: string;
  searchPrefix: string;

  checkTriggerText: (trailingText: string) => boolean;

  fetchItems: () => Promise<ActileItem[]>;
  onItemSelect: (item: ActileItem) => void;
}
