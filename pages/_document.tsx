import * as React from 'react';
import { AppType } from 'next/app';
import { default as Document, DocumentContext, DocumentProps, Head, Html, Main, NextScript } from 'next/document';
import createEmotionServer from '@emotion/server/create-instance';
import { getInitColorSchemeScript } from '@mui/joy/styles';

import { Brand } from '~/common/brand';
import { bodyFontClassName, createEmotionCache } from '~/common/theme';

import { MyAppProps } from './_app';


interface MyDocumentProps extends DocumentProps {
  emotionStyleTags: React.JSX.Element[];
}

export default function MyDocument({ emotionStyleTags }: MyDocumentProps) {
  return (
    <Html lang='en' className={bodyFontClassName}>
      <Head>
        {/* Meta (missing Title, set by the App or Page) */}
        <meta name='description' content={Brand.Meta.Description} />
        <meta name='theme-color' content={Brand.Meta.ThemeColor} />

        {/* Favicons & PWA */}
        <link rel='shortcut icon' href='/favicon.ico' />
        <link rel='icon' type='image/png' sizes='32x32' href='/icons/favicon-32x32.png' />
        <link rel='icon' type='image/png' sizes='16x16' href='/icons/favicon-16x16.png' />
        <link rel='apple-touch-icon' sizes='180x180' href='/icons/apple-touch-icon.png' />
        <link rel='manifest' href='/manifest.json' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='black' />

        {/* Opengraph */}
        <meta property='og:title' content={Brand.Title.Common} />
        <meta property='og:description' content={Brand.Meta.Description} />
        {Brand.URIs.CardImage && <meta property='og:image' content={Brand.URIs.CardImage} />}
        <meta property='og:url' content={Brand.URIs.Home} />
        <meta property='og:site_name' content={Brand.Meta.SiteName} />
        <meta property='og:type' content='website' />

        {/* Twitter */}
        <meta property='twitter:card' content='summary_large_image' />
        <meta property='twitter:url' content={Brand.URIs.Home} />
        <meta property='twitter:title' content={Brand.Title.Common} />
        <meta property='twitter:description' content={Brand.Meta.Description} />
        {Brand.URIs.CardImage && <meta property='twitter:image' content={Brand.URIs.CardImage} />}
        <meta name='twitter:site' content={Brand.Meta.TwitterSite} />
        <meta name='twitter:card' content='summary_large_image' />

        {/* Style Sheets (injected and server-side) */}
        <meta name='emotion-insertion-point' content='' />
        {emotionStyleTags}
      </Head>
      <body>
        {getInitColorSchemeScript()}
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

// `getInitialProps` belongs to `_document` (instead of `_app`),
// it's compatible with static-site generation (SSG).
MyDocument.getInitialProps = async (ctx: DocumentContext) => {
  // Resolution order
  //
  // On the server:
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. document.getInitialProps
  // 4. app.render
  // 5. page.render
  // 6. document.render
  //
  // On the server with error:
  // 1. document.getInitialProps
  // 2. app.render
  // 3. page.render
  // 4. document.render
  //
  // On the client
  // 1. app.getInitialProps
  // 2. page.getInitialProps
  // 3. app.render
  // 4. page.render

  const originalRenderPage = ctx.renderPage;

  // You can consider sharing the same Emotion cache between all the SSR requests to speed up performance.
  // However, be aware that it can have global side effects.
  const cache = createEmotionCache();
  const { extractCriticalToChunks } = createEmotionServer(cache);

  ctx.renderPage = () =>
    originalRenderPage({
      enhanceApp: (App: React.ComponentType<React.ComponentProps<AppType> & MyAppProps>) =>
        function EnhanceApp(props) {
          return <App emotionCache={cache} {...props} />;
        },
    });

  const initialProps = await Document.getInitialProps(ctx);
  // This is important. It prevents Emotion to render invalid HTML.
  // See https://github.com/mui/material-ui/issues/26561#issuecomment-855286153
  const emotionStyles = extractCriticalToChunks(initialProps.html);
  const emotionStyleTags = emotionStyles.styles.map((style) => (
    <style
      data-emotion={`${style.key} ${style.ids.join(' ')}`}
      key={style.key}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: style.css }}
    />
  ));

  return {
    ...initialProps,
    emotionStyleTags,
  };
};