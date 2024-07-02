/**
 * Application Identity (Brand)
 *
 * Also note that the 'Brand' is used in the following places:
 *  - README.md               all over
 *  - package.json            app-slug and version
 *  - [public/manifest.json]  name, short_name, description, theme_color, background_color
 */
export const Brand = {
  Title: {
    Base: 'EricFriday.dev | Big AGI',
    Common: (process.env.NODE_ENV === 'development' ? '[DEV] ' : '') + 'EF.dev ~ Big AGI',
  },
  Meta: {
    Description: 'Big AGI client.',
    SiteName: 'EricFriday.dev | Big AGI Client & Dev Tooling',
    ThemeColor: '#80f077',
  },
  URIs: {
    Home: 'https://ericfriday.dev',
    // App: 'https://get.ericfriday.dev',
    CardImage: 'https://ericfriday.dev/icons/card-dark-1200.png',
    OpenRepo: 'https://github.com/enricoros/big-agi',
    OpenProject: 'https://github.com/users/enricoros/projects/4',
    SupportInvite: 'https://discord.gg/MkH4qj2Jp9',
    // Twitter: 'https://www.twitter.com/enricoros',
    PrivacyPolicy: 'https://ericfriday.dev/privacy',
  },
} as const;
