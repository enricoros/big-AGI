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
    Base: 'FylloAI',
    Common: (process.env.NODE_ENV === 'development' ? '[DEV] ' : '') + 'FylloAI',
  },
  Meta: {
    Description: 'Launch FylloAI to unlock the full potential of AI, with precise control over your data and models. Voice interface, AI personas, advanced features, and fun UX.',
    SiteName: 'FylloAI | Precision AI for You',
    ThemeColor: '#32383E',
    TwitterSite: '@enricoros', // Assuming this remains the same developer/account
  },
  URIs: {
    Home: 'https://fyllo.m7ai.top',
    // App: 'https://get.fyllo.m7ai.top',
    CardImage: 'https://fyllo.m7ai.top/icons/card-dark-1200.png',
    OpenRepo: 'https://github.com/enricoros/big-agi', // Keeping old repo link
    OpenProject: 'https://github.com/users/enricoros/projects/4', // Keeping old project link
    SupportInvite: 'https://discord.gg/MkH4qj2Jp9', // Keeping old discord link
    // Twitter: 'https://www.twitter.com/enricoros',
    PrivacyPolicy: 'https://fyllo.m7ai.top/privacy',
    TermsOfService: 'https://fyllo.m7ai.top/terms',
  },
  Docs: {
    Public: (docPage: string) => `https://fyllo.m7ai.top/docs/${docPage}`,
  }
} as const;