import type { FunctionComponent } from 'react';

// App icons
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CallIcon from '@mui/icons-material/Call';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import Diversity2Icon from '@mui/icons-material/Diversity2';
import Diversity2OutlinedIcon from '@mui/icons-material/Diversity2Outlined';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import TextsmsIcon from '@mui/icons-material/Textsms';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import WorkspacesOutlinedIcon from '@mui/icons-material/WorkspacesOutlined';
// Automatic apps
import IosShareIcon from '@mui/icons-material/IosShare';
// Link icons
import GitHubIcon from '@mui/icons-material/GitHub';
import { DiscordIcon } from '~/common/components/icons/DiscordIcon';
// Modal icons
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import SettingsIcon from '@mui/icons-material/Settings';


import { Brand } from '~/common/app.config';


// enable to show all items, for layout development
const SHOW_ALL_APPS = false;


// Nav items

interface ItemBase {
  name: string,
  icon: FunctionComponent,
  iconActive?: FunctionComponent,
  tooltip?: string,
}

export interface NavItemApp extends ItemBase {
  type: 'app',
  route: string,
  drawer?: string | true, // true: can make use of the drawer, string: also set the title
  hideBar?: boolean,      // set to true to hide the page bar
  hideNav?: boolean,      // set to hide the Nav bar (note: must have a way to navigate back)
  automatic?: boolean,    // only accessible by the machine
  fullWidth?: boolean,    // set to true to override the user preference
  hide?: boolean,         // delete from the UI
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
      icon: TextsmsOutlinedIcon,
      iconActive: TextsmsIcon,
      type: 'app',
      route: '/',
      drawer: true,
    },
    {
      name: 'Call',
      icon: CallOutlinedIcon,
      iconActive: CallIcon,
      type: 'app',
      route: '/call',
      // drawer: 'Recent Calls',
      automatic: true,
      fullWidth: true,
    },
    {
      name: 'Draw',
      icon: FormatPaintOutlinedIcon,
      iconActive: FormatPaintIcon,
      type: 'app',
      route: '/draw',
      hide: true,
    },
    {
      name: 'Cortex',
      icon: AutoAwesomeOutlinedIcon,
      iconActive: AutoAwesomeIcon,
      type: 'app',
      route: '/cortex',
      automatic: true,
      hide: true,
    },
    {
      name: 'Patterns',
      icon: AccountTreeOutlinedIcon,
      iconActive: AccountTreeIcon,
      type: 'app',
      route: '/patterns',
      hide: true,
    },
    {
      name: 'Workspace',
      icon: WorkspacesOutlinedIcon,
      iconActive: WorkspacesIcon,
      type: 'app',
      route: '/workspace',
      hide: true,
    },
    {
      name: 'Personas',
      icon: Diversity2OutlinedIcon,
      iconActive: Diversity2Icon,
      type: 'app',
      route: '/personas',
      drawer: true,
      hideBar: true,
    },
    {
      name: 'News',
      icon: EventNoteOutlinedIcon,
      iconActive: EventNoteIcon,
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
      name: 'Preferences',
      icon: SettingsIcon,
      type: 'modal',
      overlayId: 'settings',
    },
  ],

  // External links
  links: [
    // {
    //   type: 'extLink',
    //   name: 'X',
    //   icon: TwitterIcon,
    //   href: 'https://twitter.com',
    // },
    {
      type: 'extLink',
      name: 'Discord',
      icon: DiscordIcon,
      href: Brand.URIs.SupportInvite,
    },
    {
      type: 'extLink',
      name: 'GitHub',
      icon: GitHubIcon,
      href: Brand.URIs.OpenRepo,
    },
  ],

};

// apply UI filtering right away - do it here, once, and for all
navItems.apps = navItems.apps.filter(app => !app.hide || SHOW_ALL_APPS);