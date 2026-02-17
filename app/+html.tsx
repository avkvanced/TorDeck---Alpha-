import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TorDeck" />
        <meta name="mobile-web-app-capable" content="yes" />

        <meta name="theme-color" content="#06080F" />
        <meta name="background-color" content="#06080F" />
        <meta name="msapplication-TileColor" content="#06080F" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #06080F;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          body {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            overscroll-behavior: none;
            -webkit-overflow-scrolling: touch;
          }

          @supports (padding: env(safe-area-inset-top)) {
            #root {
              padding-top: env(safe-area-inset-top);
              padding-left: env(safe-area-inset-left);
              padding-right: env(safe-area-inset-right);
            }
          }

          @media (display-mode: standalone) {
            #root {
              padding-bottom: env(safe-area-inset-bottom, 0px);
            }
          }

          * {
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            box-sizing: border-box;
          }

          input, textarea, select {
            -webkit-touch-callout: default;
            -webkit-user-select: text;
            user-select: text;
          }

          ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: #1E293B;
            border-radius: 2px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #334155;
          }

          @media (display-mode: standalone) {
            body {
              -webkit-user-select: none;
              user-select: none;
            }
            ::-webkit-scrollbar {
              width: 0px;
              height: 0px;
              display: none;
            }
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
