# big-AGI Analytics

The open-source big-AGI project provides support for the following analytics services:

- **Vercel Analytics**: automatic when deployed to Vercel
- **Google Analytics 4**: manual setup required

The following is a quick overview of the Analytics options for the deployers of this open-source project.
big-AGI is deployed to many large-scale and enterprise though various ways (custom builds, Docker, Vercel, Cloudflare, etc.),
and this guide is for its customization.

## Service Configuration

### Vercel Analytics

- Why: understand coarse traction, and identify deployment issues - all without tracking individual users
- What: top pages, top referrers, country of origin, operating system, browser, and page speed metrics

Vercel Analytics and Speed Insights are local API endpoints deployed to your domain, so everything stays within your
domain. Furthermore, the Vercel Analytics service is privacy-friendly, and does not track individual users.

This service is avaialble to system administrators when deploying to Vercel. It is automatically enabled when deploying to Vercel.
The code that activates Vercel Analytics is located in the `src/pages/_app.tsx` file:

```tsx
const MyApp = ({ Component, emotionCache, pageProps }: MyAppProps) => <>
  ...
  {isVercelFromFrontend && <VercelAnalytics debug={false} />}
  {isVercelFromFrontend && <VercelSpeedInsights debug={false} sampleRate={1 / 2} />}
  ...
</>;
```

When big-AGI is served on Vercel hosts, the ```process.env.NEXT_PUBLIC_VERCEL_URL``` environment variable is trueish, and
analytics will be sent by default to the Vercel Analytics service which is deployed by Vercel IF configured from the
Vercel project dashboard.

In summary: to turn it on: activate the `Analytics` service in the Vercel project dashboard.

### Google Analytics 4

- Why: user engagement and retention, performance insights, personalization, content optimization
- What: https://support.google.com/analytics/answer/11593727

Google Analytics 4 (GA4) is a powerful tool for understanding user behavior and engagement.
This can help optimize big-AGI, understanding which features are needed/users and which aren't.

To enable Google Analytics 4, you need to set the `NEXT_PUBLIC_GA4_MEASUREMENT_ID` environment variable
before starting the local build or the docker build (i.e. at build time), at which point the
server/container will be able to report analytics to your Google Analytics 4 property.

As of Feb 27, 2024, this feature is in development.

## Configurations

| Scope                                                                                   | Default          | Description / Instructions                                                                                              |
|-----------------------------------------------------------------------------------------|------------------|-------------------------------------------------------------------------------------------------------------------------|
| Your source builds of big-AGI                                                           | None             | **Vercel**: enable Vercel Analytics from the dashboard. · **Google Analytics**: set environment variable at build time. |
| Your docker builds of big-AGI                                                           | None             | **Vercel**: n/a. · **Google Analytics**: set environment variable at `docker build` time.                               |
| [big-agi.com](https://big-agi.com)                                                      | Vercel + Google  | The main website ([privacy policy](https://big-agi.com/privacy)) hosted for free for anyone.                            |
| [official Docker packages](https://github.com/enricoros/big-AGI/pkgs/container/big-agi) | Google Analytics | **Vercel**: n/a · **Google Analytics**: set to the big-agi.com Google Analytics for analytics and improvements.         |

Note: this information is updated as of Feb 27, 2024 and can change at any time.