import * as React from 'react';

import type { ActileItem, ActileProvider } from './ActileProvider';
import { ActilePopup } from './ActilePopup';


export const useActileManager = (providers: ActileProvider[], anchorRef: React.RefObject<HTMLElement>) => {

  // state
  const [popupOpen, setPopupOpen] = React.useState(false);
  const [itemsByProvider, setItemsByProvider] = React.useState<{ provider: ActileProvider, items: ActileItem[] }[]>([]);
  const [activeSearchString, setActiveSearchString] = React.useState<string>('');
  const [activeItemIndex, setActiveItemIndex] = React.useState<number>(0);

  // derived state
  const activeItemsByProvider = React.useMemo(() => {
    const search = activeSearchString.trim().toLowerCase();
    return itemsByProvider.map(({ provider, items }) => ({
      provider,
      items: items.filter(item => item.label?.toLowerCase().startsWith(search)),
    })).filter(({ items }) => items.length > 0);
  }, [itemsByProvider, activeSearchString]);

  const flatActiveItems = React.useMemo(() => {
    return activeItemsByProvider.flatMap(({ items }) => items);
  }, [activeItemsByProvider]);
  const totalItems = flatActiveItems.length;
  const activeItem = totalItems > 0 && activeItemIndex >= 0 && activeItemIndex < totalItems ? flatActiveItems[activeItemIndex] : null;

  const handleClose = React.useCallback(() => {
    setPopupOpen(false);
    setItemsByProvider([]);
    setActiveSearchString('');
    setActiveItemIndex(0);
  }, []);

  const handlePopupItemClicked = React.useCallback((item: ActileItem) => {
    const provider = providers.find(p => p.key === item.providerKey);
    provider?.onItemSelect(item);
    handleClose();
  }, [providers, handleClose]);

  const handleEnterKey = React.useCallback(() => {
    if (activeItem)
      handlePopupItemClicked(activeItem);
  }, [activeItem, handlePopupItemClicked]);

  const actileInterceptTextChange = React.useCallback((trailingText: string) => {
    // Collect all providers whose trigger matches
    const matchingProviders = providers.filter(provider => provider.fastCheckTriggerText(trailingText));

    if (matchingProviders.length > 0) {
      // Fetch items from all matching providers
      Promise.all(matchingProviders.map(provider =>
        provider.fetchItems().then(({ searchPrefix, items }) => ({
          provider,
          searchPrefix,
          items: items.map(item => ({ ...item, providerKey: provider.key })),
        })),
      )).then((results) => {
        // Filter out empty results
        results = results.filter(result => result.items.length > 0);
        if (results.length) {
          setPopupOpen(true);
          setItemsByProvider(results.map(result => ({ provider: result.provider, items: result.items })));
          setActiveSearchString(results[0].searchPrefix); // Assuming all search prefixes are the same
          setActiveItemIndex(0);
        }
      }).catch(error => {
        handleClose();
        console.error('Failed to fetch popup items:', error);
      });
      return true;
    }
    return false;
  }, [handleClose, providers]);

  const actileInterceptKeydown = React.useCallback((_event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    const { key, currentTarget, ctrlKey, metaKey } = _event;

    if (popupOpen) {
      if (key === 'Escape' || key === 'ArrowLeft') {
        _event.preventDefault();
        handleClose();
      } else if (key === 'ArrowUp') {
        _event.preventDefault();
        setActiveItemIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : totalItems - 1));
      } else if (key === 'ArrowDown') {
        _event.preventDefault();
        setActiveItemIndex((prevIndex) => (prevIndex < totalItems - 1 ? prevIndex + 1 : 0));
      } else if (key === 'Enter' || key === 'ArrowRight' || key === 'Tab' || (key === ' ' && totalItems === 1)) {
        _event.preventDefault();
        handleEnterKey();
      } else if (key === 'Backspace') {
        handleClose();
      } else if (key.length === 1 && !ctrlKey && !metaKey) {
        setActiveSearchString((prev) => prev + key);
        setActiveItemIndex(0);
      }
      return true;
    }

    // Popup closed: Check for triggers
    const trailingText = (currentTarget.value || '') + key;
    return actileInterceptTextChange(trailingText);

  }, [actileInterceptTextChange, handleClose, handleEnterKey, popupOpen, totalItems]);

  const actileComponent = React.useMemo(() => {
    return !popupOpen ? null : (
      <ActilePopup
        anchorEl={anchorRef.current}
        onClose={handleClose}
        itemsByProvider={activeItemsByProvider}
        activeItemIndex={activeItemIndex}
        activePrefixLength={activeSearchString.length}
        onItemClick={handlePopupItemClicked}
      />
    );
  }, [activeItemIndex, activeItemsByProvider, activeSearchString.length, anchorRef, handleClose, handlePopupItemClicked, popupOpen]);

  return {
    actileComponent,
    actileInterceptKeydown,
    actileInterceptTextChange,
  };
};
