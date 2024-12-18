import type { FunctionComponent } from 'react';

export interface ActileProvider<TItem extends ActileItem = ActileItem> {

  // Unique key for the provider
  readonly key: 'pcmd' | 'pstrmsg' | 'pattlbl';

  // Label for display
  get label(): string;

  // Interface for the provider
  fastCheckTriggerText: (trailingText: string) => boolean;
  fetchItems: () => ActileProviderItems<TItem>;
  onItemSelect: (item: ActileItem) => void;

}

export type ActileProviderItems<TItem extends ActileItem = ActileItem> = Promise<{ searchPrefix: string, items: TItem[] }>;

export interface ActileItem {
  key: string;
  providerKey: ActileProvider['key'];
  label: string;
  argument?: string;
  description?: string;
  Icon?: FunctionComponent;
}
