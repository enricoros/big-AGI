import type { FunctionComponent } from 'react';

import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import CallIcon from '@mui/icons-material/Call';
import Diversity2Icon from '@mui/icons-material/Diversity2';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import GitHubIcon from '@mui/icons-material/GitHub';
import IosShareIcon from '@mui/icons-material/IosShare';
import SettingsIcon from '@mui/icons-material/Settings';
import TelegramIcon from '@mui/icons-material/Telegram';
import WorkspacesIcon from '@mui/icons-material/Workspaces';

import { Brand } from '~/common/app.config';
import { DiscordIcon } from '~/common/components/icons/DiscordIcon';


// enable to show all items, for layout development
const SHOW_ALL_APPS = false;


// Nav items

interface ItemBase {
  name: string,
  icon: FunctionComponent,
  tooltip?: string,
}

export interface NavItemApp extends ItemBase {
  type: 'app',
  route: string,
  drawer?: string,      // if set, show the drawer, with this name
  hideBar?: boolean,    // set to true to hide the page bar
  hideNav?: boolean,    // set to hide the Nav bar (note: must have a way to navigate back)
  automatic?: boolean,  // only accessible by the machine
  fullWidth?: boolean,  // set to true to override the user preference
  hide?: boolean,       // delete from the UI
}

export interface NavItemModal extends ItemBase {
  type: 'modal',
  overlayId: 'settings' | 'models',
}

export interface NavItemExtLink extends ItemBase {
  type: 'extLink',
  href: string,
}

// interface MenuItemAction extends ItemBase {
//   type: 'action',
//   action: () => void,
// }


export const navItems: {
  apps: NavItemApp[]
  modals: NavItemModal[]
  links: NavItemExtLink[],
} = {

  // User-chosen apps
  apps: [
    {
      name: 'Chat',
      icon: TelegramIcon,
      type: 'app',
      route: '/',
      drawer: 'Chats',
    },
    {
      name: 'Call',
      icon: CallIcon,
      type: 'app',
      route: '/call',
      drawer: 'Recent Calls',
      automatic: true,
      fullWidth: true,
    },
    {
      name: 'Draw',
      icon: FormatPaintIcon,
      type: 'app',
      route: '/draw',
      hide: true,
    },
    {
      name: 'Cortex',
      icon: AutoAwesomeIcon,
      type: 'app',
      route: '/cortex',
      automatic: true,
    },
    {
      name: 'Patterns',
      icon: AccountTreeIcon,
      type: 'app',
      route: '/patterns',
      hide: true,
    },
    {
      name: 'Workspace',
      icon: WorkspacesIcon,
      type: 'app',
      route: '/workspace',
      hide: true,
    },
    {
      name: 'Personas',
      icon: Diversity2Icon,
      type: 'app',
      route: '/personas',
      hideBar: true,
    },
    {
      name: 'News',
      icon: EventNoteIcon,
      type: 'app',
      route: '/news',
      hideBar: true,
    },

    // non-user-selectable ('automatic') Apps
    {
      name: 'Shared Chat',
      icon: IosShareIcon,
      type: 'app',
      route: '/link/chat/[chatLinkId]',
      drawer: 'Shared Chats',
      automatic: true,
      hideNav: true,
    },
  ],

  // Modals
  modals: [
    {
      name: 'Manage Models',
      icon: BuildCircleIcon,
      type: 'modal',
      overlayId: 'models',
    },
    {
      name: 'Settings',
      icon: SettingsIcon,
      type: 'modal',
      overlayId: 'settings',
    },
  ],

  // External links
  links: [
    // {
    //   name: 'X',
    //   icon: TwitterIcon,
    //   type: 'extLink',
    //   href: 'https://twitter.com',
    // },
    {
      name: 'GitHub',
      icon: GitHubIcon,
      type: 'extLink',
      href: Brand.URIs.OpenRepo,
    },
    {
      name: 'Discord',
      icon: DiscordIcon,
      type: 'extLink',
      href: Brand.URIs.SupportInvite,
    },
  ],

};

// apply UI filtering right away - do it here, once, and for all
navItems.apps = navItems.apps.filter(app => !app.hide || SHOW_ALL_APPS);