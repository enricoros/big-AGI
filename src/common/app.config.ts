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
    Base: 'Big-AGI',
    Common: (process.env.NODE_ENV === 'development' ? '[DEV] ' : '') + 'Big-AGI',
  },
  Meta: {
    Description: 'Launch the open-source AI workspace for experts. BYO API keys. Compare and tune models, use personas, voice and vision - your data stays local.',
    SiteName: 'Big-AGI | The Expert\'s AI Workspace',
    ThemeColor: '#32383E',
    TwitterSite: '@enricoros',
  },
  URIs: {
    Home: 'https://big-agi.com',
    // App: 'https://get.big-agi.com',
    CardImage: 'https://big-agi.com/icons/card-dark-1200.png',
    OpenRepo: 'https://github.com/enricoros/big-agi',
    OpenProject: 'https://github.com/users/enricoros/projects/4',
    SupportInvite: 'https://discord.gg/MkH4qj2Jp9',
    // Twitter: 'https://x.com/enricoros',
    PrivacyPolicy: 'https://big-agi.com/privacy',
    TermsOfService: 'https://big-agi.com/terms',
  },
  Docs: {
    Public: (docPage: string) => `https://big-agi.com/docs/${docPage}`,
  }
} as const;