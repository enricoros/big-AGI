export const File = [
  {
    type: 'menu',
    text: 'New',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    items: [
      {
        type: 'item',
        text: 'Window',
        hotkey: 'Ctrl+N',
      },
      { type: 'separator' },
      {
        type: 'item',
        text: 'Message',
      },
      {
        type: 'item',
        text: 'Post',
      },
      {
        type: 'item',
        text: 'Contact',
      },
      {
        type: 'item',
        text: 'Internet Call',
      },
    ],
  },
  {
    type: 'item',
    text: 'Open...',
    hotkey: 'Ctrl+O',
  },
  {
    type: 'item',
    text: 'Edit',
    disable: true,
  },
  {
    type: 'item',
    disable: true,
    text: 'Save',
    hotkey: 'Ctrl+S',
  },
  {
    type: 'item',
    text: 'Save As...',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Page Setup...',
  },
  {
    type: 'item',
    text: 'Print...',
    hotkey: 'Ctrl+P',
  },
  {
    type: 'item',
    text: 'Print Preview...',
  },
  {
    type: 'separator',
  },
  {
    type: 'menu',
    text: 'Send',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    items: [
      {
        type: 'item',
        text: 'Page by E-mail...',
      },
      {
        type: 'item',
        text: 'Link by E-mail...',
      },
      {
        type: 'item',
        text: 'Shortcut to Desktop',
      },
    ],
  },
  {
    type: 'item',
    text: 'Import and Export...',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Properties',
  },
  {
    type: 'item',
    text: 'Work Offline',
  },
  {
    type: 'item',
    text: 'Close',
  },
];

const Edit = [
  {
    type: 'item',
    disable: true,
    text: 'Cut',
    hotkey: 'Ctrl+X',
  },
  {
    type: 'item',
    disable: true,
    text: 'Copy',
    hotkey: 'Ctrl+C',
  },
  {
    type: 'item',
    disable: true,
    text: 'Paste',
    hotkey: 'Ctrl+V',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Select All',
    hotkey: 'Ctrl+A',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Find (on This Page)...',
    hotkey: 'Ctrl+F',
  },
];

const View = [
  {
    type: 'menu',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Toolbars',
    items: [
      {
        type: 'item',
        symbol: 'check',
        text: 'Standard Buttons',
      },
      {
        type: 'item',
        symbol: 'check',
        text: 'Address Bar',
      },
      {
        type: 'item',
        symbol: 'check',
        text: 'Links',
      },
      {
        type: 'separator',
      },
      {
        type: 'item',
        symbol: 'check',
        text: 'Lock the Toolbars',
      },
      {
        type: 'item',
        text: 'Customize...',
      },
    ],
  },
  {
    type: 'item',
    symbol: 'check',
    text: 'Status Bar',
  },
  {
    type: 'menu',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Explorer Bar',
    items: [
      {
        type: 'item',
        text: 'Search',
        hotkey: 'Ctrl+E',
      },
      {
        type: 'item',
        text: 'Favorites',
        hotkey: 'Ctrl+I',
      },
      {
        type: 'item',
        text: 'History',
        hotkey: 'Ctrl+H',
      },
      {
        type: 'item',
        text: 'Folders',
      },
      {
        type: 'separator',
      },
      {
        type: 'item',
        text: 'Tip of the Day',
      },
    ],
  },
  {
    type: 'separator',
  },
  {
    type: 'menu',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Go to',
    items: [
      {
        type: 'item',
        disable: true,
        text: 'Back',
        hotkey: 'Alt+Left Arrow',
      },
      {
        type: 'item',
        disable: true,
        text: 'Forward',
        hotkey: 'Alt+Right Arrow',
      },
      {
        type: 'separator',
      },
      {
        type: 'item',
        text: 'Home Page',
        hotkey: 'Alt+Home',
      },
      {
        type: 'separator',
      },
      {
        type: 'item',
        text: 'Cannot find server',
        symbol: 'check',
      },
    ],
  },
  {
    type: 'item',
    text: 'Stop',
    hotkey: 'Esc',
  },
  {
    type: 'item',
    text: 'Refresh',
    hotkey: 'F5',
  },
  {
    type: 'separator',
  },
  {
    type: 'menu',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Text Size',
    items: [
      {
        type: 'item',
        text: 'Largest',
      },
      {
        type: 'item',
        text: 'Larger',
      },
      {
        type: 'item',
        text: 'Medium',
        symbol: 'circle',
      },
      {
        type: 'item',
        text: 'Smaller',
      },
      {
        type: 'item',
        text: 'Smallest',
      },
    ],
  },
  {
    type: 'menu',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Encoding',
    items: [
      {
        type: 'item',
        text: 'Auto-Select',
      },
      {
        type: 'separator',
      },
      {
        type: 'item',
        text: 'Western European (Windows)',
        symbol: 'circle',
      },
      {
        type: 'menu',
        position: {
          left: 'calc(100% - 4px)',
          top: '-3px',
        },
        text: 'More',
        items: [
          {
            type: 'item',
            text: 'Arabic(ASMO 708)',
          },
          {
            type: 'separator',
          },
          {
            type: 'item',
            text: 'Chinese Traditional',
          },
        ],
      },
    ],
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Source',
  },
  {
    type: 'item',
    disable: true,
    text: 'Privacy Report...',
  },
  {
    type: 'item',
    text: 'Full Screen',
    hotkey: 'F11',
  },
];
const Favorites = [
  {
    type: 'item',
    text: 'Add to Favorites...',
  },
  {
    type: 'item',
    text: 'Organize Favorites...',
  },
  {
    type: 'separator',
  },
  {
    type: 'menu',
    symbol: 'folder',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Links',
    items: [
      {
        type: 'item',
        text: 'Customize Links',
        symbol: 'ie-paper',
      },
      {
        type: 'item',
        text: 'Free Hotmail',
        symbol: 'ie-paper',
      },
      {
        type: 'item',
        text: 'Windows',
        symbol: 'ie-paper',
      },
      {
        type: 'item',
        text: 'Windows Marketplace',
        symbol: 'ie-book',
      },
      {
        type: 'item',
        text: 'Windows Media',
        symbol: 'ie-paper',
      },
    ],
  },
  {
    type: 'item',
    text: 'MSN.com',
    symbol: 'ie-paper',
  },
  {
    type: 'item',
    text: 'Radio Station Guide',
    symbol: 'ie-paper',
  },
];
const Tools = [
  {
    type: 'menu',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Mail and News',
    items: [
      {
        type: 'item',
        text: 'Read Mail',
      },

      {
        type: 'item',
        text: 'New Message...',
      },
      {
        type: 'item',
        text: 'Send a Link...',
      },
      {
        type: 'item',
        text: 'Send Page...',
      },
      {
        type: 'separator',
      },
      {
        type: 'item',
        text: 'Read News',
      },
    ],
  },
  {
    type: 'menu',
    position: {
      left: 'calc(100% - 4px)',
      top: '-3px',
    },
    text: 'Pop-up Blocker',
    items: [
      {
        type: 'item',
        text: 'Turn Off Pop-up Blocker',
      },

      {
        type: 'item',
        text: 'Pop-up Blocker Settings...',
      },
    ],
  },
  {
    type: 'item',
    text: 'Manage Add-ons...',
  },
  {
    type: 'item',
    text: 'Synchronize...',
  },
  {
    type: 'item',
    text: 'Windows Update',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Windows Messenger',
  },
  {
    type: 'item',
    text: 'Diagnose Connection Problems...',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Internet Options...',
  },
];
const Help = [
  {
    type: 'item',
    text: 'Contents and Index',
  },
  {
    type: 'item',
    text: 'Tip of the Day',
  },
  {
    type: 'item',
    text: 'For Netscape Users',
  },
  {
    type: 'item',
    text: 'Online Support',
  },
  {
    type: 'item',
    text: 'Send Feedback',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'About Internet Explorer',
  },
];
export default { File, Edit, View, Favorites, Tools, Help };
