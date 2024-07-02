export const File = [
  {
    type: 'item',
    text: 'Create Shortcut',
    disable: true,
  },
  {
    type: 'item',
    text: 'Delete',
    disable: true,
  },
  {
    type: 'item',
    text: 'Rename',
    disable: true,
  },
  {
    type: 'item',
    disable: true,
    text: 'Properties',
  },
  {
    type: 'separator',
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
    text: 'Undo',
    hotkey: 'Ctrl+Z',
  },
  {
    type: 'separator',
  },
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
    type: 'item',
    disable: true,
    text: 'Paste Shortcut',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Copy To Folder...',
    disable: true,
  },
  {
    type: 'item',
    text: 'Move To Folder...',
    disable: true,
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
    type: 'item',
    text: 'Invert Selection',
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
    type: 'item',
    text: 'Thumbnails',
  },
  {
    type: 'item',
    text: 'Tiles',
    symbol: 'circle',
  },
  {
    type: 'item',
    text: 'Icons',
  },
  {
    type: 'item',
    text: 'List',
  },
  {
    type: 'item',
    text: 'Details',
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
    text: 'Arrange Icons by',
    items: [
      {
        type: 'item',
        text: 'Name',
      },
      {
        type: 'item',
        text: 'Type',
        symbol: 'circle',
      },
      {
        type: 'item',
        text: 'Total Size',
      },
      {
        type: 'item',
        text: 'Free Space',
      },
      {
        type: 'item',
        text: 'Comments',
      },
      {
        type: 'separator',
      },
      {
        type: 'item',
        text: 'Show in Groups',
        symbol: 'check',
      },
      {
        type: 'item',
        text: 'Auto Arrange',
      },
      {
        type: 'item',
        text: 'Align to Grid',
      },
    ],
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Choose Details...',
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
        type: 'item',
        text: 'Up One Level',
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
        text: 'My Computer',
        symbol: 'check',
      },
    ],
  },
  {
    type: 'item',
    text: 'Refresh',
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
    type: 'item',
    text: 'Map Network Drive...',
  },
  {
    type: 'item',
    text: 'Disconnect Network Drive...',
  },
  {
    type: 'item',
    text: 'Synchronize...',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Folder Options...',
  },
];
const Help = [
  {
    type: 'item',
    text: 'Help and Support Center',
  },
  {
    type: 'separator',
  },
  {
    type: 'item',
    text: 'Is this copy of Windows legal?',
  },
  {
    type: 'item',
    text: 'About Windows',
  },
];
export default { File, Edit, View, Favorites, Tools, Help };
