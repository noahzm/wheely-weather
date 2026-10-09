import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { WheelyTheme } from '@/constants/theme';

const APPEARANCE_KEY = 'ww_appearance';

const themeBootstrapScript = `(function(){try{var p=localStorage.getItem('${APPEARANCE_KEY}');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var b=d?'#000000':'#ffffff';document.documentElement.style.setProperty('--wheely-background',b);document.documentElement.style.colorScheme=d?'dark':'light';document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export default function Root({ children }: Readonly<PropsWithChildren>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover exposes the notch and home-indicator insets
            (env(safe-area-inset-*)) that the safe-area hooks read. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Tints Safari's toolbar and status bar to the page background;
            useWebDocumentTheme retargets these when appearance is overridden. */}
        <meta
          name="theme-color"
          content={WheelyTheme.light.background}
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content={WheelyTheme.dark.background}
          media="(prefers-color-scheme: dark)"
        />
        {/* Add to Home Screen opens full screen, like an installed app. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Wheely" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta property="og:title" content="Wheely Weather" />
        <meta
          property="og:description"
          content="Scores how good today's weather is for a bike ride — hourly forecast, kit guide, and a plain-language ride verdict."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://wheelyweather.app/share-icon.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:image" content="https://wheelyweather.app/share-icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="twitter:title" content="Wheely Weather" />
        <meta
          name="twitter:description"
          content="Scores how good today's weather is for a bike ride — hourly forecast, kit guide, and a plain-language ride verdict."
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
