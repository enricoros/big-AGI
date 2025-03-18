# big-AGI Analytics

The open-source big-AGI project provides support for the following analytics services:

- **Google Analytics 4**: manual setup required
- **PostHog Analytics**: manual setup required
- **Vercel Analytics**: automatic when deployed to Vercel

The following is a quick overview of the Analytics options for the deployers of this open-source project.
big-AGI is deployed to many large-scale and enterprise though various ways (custom builds, Docker, Vercel, Cloudflare, etc.),
and this guide is for its customization.

## Service Configuration

### Google Analytics 4

- Why: user engagement and retention, performance insights, personalization, content optimization
- What: https://support.google.com/analytics/answer/11593727

Google Analytics 4 (GA4) is a powerful tool for understanding user behavior and engagement.
This can help optimize big-AGI, understanding which features are needed/users and which aren't.

To enable Google Analytics 4, you need to set the `NEXT_PUBLIC_GA4_MEASUREMENT_ID` environment variable
before starting the local build or the docker build (i.e. at build time), at which point the
server/container will be able to report analytics to your Google Analytics 4 property.

As of Feb 27, 2024, this feature is in development.

### PostHog Analytics

- Why: feature usage tracking, user journeys, conversion optimization, product analytics
- What: page views, page leave events, user interactions, and deployment context

PostHog provides comprehensive product analytics with privacy controls. It helps understand how users interact with big-AGI's features, identify opportunities for improvement, and optimize the user experience.

To enable PostHog, set the `NEXT_PUBLIC_POSTHOG_KEY` environment variable at build time. PostHog is configured with tracking optimization and privacy in mind:

- Uses a proxy endpoint (`/a/ph`) to avoid ad blockers
- Respects user opt-out preferences via local storage
- Tracks only essential information without PII
- Adds deployment context for better segmentation

The implementation follows PostHog's best practices for Next.js applications and includes manual page view tracking for proper single-page application support.

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

When big-AGI is served on Vercel hosts, the `process.env.NEXT_PUBLIC_VERCEL_URL` environment variable is trueish, and
analytics will be sent by default to the Vercel Analytics service which is deployed by Vercel IF configured from the
Vercel project dashboard.

In summary: to turn it on: activate the `Analytics` service in the Vercel project dashboard.

## Configurations

| Scope                                                                                                                   | Default                   | Description / Instructions                                                                                                                                                  |
|-------------------------------------------------------------------------------------------------------------------------|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Your **Source** builds of big-AGI                                                                                       | None                      | **Google Analytics**: set environment variable at build time · **PostHog**: set environment variable at build time · **Vercel**: enable Vercel Analytics from the dashboard | 
| Your **Docker** builds of big-AGI                                                                                       | None                      | (**Vercel**: n/a) · **Google Analytics**: set environment variable at `docker build` time · **PostHog**: set environment variable at `docker build` time.                   |
| [get.big-agi.com](https://get.big-agi.com) (**Big-AGI 1.x**)                                                            | Vercel + Google + PostHog | The main website ([privacy policy](https://big-agi.com/privacy)) hosted for free for anyone.                                                                                |
| [prebuilt Docker packages](https://github.com/enricoros/big-AGI/pkgs/container/big-agi) (**Big-AGI 1.x**, 'latest' tag) | Google Analytics          | **Vercel**: n/a · **Google Analytics**: set to the big-agi.com Google Analytics for analytics and improvements · **PostHog**: n/a                                           |

Note: this information is updated as of March 3, 2025 and can change at any time.