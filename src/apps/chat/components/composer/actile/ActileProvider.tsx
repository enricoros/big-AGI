import type { FunctionComponent } from 'react';

export interface ActileItem {
  key: string;
  label: string;
  argument?: string;
  description?: string;
  Icon?: FunctionComponent;
}

export interface ActileProvider<TItem extends ActileItem = ActileItem> {
  fastCheckTriggerText: (trailingText: string) => boolean;
  fetchItems: () => Promise<{ title: string, searchPrefix: string, items: TItem[] }>;
  onItemSelect: (item: ActileItem) => void;
}
