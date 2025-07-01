import * as React from 'react';

import { Badge, BadgeProps } from '@mui/joy';

import { uiSetDismissed, useUIIsDismissed } from '~/common/stores/store-ui';


// configuration
const DEBUG_SHOW_ALL = false;  // set to true to show all badges (for debugging purposes)
const FEATURE_COLOR = 'color-feature';


export function FeatureBadge(props: Omit<BadgeProps, 'size'> & {
  /** will be prefixed with 'feature-badge-...' */
  featureKey: string;
  active: boolean;
  label?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';  // default: 'sm'
}) {

  const { featureKey: featureKeySuffix, active, label, size = 'sm', color, children, ...badgeProps } = props;
  const featureKey = 'feature-badge-' + featureKeySuffix;

  // external state
  const isDismissed = useUIIsDismissed(featureKey) ?? false;


  // [effect] mark as dismissed when the feature flips to active for the first time
  const firstFlip = !isDismissed && active;
  React.useEffect(() => {
    firstFlip && uiSetDismissed(featureKey);
  }, [featureKey, firstFlip]);


  // NOTE: changes the DOM structure (1 level less)
  const invisible = isDismissed || active;
  if (!DEBUG_SHOW_ALL && invisible)
    return children;

  return (
    <Badge
      // invisible={invisible}
      size={size}
      color={color ?? FEATURE_COLOR as any}
      badgeContent={label}
      {...badgeProps}
    >
      {children}
    </Badge>
  );
}
