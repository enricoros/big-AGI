import * as React from 'react';

import { Breadcrumbs, BreadcrumbsSlotsAndSlotProps, Typography } from '@mui/joy';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { Link } from '~/common/components/Link';


const _breadcrumbSlotProps: BreadcrumbsSlotsAndSlotProps['slotProps'] = {
  root: {
    sx: { p: 0 },
  },
  // see anatomy https://mui.com/joy-ui/react-breadcrumbs/#anatomy
  ol: {
    // keep it all in one line
    sx: { flexWrap: 'nowrap' },
  },
  li: {
    // undo the 'flex' on li, and auto-ellipsize contents
    sx: { display: 'block' },
    className: 'agi-ellipsize',
  },
} as const;


export function AppBreadcrumbs(props: {
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  rootTitle?: React.ReactNode;
  onRootClick?: () => void;
}) {

  // prevent default href

  const { rootTitle, onRootClick } = props;
  const handleRootClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onRootClick?.();
  }, [onRootClick]);

  return <Breadcrumbs size={props.size || 'sm'} aria-label='breadcrumbs' separator={<KeyboardArrowRightIcon />} slotProps={_breadcrumbSlotProps}>
    {/* Title */}
    {(props.children && !!rootTitle && !!onRootClick) ? <AppBreadcrumbs.Link color='neutral' href='#' onClick={handleRootClick}>{props.rootTitle}</AppBreadcrumbs.Link>
      : (typeof props.rootTitle === 'string') ? <Typography>{props.rootTitle}</Typography>
        : props.rootTitle
    }
    {/* Rest */}
    {props.children}
    {/*{nav.pnt === 'create-new' && <Link color='neutral' href='#'>Create New</Link>}*/}
    {/*{['Characters', 'Futurama', 'TV Shows', 'Home'].map((item: string) => (*/}
    {/*  <Link key={item} color='neutral' href='#'>*/}
    {/*    {item}*/}
    {/*  </Link>*/}
    {/*))}*/}
  </Breadcrumbs>;
}

// Important, use this as Link
AppBreadcrumbs.Link = Link;

// Important, use this as Leaf
AppBreadcrumbs.Leaf = Typography;
