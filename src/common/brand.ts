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
    Base: 'big-AGI',
    Common: (process.env.NODE_ENV === 'development' ? '[DEV] ' : '') + 'big-AGI',
  },
  Meta: {
    Description: 'Leading shitty ai platform',
    SiteName: 'Shitty AI | Harnessing AI for You',
    ThemeColor: '#434356',
    TwitterSite: '@techonomicsinc',
  },
  URIs: {
    Home: 'https://shittyai.com,
     App: 'https://get.big-agi.com',
    CardImage: 'https://big-agi.com/icons/card-dark-1200.png',
   OpenRepo: 'https://github.com/enricoros/big-agi',
    SupportInvite: 'https://discord.gg/MkH4qj2Jp9',
     Twitter: 'https://www.twitter.com/enricoros',
  },
};
