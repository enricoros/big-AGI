import * as React from 'react';

export const ProviderSingleTab = (props: { disabled?: boolean, children: React.ReactNode }) => {
  // Always render children, bypassing the single-tab enforcer.
  return props.children;
};
